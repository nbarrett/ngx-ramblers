import { Request, Response, NextFunction } from "express";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { legacyUrlMapping } from "../mongo/models/legacy-url-mapping";
import { dateTimeNowAsValue } from "../shared/dates";
import * as configController from "../mongo/controllers/config";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { LegacyRedirectConfig } from "../../../projects/ngx-ramblers/src/app/models/legacy-url-redirect.model";

const debugLog = debug(envConfig.logNamespace("redirect-middleware"));

interface CachedMapping {
  targetPath: string;
  redirectType: number;
}

let redirectCache: Map<string, CachedMapping> = new Map();
let legacyDomains: Set<string> = new Set();
let cacheLoadedAt = 0;
let cacheRefreshMs = 5 * 60 * 1000;
let hitFlushMs = 60 * 1000;
const pendingHits: Map<string, { count: number; lastHitDate: number }> = new Map();
let flushInterval: ReturnType<typeof setInterval> | null = null;

function normalisePath(path: string): string {
  return (path || "").toLowerCase().replace(/\/+$/, "") || "/";
}

async function loadConfig(): Promise<void> {
  try {
    const configDocument = await configController.queryKey(ConfigKey.LEGACY_REDIRECT);
    const config: LegacyRedirectConfig = configDocument?.value;
    if (config) {
      legacyDomains = new Set((config.legacyDomains || []).map(d => d.toLowerCase()));
      if (config.cacheRefreshMinutes) {
        cacheRefreshMs = config.cacheRefreshMinutes * 60 * 1000;
      }
      if (config.hitFlushIntervalSeconds) {
        hitFlushMs = config.hitFlushIntervalSeconds * 1000;
      }
    }
  } catch (error) {
    debugLog("failed to load legacy redirect config:", error);
  }
}

async function loadMappings(): Promise<void> {
  try {
    await loadConfig();
    const acceptedMappings = await legacyUrlMapping.find({ status: "accepted" }).lean();
    const newCache = new Map<string, CachedMapping>();
    acceptedMappings.forEach((mapping: any) => {
      const fragment = mapping.legacyFragment || "";
      const key = normalisePath(mapping.legacyPath) + fragment;
      newCache.set(key, {
        targetPath: mapping.targetPath,
        redirectType: mapping.redirectType || 301
      });
    });
    redirectCache = newCache;
    cacheLoadedAt = dateTimeNowAsValue();
    debugLog(`loaded ${redirectCache.size} redirect mappings from database`);
  } catch (error) {
    debugLog("failed to load redirect mappings:", error);
  }
}

async function flushHits(): Promise<void> {
  if (pendingHits.size === 0) {
    return;
  }
  const hitsToFlush = new Map(pendingHits);
  pendingHits.clear();
  try {
    const bulkOps = Array.from(hitsToFlush.entries()).map(([key, hit]) => {
      const [pathPart, ...fragmentParts] = key.split("#");
      const fragment = fragmentParts.length > 0 ? `#${fragmentParts.join("#")}` : undefined;
      const filter: any = { legacyPath: { $regex: new RegExp(`^${pathPart.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") } };
      if (fragment) {
        filter.legacyFragment = fragment;
      }
      return {
        updateOne: {
          filter,
          update: {
            $inc: { hitCount: hit.count },
            $set: { lastHitDate: hit.lastHitDate }
          }
        }
      };
    });
    if (bulkOps.length > 0) {
      await legacyUrlMapping.bulkWrite(bulkOps);
      debugLog(`flushed ${bulkOps.length} redirect hit counts`);
    }
  } catch (error) {
    debugLog("failed to flush hit counts:", error);
  }
}

function recordHit(cacheKey: string): void {
  const existing = pendingHits.get(cacheKey);
  if (existing) {
    existing.count += 1;
    existing.lastHitDate = dateTimeNowAsValue();
  } else {
    pendingHits.set(cacheKey, { count: 1, lastHitDate: dateTimeNowAsValue() });
  }
}

export function invalidateRedirectCache(): void {
  cacheLoadedAt = 0;
  debugLog("redirect cache invalidated");
}

export async function initialiseRedirectMiddleware(): Promise<void> {
  await loadMappings();
  if (flushInterval) {
    clearInterval(flushInterval);
  }
  flushInterval = setInterval(() => {
    flushHits().catch(error => debugLog("flush error:", error));
  }, hitFlushMs);
}

export function redirectMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.path.startsWith("/api/")) {
    next();
    return;
  }

  const now = dateTimeNowAsValue();
  if (now - cacheLoadedAt > cacheRefreshMs) {
    loadMappings().catch(error => debugLog("cache refresh error:", error));
  }

  const hostname = (req.hostname || "").toLowerCase();
  const isLegacyDomain = legacyDomains.size === 0 || legacyDomains.has(hostname);

  if (!isLegacyDomain && legacyDomains.size > 0) {
    next();
    return;
  }

  const normalisedPath = normalisePath(req.path);
  const cacheKey = normalisedPath;
  const cached = redirectCache.get(cacheKey);

  if (cached && cached.targetPath) {
    debugLog(`redirecting ${req.originalUrl} -> ${cached.targetPath} (${cached.redirectType})`);
    recordHit(cacheKey);
    res.redirect(cached.redirectType, cached.targetPath);
    return;
  }

  next();
}
