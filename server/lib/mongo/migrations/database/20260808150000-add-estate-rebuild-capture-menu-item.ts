import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { ensureActionButton } from "../shared/page-content-actions";
import { ESTATE_REBUILD_CAPTURE_MENU_ITEM } from "../shared/admin-menu-items";
import { AdminPlatformPath } from "../../../../../projects/ngx-ramblers/src/app/models/admin-route-paths.model";

const debugLog = createMigrationLogger("add-estate-rebuild-capture-menu-item");
const TARGET_PATH = `${AdminPlatformPath.ENVIRONMENT_MANAGEMENT}#action-buttons`;

export async function up(db: Db, _client: MongoClient) {
  debugLog("Adding Estate Rebuild Capture menu item to environment management action buttons");

  const added = await ensureActionButton(db, TARGET_PATH, ESTATE_REBUILD_CAPTURE_MENU_ITEM, debugLog);

  if (added) {
    debugLog("Estate Rebuild Capture menu item added successfully");
  } else {
    debugLog("Estate Rebuild Capture menu item already exists or could not be added");
  }
}

export async function down(db: Db, _client: MongoClient) {
  debugLog("No down migration - Estate Rebuild Capture menu item is intentionally left in place");
}
