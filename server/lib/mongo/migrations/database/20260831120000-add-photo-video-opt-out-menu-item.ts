import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { ensureActionButton } from "../shared/page-content-actions";
import { PHOTO_VIDEO_OPT_OUT_MENU_ITEM } from "../shared/admin-menu-items";
import { AdminProfilePath } from "../../../../../projects/ngx-ramblers/src/app/models/admin-route-paths.model";

const debugLog = createMigrationLogger("add-photo-video-opt-out-menu-item");
const TARGET_PATH = `${AdminProfilePath.ROOT}#action-buttons`;

export async function up(db: Db, _client: MongoClient) {
  debugLog("Adding Photos and video menu item to profile action buttons");
  const added = await ensureActionButton(db, TARGET_PATH, PHOTO_VIDEO_OPT_OUT_MENU_ITEM, debugLog);
  if (added) {
    debugLog("Photos and video menu item added successfully");
  } else {
    debugLog("Photos and video menu item already exists or could not be added");
  }
}

export async function down(_db: Db, _client: MongoClient) {
  debugLog("No down migration - Photos and video menu item is intentionally left in place");
}
