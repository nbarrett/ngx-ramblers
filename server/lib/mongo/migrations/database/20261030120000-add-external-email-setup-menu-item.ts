import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { ensureActionButton, replaceActionButtonByHref } from "../shared/page-content-actions";
import { EXTERNAL_EMAIL_SETUP_MENU_ITEM } from "../shared/admin-menu-items";
import { AdminProfilePath } from "../../../../../projects/ngx-ramblers/src/app/models/admin-route-paths.model";

const debugLog = createMigrationLogger("add-external-email-setup-menu-item");
const TARGET_PATH = `${AdminProfilePath.ROOT}#action-buttons`;
const PREVIOUS_HREF = "admin/profile/mail-applications";

export async function up(db: Db, _client: MongoClient) {
  debugLog("Adding External Email Setup menu item to profile action buttons");
  const replaced = await replaceActionButtonByHref(db, TARGET_PATH, PREVIOUS_HREF, EXTERNAL_EMAIL_SETUP_MENU_ITEM, debugLog);
  if (replaced) {
    debugLog("External Email Setup menu item updated successfully");
  } else {
    const added = await ensureActionButton(db, TARGET_PATH, EXTERNAL_EMAIL_SETUP_MENU_ITEM, debugLog);
    if (added) {
      debugLog("External Email Setup menu item added successfully");
    } else {
      debugLog("External Email Setup menu item already exists or could not be added");
    }
  }
}

export async function down(_db: Db, _client: MongoClient) {
  debugLog("No down migration - External Email Setup menu item is intentionally left in place");
}
