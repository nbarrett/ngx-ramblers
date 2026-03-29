import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { ensureActionButton } from "../shared/page-content-actions";
import { LEGACY_REDIRECTS_MENU_ITEM } from "../shared/admin-menu-items";

const debugLog = createMigrationLogger("add-legacy-redirects-menu-item");
const TARGET_PATH = "admin#action-buttons";

export async function up(db: Db, client: MongoClient) {
  debugLog("Adding Legacy Redirects menu item to admin page");

  const added = await ensureActionButton(db, TARGET_PATH, LEGACY_REDIRECTS_MENU_ITEM, debugLog);

  if (added) {
    debugLog("Legacy Redirects menu item added successfully");
  } else {
    debugLog("Legacy Redirects menu item already exists or could not be added");
  }
}

export async function down(db: Db, client: MongoClient) {
  debugLog("No down migration - Legacy Redirects menu item is intentionally left in place");
}
