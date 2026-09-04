import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { systemConfigWithGeometry } from "../../../config/system-config";
import { createOrUpdateKey } from "../../controllers/config";
import { ConfigKey } from "../../../../../projects/ngx-ramblers/src/app/models/config.model";
import { LEGACY_VERSION_PAGE_PATH, VERSION_PAGE_PATH } from "../../../../../projects/ngx-ramblers/src/app/models/build-version.model";

const debugLog = createMigrationLogger("add-version-footer-link");
const VERSION_HREF = `/${VERSION_PAGE_PATH}`;
const VERSION_TITLE = "About this version";

function isVersionLink(link: { href?: string }): boolean {
  return [VERSION_PAGE_PATH, LEGACY_VERSION_PAGE_PATH].includes((link?.href || "").trim().toLowerCase().replace(/^\//, ""));
}

export async function up(_db: Db, _client: MongoClient) {
  const config = await systemConfigWithGeometry();
  if (config) {
    config.footer = config.footer || {appDownloads: {apple: null, google: null}, legals: [], pages: [], quickLinks: []};
    config.footer.quickLinks = (config.footer.quickLinks || []).filter(link => !isVersionLink(link));
    config.footer.quickLinks.push({href: VERSION_HREF, title: VERSION_TITLE});
    await createOrUpdateKey(ConfigKey.SYSTEM, config);
    debugLog(`Added "${VERSION_TITLE}" link to footer.quickLinks in last position (${config.footer.quickLinks.length} quick links total)`);
  } else {
    debugLog("No system config found - skipping version footer link");
  }
}

export async function down(_db: Db, _client: MongoClient) {
  const config = await systemConfigWithGeometry();
  if (config?.footer?.quickLinks) {
    config.footer.quickLinks = config.footer.quickLinks.filter(link => !isVersionLink(link));
    await createOrUpdateKey(ConfigKey.SYSTEM, config);
    debugLog(`Removed "${VERSION_TITLE}" link from footer.quickLinks`);
  }
}
