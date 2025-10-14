import WebSocket from "ws";
import { ApiAction } from "../../../projects/ngx-ramblers/src/app/models/api-response.model";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import * as configController from "../mongo/controllers/config";
import {
  MigrationConfig,
  SiteMigrationConfig
} from "../../../projects/ngx-ramblers/src/app/models/migration-config.model";
import { pluraliseWithCount } from "../shared/string-utils";
import { MessageType } from "../../../projects/ngx-ramblers/src/app/models/websocket.model";
import { setErrorSender, setProgressSender } from "./migration-progress";
import { migrateStaticSite } from "./migrate-static-site-engine";
import * as mongooseClient from "../mongo/mongoose-client";
import { migrationHistory } from "../mongo/models/migration-history";

export async function handleSiteMigration(ws: WebSocket, data: any): Promise<void> {
  try {
    const history = await mongooseClient.create<any>(migrationHistory as any, {
      createdDate: Date.now(),
      siteIdentifier: data?.siteName,
      siteName: data?.siteName,
      persistData: `${data?.persistData}` === "true" || data?.persistData === true,
      uploadTos3: `${data?.uploadTos3}` === "true" || data?.uploadTos3 === true,
      status: "running",
      auditLog: []
    });
    const recordProgress = async (payload: any, status: string = "info") => {
      try {
        const message = payload?.message || (typeof payload === "string" ? payload : `[${status}]`);
        const log = { time: Date.now(), status, message };
        await mongooseClient.upsert<any>(migrationHistory as any, { _id: (history as any).id }, { ...history, auditLog: [...(history as any).auditLog, log] } as any);
        (history as any).auditLog.push(log);
      } catch (e) {
      }
    };
    setProgressSender((data: any) => {
      ws.send(JSON.stringify({ type: MessageType.PROGRESS, data }));
      recordProgress(data, "info");
    });
    setErrorSender((data: any) => {
      ws.send(JSON.stringify({ type: MessageType.ERROR, data }));
      recordProgress(data, "error");
    });
    const siteName = data?.siteName;
    const persistData = `${data?.persistData}` === "true" || data?.persistData === true;
    const uploadTos3 = `${data?.uploadTos3}` === "true" || data?.uploadTos3 === true;
    const siteConfigOverride = data?.siteConfig as SiteMigrationConfig | undefined;
    if (!siteName) {
      ws.send(JSON.stringify({ type: MessageType.ERROR, data: { action: ApiAction.QUERY, message: "Site name is required" } }));
      return;
    }
    let siteConfig: SiteMigrationConfig;
    if (siteConfigOverride) {
      siteConfig = siteConfigOverride;
    } else {
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
    const historyRef = { id: (history as any).id, createdDate: (history as any).createdDate, status: "running" };
    const historyLite = {
      id: (history as any).id,
      createdDate: (history as any).createdDate,
      status: "running",
      siteIdentifier: siteConfig.siteIdentifier,
      siteName: siteConfig.name,
      auditLog: []
    } as any;
    ws.send(JSON.stringify({ type: MessageType.PROGRESS, data: { message: `Migration started for ${siteConfig.name}`, historyRef, history: historyLite } }));
    const result = await migrateStaticSite({ ...siteConfig, persistData, uploadTos3 });
    const startMsg = { message: `Starting migration for ${siteConfig.siteIdentifier}` };
    ws.send(JSON.stringify({ type: MessageType.PROGRESS, data: startMsg }));
    await recordProgress(startMsg, "info");
    const summary = `✅ ${siteConfig.siteIdentifier} migration complete: ${pluraliseWithCount(result.pageContents.length, "page")} and ${pluraliseWithCount(result.contentTextItems.length, "content text item")} were migrated, plus ${pluraliseWithCount(result.albums.length, "album")}`;
    ws.send(JSON.stringify({ type: MessageType.COMPLETE, data: { action: ApiAction.UPDATE, response: summary, pageContents: result.pageContents, contentTextItems: result.contentTextItems, albums: result.albums } }));
    try {
      await mongooseClient.upsert<any>(migrationHistory as any, { _id: (history as any).id }, {
        ...history,
        completedDate: Date.now(),
        status: "success",
        summary,
        auditLog: (history as any).auditLog
      } as any);
    } catch (e) {
    }
  } catch (error) {
    const message = error?.message || "Migration failed";
    ws.send(JSON.stringify({ type: MessageType.ERROR, data: { message } }));
  } finally {
    setProgressSender(null);
    setErrorSender(null);
  }
}
