import WebSocket from "ws";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { MessageType } from "../../../projects/ngx-ramblers/src/app/models/websocket.model";
import { backupEvents } from "./backup-events";
import { BackupSession } from "../mongo/models/backup-session";
import { S3BackupManifest } from "../../../projects/ngx-ramblers/src/app/models/backup-session.model";

const debugLog = debug(envConfig.logNamespace("backup-events-ws-handler"));
debugLog.enabled = false;

export async function handleBackupEventsWebSocket(ws: WebSocket, _data: any): Promise<void> {
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

  const onManifestCreated = (payload: { manifest: S3BackupManifest }) =>
    send(MessageType.BACKUP_MANIFEST_CREATED, { manifest: payload.manifest });
  const onManifestDeleted = (payload: { id: string }) =>
    send(MessageType.BACKUP_MANIFEST_DELETED, { id: payload.id });
  const onSessionUpdated = (payload: { session: BackupSession }) =>
    send(MessageType.BACKUP_SESSION_UPDATED, { session: payload.session });

  backupEvents.on("manifest-created", onManifestCreated);
  backupEvents.on("manifest-deleted", onManifestDeleted);
  backupEvents.on("session-updated", onSessionUpdated);

  ws.on("close", () => {
    debugLog("client disconnected");
    backupEvents.off("manifest-created", onManifestCreated);
    backupEvents.off("manifest-deleted", onManifestDeleted);
    backupEvents.off("session-updated", onSessionUpdated);
  });
}
