import WebSocket, { Server as WebSocketServer } from "ws";
import debug from "debug";
import { IncomingMessage, Server } from "node:http";
import {
  EventType,
  MappedCloseMessage,
  MessageHandlers,
  WebSocketRequest
} from "../../../projects/ngx-ramblers/src/app/models/websocket.model";
import { humanFileSize } from "../../../projects/ngx-ramblers/src/app/functions/file-utils";
import { mapStatusCode } from "../../../projects/ngx-ramblers/src/app/functions/websockets";
import { envConfig } from "../env-config/env-config";
import { processTestStepEvent } from "./process-test-step-event";

const debugLog = debug(envConfig.logNamespace("ramblers-upload-worker-websocket-server"));
debugLog.enabled = true;

const messageHandlers: Partial<MessageHandlers> = {
  [EventType.TEST_STEP_REPORTER]: (ws: WebSocket, data: string) => processTestStepEvent(ws, data),
  [EventType.PING]: (ws: WebSocket) => {
    ws.send(JSON.stringify({ type: "pong", data: {} }));
  }
};

export function createRamblersUploadWorkerWebSocketServer(server: Server, port: number): void {
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 1024 * 1024 * 50,
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
    ws.setMaxListeners(20);
    const socket = request.socket;
    socket.setTimeout(0);
    socket.setKeepAlive(true, 30000);

    ws.on("message", (message: string) => {
      try {
        const request: WebSocketRequest = JSON.parse(message);
        const handler = messageHandlers[request.type];

        if (handler) {
          if (request.type !== EventType.PING) {
            debugLog(`Message received of size: ${humanFileSize(message.length)} for type: ${request.type}`);
          }
          handler(ws, request.data);
        }
      } catch (error) {
        debugLog("Invalid message format:", error);
      }
    });

    ws.on("error", (error: Error) => {
      debugLog("WebSocket connection error:", error);
    });

    ws.on("close", (code: number) => {
      const mappedCloseMessage: MappedCloseMessage = mapStatusCode(code);
      if (mappedCloseMessage.success) {
        debugLog("WebSocket success close event with code:", mappedCloseMessage);
      } else {
        debugLog("WebSocket failure close event with code:", mappedCloseMessage);
      }
    });
  });

  wss.on("error", (error: Error) => {
    debugLog("WebSocket server error:", error);
  });

  server.on("upgrade", (request, socket, head) => {
    upgradeIfWebSocket(request, socket, head);
  });

  debugLog(`Ramblers upload worker websocket server is running on port ${port} for ${envConfig.env} environment`);
}
