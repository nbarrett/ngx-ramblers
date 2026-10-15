import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { member } from "../mongo/models/member";
import { memberSessionFields } from "../../../projects/ngx-ramblers/src/app/functions/member-cookie";
import { MessageType } from "../../../projects/ngx-ramblers/src/app/models/websocket.model";
import { broadcast } from "../websockets/websocket-broadcaster";

const debugLog = debug(envConfig.logNamespace("member-session-watcher"));
debugLog.enabled = true;
const watcher = {
  active: false,
  stream: null as ReturnType<typeof member.watch> | null,
  retryTimer: null as ReturnType<typeof setTimeout> | null
};

export function memberSessionChangePipeline(): Record<string, unknown>[] {
  const fields = memberSessionFields();
  return [{$match: {$or: [
    {operationType: {$in: ["replace", "delete", "invalidate"]}},
    {operationType: "update", $or: [
      ...fields.map(field => ({[`updateDescription.updatedFields.${field}`]: {$exists: true}})),
      {"updateDescription.removedFields": {$in: fields}}
    ]}
  ]}}];
}

function retryMemberSessionWatcher(): void {
  if (watcher.active && !watcher.retryTimer) {
    const stream = watcher.stream;
    watcher.stream = null;
    if (stream) {
      void stream.close().catch(error => debugLog("Failed to close member session stream:", error));
    }
    watcher.retryTimer = setTimeout(() => {
      watcher.retryTimer = null;
      if (watcher.active) {
        openMemberSessionWatcher();
        broadcast(MessageType.MEMBER_SESSION_CHANGED, {});
      }
    }, 5000);
    watcher.retryTimer.unref();
  }
}

function openMemberSessionWatcher(): void {
  try {
    const stream = member.watch(memberSessionChangePipeline());
    watcher.stream = stream;
    stream.on("change", () => broadcast(MessageType.MEMBER_SESSION_CHANGED, {}));
    stream.on("error", error => {
      debugLog("Member session change stream failed; reconnecting:", error);
      if (watcher.stream === stream) {
        retryMemberSessionWatcher();
      }
    });
    stream.on("close", () => {
      if (watcher.stream === stream) {
        retryMemberSessionWatcher();
      }
    });
  } catch (error) {
    debugLog("Could not open member session change stream; reconnecting:", error);
    retryMemberSessionWatcher();
  }
}

export function startMemberSessionWatcher(): void {
  if (!watcher.active) {
    watcher.active = true;
    openMemberSessionWatcher();
  }
}

export async function stopMemberSessionWatcher(): Promise<void> {
  watcher.active = false;
  if (watcher.retryTimer) {
    clearTimeout(watcher.retryTimer);
    watcher.retryTimer = null;
  }
  const stream = watcher.stream;
  watcher.stream = null;
  if (stream) {
    await stream.close();
  }
}
