import WebSocket from "ws";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { MessageType } from "../../../projects/ngx-ramblers/src/app/models/websocket.model";
import { ScheduledTaskSummary } from "../../../projects/ngx-ramblers/src/app/models/scheduled-task.model";
import { scheduledTaskEvents } from "./scheduled-task-events";

const debugLog = debug(envConfig.logNamespace("scheduled-task-events-ws-handler"));
debugLog.enabled = false;

export async function handleScheduledTaskEventsWebSocket(ws: WebSocket, _data: any): Promise<void> {
  debugLog("client subscribed");

  const send = (type: MessageType, data: any) => {
    if (ws.readyState !== WebSocket.OPEN) {
      return;
    }
    try {
      ws.send(JSON.stringify({ type, data }));
    } catch (error) {
      debugLog("failed to send message:", error);
    }
  };

  const onTaskUpdated = (payload: { task: ScheduledTaskSummary }) =>
    send(MessageType.SCHEDULED_TASK_UPDATED, { task: payload.task });

  scheduledTaskEvents.on("task-updated", onTaskUpdated);

  ws.on("close", () => {
    debugLog("client disconnected");
    scheduledTaskEvents.off("task-updated", onTaskUpdated);
  });
}
