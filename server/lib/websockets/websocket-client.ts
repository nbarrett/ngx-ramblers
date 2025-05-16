import WebSocket from "ws";
import debug from "debug";
import { envConfig } from "../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("websocket-client"));
debugLog.enabled = true;

export function createWebSocketClient(): WebSocket {
  const port: number =  +envConfig.server.listenPort;
  const ws = new WebSocket(`ws://localhost:${port}/ws`);
  debugLog(`✅ WebSocket client is running on port ${port} for ${envConfig.env} environment`);
  return ws;
}
