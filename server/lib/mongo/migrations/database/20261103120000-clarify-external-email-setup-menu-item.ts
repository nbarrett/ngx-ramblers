import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { syncActionButtonDetailsByHref } from "../shared/page-content-actions";
import { EXTERNAL_EMAIL_SETUP_MENU_ITEM } from "../shared/admin-menu-items";
import { AdminProfilePath } from "../../../../../projects/ngx-ramblers/src/app/models/admin-route-paths.model";

const debugLog = createMigrationLogger("clarify-external-email-setup-menu-item");
const TARGET_PATH = `${AdminProfilePath.ROOT}#action-buttons`;

export async function up(db: Db, _client: MongoClient) {
  debugLog("Updating External Email Setup profile menu copy");
  const updated = await syncActionButtonDetailsByHref(db, TARGET_PATH, [EXTERNAL_EMAIL_SETUP_MENU_ITEM], debugLog);
  if (updated) {
    debugLog("External Email Setup profile menu copy updated");
  } else {
    debugLog("External Email Setup profile menu copy already matched or item missing");
  }
}

export async function down(_db: Db, _client: MongoClient) {
  debugLog("No down migration - External Email Setup menu copy is intentionally left in place");
}
