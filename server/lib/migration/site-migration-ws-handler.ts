import debug from "debug";
import WebSocket from "ws";
import crypto from "crypto";
import { ApiAction } from "../../../projects/ngx-ramblers/src/app/models/api-response.model";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import * as configController from "../mongo/controllers/config";
import {
  MigrationConfig,
  SiteMigrationConfig
} from "../../../projects/ngx-ramblers/src/app/models/migration-config.model";
import { MessageType } from "../../../projects/ngx-ramblers/src/app/models/websocket.model";
import * as mongooseClient from "../mongo/mongoose-client";
import { migrationHistory } from "../mongo/models/migration-history";
import { dateTimeNowAsValue } from "../shared/dates";
import { envConfig } from "../env-config/env-config";
import { submitMigrationJobToIntegrationWorker } from "../ramblers/integration-worker-browser-client";
import { completeMigrationSession, registerMigrationSession } from "./migration-session-registry";

const debugLog = debug(envConfig.logNamespace("site-migration-ws-handler"));
debugLog.enabled = true;

export async function handleSiteMigration(ws: WebSocket, data: any): Promise<void> {
  let jobId: string | null = null;
  try {
    const persistData = `${data?.persistData}` === "true" || data?.persistData === true;
    const uploadTos3 = `${data?.uploadTos3}` === "true" || data?.uploadTos3 === true;
    const siteName = data?.siteName;
    const siteConfigOverride = data?.siteConfig as SiteMigrationConfig | undefined;

    if (!siteName && !siteConfigOverride) {
      ws.send(JSON.stringify({ type: MessageType.ERROR, data: { action: ApiAction.QUERY, message: "Site name is required" } }));
      return;
    }

    let siteConfig: SiteMigrationConfig | undefined = siteConfigOverride;
    if (!siteConfig) {
      const configDocument = await configController.queryKey(ConfigKey.MIGRATION);
      const migrationConfig: MigrationConfig = configDocument?.value;
      if (!migrationConfig?.sites) {
        ws.send(JSON.stringify({ type: MessageType.ERROR, data: { action: ApiAction.QUERY, message: "No migration configuration found" } }));
        return;
      }
      siteConfig = migrationConfig.sites.find(site => site.name === siteName || site.siteIdentifier === siteName);
    }
    if (!siteConfig) {
      ws.send(JSON.stringify({ type: MessageType.ERROR, data: { action: ApiAction.QUERY, message: `Site configuration not found for: ${siteName}` } }));
      return;
    }
    if (!siteConfig.enabled) {
      ws.send(JSON.stringify({ type: MessageType.ERROR, data: { action: ApiAction.QUERY, message: `Site configuration is disabled for: ${siteName}` } }));
      return;
    }

    const history = await mongooseClient.create<any>(migrationHistory as any, {
      createdDate: dateTimeNowAsValue(),
      siteIdentifier: siteConfig.siteIdentifier,
      siteName: siteConfig.name,
      persistData,
      uploadTos3,
      status: "running",
      auditLog: []
    });

    jobId = crypto.randomUUID();
    registerMigrationSession({
      jobId,
      ws,
      siteIdentifier: siteConfig.siteIdentifier,
      siteName: siteConfig.name,
      historyId: (history as any).id,
      startedAt: Date.now()
    });

    const historyLite = {
      id: (history as any).id,
      createdDate: (history as any).createdDate,
      status: "running",
      siteIdentifier: siteConfig.siteIdentifier,
      siteName: siteConfig.name,
      auditLog: []
    } as any;
    ws.send(JSON.stringify({ type: MessageType.PROGRESS, data: { message: `Migration started for ${siteConfig.name}`, historyRef: { id: (history as any).id, createdDate: (history as any).createdDate, status: "running" }, history: historyLite } }));

    try {
      await submitMigrationJobToIntegrationWorker(jobId, siteConfig, persistData, uploadTos3);
      debugLog("migration job submitted jobId:", jobId, "siteIdentifier:", siteConfig.siteIdentifier);
    } catch (submitError) {
      completeMigrationSession(jobId);
      jobId = null;
      throw submitError;
    }
  } catch (error) {
    const message = (error as Error)?.message || "Migration failed";
    debugLog("handleSiteMigration error:", message);
    ws.send(JSON.stringify({ type: MessageType.ERROR, data: { message } }));
    if (jobId) {
      completeMigrationSession(jobId);
    }
  }
}
