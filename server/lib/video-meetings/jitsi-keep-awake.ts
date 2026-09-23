import debug from "debug";
import { Request, Response } from "express";
import { JITSI_KEEP_AWAKE_INTERVAL_MS } from "../../../projects/ngx-ramblers/src/app/models/video-meeting.model";
import { stripTrailingSlash } from "../../../projects/ngx-ramblers/src/app/functions/strings";
import { envConfig } from "../env-config/env-config";
import { dateTimeNowAsValue } from "../shared/dates";
import { isPublicJitsiHost, resolveVideoMeetingRuntime } from "./video-meetings-config";

const debugLog = debug(envConfig.logNamespace("jitsi-keep-awake"));
const ROOM_STALE_MS = JITSI_KEEP_AWAKE_INTERVAL_MS * 3;
const PING_TIMEOUT_MS = 8_000;

const keepAwake = {
  rooms: new Map<string, number>(),
  timer: null as ReturnType<typeof setInterval> | null
};

export async function keepJitsiAwake(req: Request, res: Response): Promise<void> {
  const room: string = (req.body?.room || "").trim();
  if (!room) {
    res.status(400).json({message: "room is required"});
  } else {
    await noteMeetingKeepAwake(room);
    res.status(200).json({ok: true});
  }
}

export async function noteMeetingKeepAwake(room: string): Promise<void> {
  const name = (room || "").trim();
  if (name) {
    keepAwake.rooms.set(name, dateTimeNowAsValue());
    await refreshKeepAwake();
    startKeepAwakeTimer();
  }
}

export async function refreshKeepAwake(): Promise<boolean> {
  const now = dateTimeNowAsValue();
  [...keepAwake.rooms.entries()].forEach(([room, seenAt]) => {
    if (now - seenAt > ROOM_STALE_MS) {
      keepAwake.rooms.delete(room);
    }
  });
  if (keepAwake.rooms.size === 0) {
    stopKeepAwakeTimer();
    return false;
  } else {
    return pingSelfHostedJitsi();
  }
}

export function resetKeepAwakeState(): void {
  keepAwake.rooms.clear();
  stopKeepAwakeTimer();
}

function startKeepAwakeTimer(): void {
  if (!keepAwake.timer) {
    keepAwake.timer = setInterval(() => {
      void refreshKeepAwake();
    }, JITSI_KEEP_AWAKE_INTERVAL_MS);
    keepAwake.timer.unref();
  }
}

function stopKeepAwakeTimer(): void {
  if (keepAwake.timer) {
    clearInterval(keepAwake.timer);
    keepAwake.timer = null;
  }
}

async function pingSelfHostedJitsi(): Promise<boolean> {
  const runtime = await resolveVideoMeetingRuntime();
  if (!runtime?.host || runtime.publicHost || isPublicJitsiHost(runtime.host)) {
    return false;
  } else {
    const url = `${stripTrailingSlash(runtime.host)}/`;
    try {
      await fetch(url, {method: "GET", redirect: "manual", signal: AbortSignal.timeout(PING_TIMEOUT_MS)});
      debugLog("kept self-hosted Jitsi awake", url, "rooms", keepAwake.rooms.size);
      return true;
    } catch (error) {
      debugLog("Jitsi keep-awake ping failed:", (error as Error).message);
      return false;
    }
  }
}
