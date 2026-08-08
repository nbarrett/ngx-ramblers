import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { syncActionButtonDetailsByHref } from "../shared/page-content-actions";
import { ESTATE_REBUILD_CAPTURE_MENU_ITEM } from "../shared/admin-menu-items";
import { AdminPlatformPath } from "../../../../../projects/ngx-ramblers/src/app/models/admin-route-paths.model";

const debugLog = createMigrationLogger("rename-estate-rebuild-to-platform-configuration-values");
const TARGET_PATH = `${AdminPlatformPath.ENVIRONMENT_MANAGEMENT}#action-buttons`;

export async function up(db: Db, _client: MongoClient) {
  debugLog("Renaming Estate Rebuild Capture menu item to Platform Configuration Values");
  const updated = await syncActionButtonDetailsByHref(db, TARGET_PATH, [ESTATE_REBUILD_CAPTURE_MENU_ITEM], debugLog);
  if (updated > 0) {
    debugLog("Menu item title updated successfully");
  } else {
    debugLog("Menu item already up to date or not found");
  }
}

export async function down(db: Db, _client: MongoClient) {
  debugLog("No down migration - Platform Configuration Values title is left in place");
}
