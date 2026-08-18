import debug from "debug";
import { Request } from "express";
import { isString } from "es-toolkit/compat";
import { envConfig } from "../env-config/env-config";
import { dateTimeNow } from "../shared/dates";
import { sendAdminAlertEmail } from "../alerts/admin-alerts";

const warnLog = debug(envConfig.logNamespace("os-maps-tiles"));
warnLog.enabled = true;

export const OS_TILE_PER_MINUTE = 180;
export const OS_TILE_PER_DAY = 4000;
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface TileAllowance {
  allowed: boolean;
  retryAfterSeconds: number;
  dayCount: number;
  crossedDailyAlert: boolean;
}

interface TileBucket {
  windowStart: number;
  windowCount: number;
  dayStart: number;
  dayCount: number;
  alertedForDay: number;
}

const buckets = new Map<string, TileBucket>();

export function resetOsTileLimiter(): void {
  buckets.clear();
}

export function clientKeyFromRequest(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (isString(forwarded) && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  } else {
    return req.ip || req.socket.remoteAddress || "unknown";
  }
}

export function takeTileAllowance(clientKey: string): TileAllowance {
  const now = dateTimeNow().toMillis();
  const existing = buckets.get(clientKey);
  const bucket = existing && now - existing.dayStart < DAY_MS
    ? (now - existing.windowStart < MINUTE_MS
      ? existing
      : {...existing, windowStart: now, windowCount: 0})
    : {windowStart: now, windowCount: 0, dayStart: now, dayCount: 0, alertedForDay: 0};
  if (bucket.windowCount >= OS_TILE_PER_MINUTE) {
    buckets.set(clientKey, bucket);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((MINUTE_MS - (now - bucket.windowStart)) / 1000)),
      dayCount: bucket.dayCount,
      crossedDailyAlert: false
    };
  } else if (bucket.dayCount >= OS_TILE_PER_DAY) {
    buckets.set(clientKey, bucket);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((DAY_MS - (now - bucket.dayStart)) / 1000)),
      dayCount: bucket.dayCount,
      crossedDailyAlert: false
    };
  } else {
    const next: TileBucket = {
      ...bucket,
      windowCount: bucket.windowCount + 1,
      dayCount: bucket.dayCount + 1
    };
    const crossedDailyAlert = next.dayCount === OS_TILE_PER_DAY && next.alertedForDay !== next.dayStart;
    if (crossedDailyAlert) {
      next.alertedForDay = next.dayStart;
    }
    buckets.set(clientKey, next);
    return {
      allowed: true,
      retryAfterSeconds: 0,
      dayCount: next.dayCount,
      crossedDailyAlert
    };
  }
}

export async function warnHighTileUse(clientKey: string, dayCount: number): Promise<void> {
  warnLog("OS tile volume high for client %s: %d tiles today", clientKey, dayCount);
  await sendAdminAlertEmail({
    subject: "OS map tiles: high daily use",
    category: "os-maps-tiles",
    htmlContent: `<p>An NGX site has served ${dayCount} OS map tiles to one client (${clientKey}) in 24 hours.</p><p>This is the daily cap. Further requests from that client will return HTTP 429 until the window resets.</p>`
  });
}
