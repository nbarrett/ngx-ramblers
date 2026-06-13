import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { systemConfig } from "../../../config/system-config";
import { createOrUpdateKey } from "../../controllers/config";
import { ConfigKey } from "../../../../../projects/ngx-ramblers/src/app/models/config.model";

const debugLog = createMigrationLogger("add-site-map-footer-link");
const SITE_MAP_HREF = "/site-map";
const SITE_MAP_TITLE = "Site map";

function isSiteMapLink(link: { href?: string }): boolean {
  return (link?.href || "").trim().toLowerCase().replace(/^\//, "") === "site-map";
}

export async function up(_db: Db, _client: MongoClient) {
  const config = await systemConfig();
  if (config) {
    config.footer = config.footer || {appDownloads: {apple: null, google: null}, legals: [], pages: [], quickLinks: []};
    config.footer.quickLinks = (config.footer.quickLinks || []).filter(link => !isSiteMapLink(link));
    config.footer.quickLinks.push({href: SITE_MAP_HREF, title: SITE_MAP_TITLE});
    await createOrUpdateKey(ConfigKey.SYSTEM, config);
    debugLog(`Added "${SITE_MAP_TITLE}" link to footer.quickLinks in last position (${config.footer.quickLinks.length} quick links total)`);
  } else {
    debugLog("No system config found - skipping site map footer link");
  }
}

export async function down(_db: Db, _client: MongoClient) {
  const config = await systemConfig();
  if (config?.footer?.quickLinks) {
    config.footer.quickLinks = config.footer.quickLinks.filter(link => !isSiteMapLink(link));
    await createOrUpdateKey(ConfigKey.SYSTEM, config);
    debugLog(`Removed "${SITE_MAP_TITLE}" link from footer.quickLinks`);
  }
}
