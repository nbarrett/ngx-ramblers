import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { ensureActionButton } from "../shared/page-content-actions";
import { SOCIAL_MEDIA_PUBLISHING_MENU_ITEM } from "../shared/admin-menu-items";

const debugLog = createMigrationLogger("add-social-media-publishing-menu-item");
const TARGET_PATH = "walks/admin#action-buttons";

export async function up(db: Db, _client: MongoClient) {
  debugLog("Adding Social Media Publishing menu item to walk admin action buttons");
  const added = await ensureActionButton(db, TARGET_PATH, SOCIAL_MEDIA_PUBLISHING_MENU_ITEM, debugLog);
  if (added) {
    debugLog("Social Media Publishing menu item added successfully");
  } else {
    debugLog("Social Media Publishing menu item already exists or could not be added");
  }
}

export async function down(db: Db, _client: MongoClient) {
  debugLog("No down migration - Social Media Publishing menu item is intentionally left in place");
}
