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

export async function handleSiteMigration(ws: WebSocket, data: any): Promise<void> {
  try {
    setProgressSender((data: any) => ws.send(JSON.stringify({ type: MessageType.PROGRESS, data })));
    setErrorSender((data: any) => ws.send(JSON.stringify({ type: MessageType.ERROR, data })));
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
    const result = await migrateStaticSite({ ...siteConfig, persistData, uploadTos3 });
    ws.send(JSON.stringify({ type: MessageType.PROGRESS, data: { message: `Starting migration for ${siteConfig.siteIdentifier}` } }));
    ws.send(JSON.stringify({ type: MessageType.COMPLETE, data: { action: ApiAction.UPDATE, response: `✅ ${siteConfig.siteIdentifier} migration complete: ${pluraliseWithCount(result.pageContents.length, "page")} and ${pluraliseWithCount(result.contentTextItems.length, "content text item")} were migrated, plus ${pluraliseWithCount(result.albums.length, "album")}`, pageContents: result.pageContents, contentTextItems: result.contentTextItems, albums: result.albums } }));
  } catch (error) {
    ws.send(JSON.stringify({ type: MessageType.ERROR, data: { message: error?.message || "Migration failed" } }));
  } finally {
    setProgressSender(null);
    setErrorSender(null);
  }
}
