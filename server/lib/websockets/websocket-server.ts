import WebSocket, { Server as WebSocketServer } from "ws";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { resizeSavedImages, resizeUnsavedImages } from "../aws/bulk-image-resizer";
import { ContentMetadataResizeRequest } from "../../../projects/ngx-ramblers/src/app/models/content-metadata.model";
import { IncomingMessage, Server } from "node:http";
import {
  EventType,
  MappedCloseMessage,
  MessageHandlers,
  WebSocketInstance,
  WebSocketRequest
} from "../../../projects/ngx-ramblers/src/app/models/websocket.model";
import { RamblersWalksUploadRequest } from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { uploadWalks } from "../ramblers/ramblers-upload-walks";
import { humanFileSize } from "../../../projects/ngx-ramblers/src/app/functions/file-utils";
import { mapStatusCode } from "../../../projects/ngx-ramblers/src/app/functions/websockets";
import { processTestStepEvent } from "../ramblers/process-test-step-event";
import { handleSiteMigration } from "../migration/site-migration-ws-handler";
import { handleBackupRestoreWebSocket } from "../backup/backup-ws-handler";
import { handleEsriRouteImport } from "../map-routes/map-route-import-ws-handler";
import { handleWalksManagerSync } from "../walks/walks-manager-sync-ws-handler";

const debugLog = debug(envConfig.logNamespace("websocket-server"));
debugLog.enabled = true;
const clientWebSocketInstance: WebSocketInstance = {instance: null};
const messageHandlers: MessageHandlers = {
  [EventType.RAMBLERS_WALKS_UPLOAD]: (ws: WebSocket, data: RamblersWalksUploadRequest) => uploadWalks(ws, data),
  [EventType.RESIZE_SAVED_IMAGES]: (ws: WebSocket, data: ContentMetadataResizeRequest) => resizeSavedImages(ws, data),
  [EventType.RESIZE_UNSAVED_IMAGES]: (ws: WebSocket, data: ContentMetadataResizeRequest) => resizeUnsavedImages(ws, data),
  [EventType.TEST_STEP_REPORTER]: (ws: WebSocket, data: string) => processTestStepEvent(clientWebSocketInstance.instance || ws, data),
  [EventType.SITE_MIGRATION]: async (ws: WebSocket, data: any) => handleSiteMigration(ws, data),
  [EventType.BACKUP_RESTORE]: async (ws: WebSocket, data: any) => handleBackupRestoreWebSocket(ws, data),
  [EventType.ESRI_ROUTE_IMPORT]: async (ws: WebSocket, data: any) => handleEsriRouteImport(ws, data),
  [EventType.WALKS_MANAGER_SYNC]: async (ws: WebSocket, data: any) => handleWalksManagerSync(ws, data),
  [EventType.PING]: (ws: WebSocket, data: any) => {
    debugLog("✅ Received ping, responding with pong");
    ws.send(JSON.stringify({ type: "pong", data: {} }));
  },
};
export function createWebSocketServer(server: Server, port: number): void {
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 1024 * 1024 * 500,
    clientTracking: true,
    perMessageDeflate: false
  });

  function upgradeIfWebSocket(request: IncomingMessage, socket: any, head: Buffer): void {
    if (request.url === "/ws") {
      wss.handleUpgrade(request, socket, head, (ws: WebSocket.WebSocket) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  }

  wss.on("connection", (ws: WebSocket, request: IncomingMessage) => {
    debugLog("✅ Client connected");

    ws.setMaxListeners(20);

    const socket = request.socket;
    socket.setTimeout(0);
    socket.setKeepAlive(true, 30000);
    debugLog("✅ Socket configured with no timeout and keep-alive every 30s");

    ws.on("message", (message: string) => {
      debugLog(`✅ Message received of size: ${humanFileSize(message.length)}`);
      try {
        const request: WebSocketRequest = JSON.parse(message);
        const handler = messageHandlers[request.type];
        if (request.type !== EventType.TEST_STEP_REPORTER) {
          clientWebSocketInstance.instance = ws;
        }
        if (handler) {
          debugLog(`✅ About to invoke handler for message type: ${request.type}`);
          handler(ws, request.data);
        } else {
          debugLog(`❌ No handler for message type: ${request.type}`);
        }
      } catch (error) {
        debugLog("❌ Invalid message format:", error);
      }
    });

    ws.on("error", (error: Error) => {
      debugLog("❌ WebSocket connection error:", error);
    });

    ws.on("close", (code: number) => {
      const mappedCloseMessage: MappedCloseMessage = mapStatusCode(code);
      if (mappedCloseMessage.success) {
        debugLog("✅ WebSocket success close event with code:", mappedCloseMessage);
      } else {
        debugLog("❌ WebSocket failure close event with code:", mappedCloseMessage);
      }
    });
  });

  wss.on("error", (error: Error) => {
    debugLog("❌ WebSocket server error:", error);
  });

  server.on("upgrade", (request, socket, head) => {
    debugLog("✅ Upgrading connection");
    upgradeIfWebSocket(request, socket, head);
  });

  debugLog(`✅ WebSocket server is running on port ${port} for ${envConfig.env} environment`);
}
