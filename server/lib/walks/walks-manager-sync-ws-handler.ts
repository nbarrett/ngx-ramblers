import WebSocket from "ws";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { MessageType } from "../../../projects/ngx-ramblers/src/app/models/websocket.model";
import { syncWalksManagerData } from "./walks-manager-sync";
import { systemConfig } from "../config/system-config";

const debugLog = debug(envConfig.logNamespace("walks-manager-sync-ws-handler"));
debugLog.enabled = true;

export async function handleWalksManagerSync(ws: WebSocket, data: any): Promise<void> {
  debugLog("handleWalksManagerSync received:", data);

  try {
    const config = await systemConfig();
    const fullSync = data?.fullSync || false;

    debugLog(`Starting sync with fullSync=${fullSync}`);

    await syncWalksManagerData(config, { fullSync }, ws);

    debugLog("Sync completed successfully");
  } catch (error) {
    debugLog("Error in handleWalksManagerSync:", error);
    ws.send(JSON.stringify({
      type: MessageType.ERROR,
      data: { message: error.message }
    }));
  }
}
