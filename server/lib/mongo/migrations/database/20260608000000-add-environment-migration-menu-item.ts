import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { ensureActionButton } from "../shared/page-content-actions";
import { ENVIRONMENT_MIGRATION_MENU_ITEM } from "../shared/admin-menu-items";

const debugLog = createMigrationLogger("add-environment-migration-menu-item");
const TARGET_PATH = "admin/platform/environment-management#action-buttons";

export async function up(db: Db, client: MongoClient) {
  debugLog("Adding Environment Migration menu item");

  const added = await ensureActionButton(db, TARGET_PATH, ENVIRONMENT_MIGRATION_MENU_ITEM, debugLog);

  if (added) {
    debugLog("Environment Migration menu item added successfully");
  } else {
    debugLog("Environment Migration menu item already exists or could not be added");
  }
}

export async function down(db: Db, client: MongoClient) {
  debugLog("No down migration - Environment Migration menu item is intentionally left in place");
}
