import WebSocket from "ws";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { MessageType } from "../../../projects/ngx-ramblers/src/app/models/websocket.model";
import { backupSession } from "../mongo/models/backup-session";

const debugLog = debug(envConfig.logNamespace("backup-ws-handler"));
debugLog.enabled = true;

export async function handleBackupRestoreWebSocket(ws: WebSocket, data: any): Promise<void> {
  debugLog("handleBackupRestoreWebSocket received:", data);

  const sessionId = data?.sessionId;
  if (!sessionId) {
    ws.send(JSON.stringify({
      type: MessageType.ERROR,
      data: { message: "Session ID is required" }
    }));
    return;
  }

  try {
    const session = await backupSession.findById(sessionId);
    if (!session) {
      ws.send(JSON.stringify({
        type: MessageType.ERROR,
        data: { message: `Session ${sessionId} not found` }
      }));
      return;
    }

    let previousLogCount = 0;

    const sendUpdate = async () => {
      try {
        const updatedSession = await backupSession.findById(sessionId);
        if (!updatedSession) {
          return;
        }

        const newLogs = updatedSession.logs.slice(previousLogCount);
        if (newLogs.length > 0) {
          ws.send(JSON.stringify({
            type: MessageType.PROGRESS,
            data: {
              sessionId: updatedSession.sessionId,
              status: updatedSession.status,
              logs: newLogs,
              message: newLogs[newLogs.length - 1]
            }
          }));
          previousLogCount = updatedSession.logs.length;
        }

        if (updatedSession.status === "completed" || updatedSession.status === "failed") {
          ws.send(JSON.stringify({
            type: MessageType.COMPLETE,
            data: {
              sessionId: updatedSession.sessionId,
              status: updatedSession.status,
              error: updatedSession.error,
              logs: updatedSession.logs
            }
          }));
          if (pollInterval) {
            clearInterval(pollInterval);
          }
          ws.close(1000, "Session completed");
        }
      } catch (error) {
        debugLog("Error sending update:", error);
      }
    };

    const pollInterval = setInterval(sendUpdate, 1000);

    await sendUpdate();

    ws.on("close", () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    });

  } catch (error) {
    debugLog("Error in handleBackupRestoreWebSocket:", error);
    ws.send(JSON.stringify({
      type: MessageType.ERROR,
      data: { message: error.message }
    }));
  }
}
