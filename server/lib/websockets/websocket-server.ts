import WebSocket, { Server as WebSocketServer } from "ws";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { resizeSavedImages, resizeUnsavedImages } from "../aws/bulk-image-resizer";
import { ContentMetadataResizeRequest } from "../../../projects/ngx-ramblers/src/app/models/content-metadata.model";
import { Server } from "node:http";

const debugLog = debug(envConfig.logNamespace("websocket-server"));
debugLog.enabled = true;

interface MessageHandlers {
  [key: string]: (ws: WebSocket, data: any) => void;
}

const messageHandlers: MessageHandlers = {
  resizeSavedImages: (ws: WebSocket, data: ContentMetadataResizeRequest) => resizeSavedImages(ws, data),
  resizeUnsavedImages: (ws: WebSocket, data: ContentMetadataResizeRequest) => resizeUnsavedImages(ws, data),
};

export function createWebSocketServer(server: Server, port: number): void {
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws: WebSocket) => {
    debugLog("✅ Client connected");

    ws.on("message", (message: string) => {
      debugLog(`✅ Message received:`, message);
      try {
        const request = JSON.parse(message);
        const handler = messageHandlers[request.type];
        if (handler) {
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
