import WebSocket, { Server as WebSocketServer } from "ws";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { pluraliseWithCount } from "../shared/string-utils";
import { MessageType } from "../../../projects/ngx-ramblers/src/app/models/websocket.model";

const debugLog = debug(envConfig.logNamespace("websocket-broadcaster"));
debugLog.enabled = true;

let registeredServer: WebSocketServer | null = null;

export function registerWebSocketServer(wss: WebSocketServer): void {
  registeredServer = wss;
  debugLog("✅ WebSocket server registered for broadcast");
}

export function broadcast(messageType: MessageType, data: unknown): number {
  if (!registeredServer) {
    debugLog("⚠️ broadcast called before WebSocket server was registered; dropping", messageType);
    return 0;
  }
  const payload = JSON.stringify({type: messageType, data});
  const recipients = Array.from(registeredServer.clients).filter(client => client.readyState === WebSocket.OPEN);
  recipients.forEach(client => client.send(payload));
  debugLog(`✅ broadcast ${messageType} to ${pluraliseWithCount(recipients.length, "client")}`);
  return recipients.length;
}
