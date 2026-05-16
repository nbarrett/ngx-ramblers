import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { ensureActionButton } from "../shared/page-content-actions";
import { CONTRIBUTOR_ENVIRONMENT_MENU_ITEM } from "../shared/admin-menu-items";

const debugLog = createMigrationLogger("add-contributor-environment-menu-item");
const TARGET_PATH = "admin#action-buttons";

export async function up(db: Db, client: MongoClient) {
  debugLog("Adding Contributor Environment menu item to admin page");

  const added = await ensureActionButton(db, TARGET_PATH, CONTRIBUTOR_ENVIRONMENT_MENU_ITEM, debugLog);

  if (added) {
    debugLog("Contributor Environment menu item added successfully");
  } else {
    debugLog("Contributor Environment menu item already exists or could not be added");
  }
}

export async function down(db: Db, client: MongoClient) {
  debugLog("No down migration - Contributor Environment menu item is intentionally left in place");
}
