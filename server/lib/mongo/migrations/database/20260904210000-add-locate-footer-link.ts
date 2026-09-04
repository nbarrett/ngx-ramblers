import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { systemConfigWithGeometry } from "../../../config/system-config";
import { createOrUpdateKey } from "../../controllers/config";
import { ConfigKey } from "../../../../../projects/ngx-ramblers/src/app/models/config.model";
import { LOCATE_PAGE_PATH, LOCATE_PAGE_TITLE } from "../../../../../projects/ngx-ramblers/src/app/models/locate.model";
import { VERSION_PAGE_PATH } from "../../../../../projects/ngx-ramblers/src/app/models/build-version.model";

const debugLog = createMigrationLogger("add-locate-footer-link");
const LOCATE_HREF = `/${LOCATE_PAGE_PATH}`;

function pathOf(link: { href?: string }): string {
  return (link?.href || "").trim().toLowerCase().replace(/^\//, "");
}

export async function up(_db: Db, _client: MongoClient) {
  const config = await systemConfigWithGeometry();
  if (config) {
    config.footer = config.footer || {appDownloads: {apple: null, google: null}, legals: [], pages: [], quickLinks: []};
    const links = (config.footer.quickLinks || []).filter(link => pathOf(link) !== LOCATE_PAGE_PATH);
    const versionIndex = links.findIndex(link => pathOf(link) === VERSION_PAGE_PATH);
    const locateLink = {href: LOCATE_HREF, title: LOCATE_PAGE_TITLE};
    config.footer.quickLinks = versionIndex >= 0 ? [...links.slice(0, versionIndex), locateLink, ...links.slice(versionIndex)] : [...links, locateLink];
    await createOrUpdateKey(ConfigKey.SYSTEM, config);
    debugLog(`Added "${LOCATE_PAGE_TITLE}" link to footer.quickLinks (${config.footer.quickLinks.length} quick links total)`);
  } else {
    debugLog("No system config found - skipping locate footer link");
  }
}

export async function down(_db: Db, _client: MongoClient) {
  const config = await systemConfigWithGeometry();
  if (config?.footer?.quickLinks) {
    config.footer.quickLinks = config.footer.quickLinks.filter(link => pathOf(link) !== LOCATE_PAGE_PATH);
    await createOrUpdateKey(ConfigKey.SYSTEM, config);
    debugLog(`Removed "${LOCATE_PAGE_TITLE}" link from footer.quickLinks`);
  }
}
