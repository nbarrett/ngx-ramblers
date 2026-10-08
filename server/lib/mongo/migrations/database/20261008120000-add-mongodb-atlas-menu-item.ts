import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { ensureActionButton } from "../shared/page-content-actions";
import { ATLAS_MENU_ITEM } from "../shared/admin-menu-items";
import { AdminPlatformPath } from "../../../../../projects/ngx-ramblers/src/app/models/admin-route-paths.model";

const debugLog = createMigrationLogger("add-mongodb-atlas-menu-item");
const TARGET_PATH = `${AdminPlatformPath.ENVIRONMENT_MANAGEMENT}#action-buttons`;

export async function up(db: Db, _client: MongoClient) {
  debugLog("Adding MongoDB Atlas menu item to environment management action buttons");
  const added = await ensureActionButton(db, TARGET_PATH, ATLAS_MENU_ITEM, debugLog);
  if (added) {
    debugLog("MongoDB Atlas menu item added successfully");
  } else {
    debugLog("MongoDB Atlas menu item already exists or could not be added");
  }
}

export async function down(_db: Db, _client: MongoClient) {
  debugLog("No down migration - MongoDB Atlas menu item is intentionally left in place");
}
