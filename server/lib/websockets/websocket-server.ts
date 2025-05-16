import WebSocket, { Server as WebSocketServer } from "ws";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { resizeSavedImages, resizeUnsavedImages } from "../aws/bulk-image-resizer";
import { ContentMetadataResizeRequest } from "../../../projects/ngx-ramblers/src/app/models/content-metadata.model";
import { Server } from "node:http";
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

const debugLog = debug(envConfig.logNamespace("websocket-server"));
debugLog.enabled = true;
const clientWebSocketInstance: WebSocketInstance = {instance: null};
const messageHandlers: MessageHandlers = {
  [EventType.RAMBLERS_WALKS_UPLOAD]: (ws: WebSocket, data: RamblersWalksUploadRequest) => uploadWalks(ws, data),
  [EventType.RESIZE_SAVED_IMAGES]: (ws: WebSocket, data: ContentMetadataResizeRequest) => resizeSavedImages(ws, data),
  [EventType.RESIZE_UNSAVED_IMAGES]: (ws: WebSocket, data: ContentMetadataResizeRequest) => resizeUnsavedImages(ws, data),
  [EventType.TEST_STEP_REPORTER]: (ws: WebSocket, data: string) => processTestStepEvent(clientWebSocketInstance.instance || ws, data),
};
export function createWebSocketServer(server: Server, port: number): void {
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 1024 * 1024 * 500
  });

  wss.on("connection", (ws: WebSocket) => {
    debugLog("✅ Client connected");
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
    if (request.url === "/ws") {
      // If the request is for the /ws path, upgrade to WebSocket
      wss.handleUpgrade(request, socket, head, (ws: WebSocket.WebSocket) => {
        wss.emit("connection", ws, request);
      });
    } else {
      // Reject any requests that don't match the /ws path
      socket.destroy();
    }
  });

  debugLog(`✅ WebSocket server is running on port ${port} for ${envConfig.env} environment`);
}
