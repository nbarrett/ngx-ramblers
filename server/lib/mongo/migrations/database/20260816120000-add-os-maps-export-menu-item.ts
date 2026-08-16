import { Db, MongoClient } from "mongodb";
import { BuiltInAnchor } from "../../../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { DEFAULT_WALKS_AREA, walksAdminPath } from "../../../../../projects/ngx-ramblers/src/app/models/walks-route-paths.model";
import createMigrationLogger from "../migrations-logger";
import { ensureActionButton } from "../shared/page-content-actions";
import { OS_MAPS_EXPORT_MENU_ITEM } from "../shared/admin-menu-items";

const debugLog = createMigrationLogger("add-os-maps-export-menu-item");
const TARGET_PATH = `${walksAdminPath(DEFAULT_WALKS_AREA)}#${BuiltInAnchor.ACTION_BUTTONS}`;

export async function up(db: Db, _client: MongoClient) {
  debugLog("Adding OS Maps Routes menu item to walk admin action buttons");
  const added = await ensureActionButton(db, TARGET_PATH, OS_MAPS_EXPORT_MENU_ITEM, debugLog);
  if (added) {
    debugLog("OS Maps Routes menu item added successfully");
  } else {
    debugLog("OS Maps Routes menu item already exists or could not be added");
  }
}

export async function down(_db: Db, _client: MongoClient) {
  debugLog("No down migration - OS Maps Routes menu item is intentionally left in place");
}
