import { Db } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { deduplicateActionButtonsByHref, ensureActionButtons, syncActionButtonDetailsByHref } from "../shared/page-content-actions";
import {
  ADMIN_CATEGORY_MENU_ITEMS,
  CONTENT_MENU_ITEMS,
  ENVIRONMENT_MANAGEMENT_MENU_ITEMS,
  MEMBERS_MENU_ITEMS,
  PLATFORM_MENU_ITEMS,
  PROFILE_MENU_ITEMS,
  SETTINGS_MENU_ITEMS
} from "../shared/admin-menu-items";
import { pullBannersOntoAdminLanding, renameSendNotificationToEmailComposer } from "../shared/admin-menu-actions";
import { AdminPlatformPath } from "../../../../../projects/ngx-ramblers/src/app/models/admin-route-paths.model";

const debugLog = createMigrationLogger("reapply-admin-menu-fixes");

const ADMIN_PATH = "admin#action-buttons";
const MEMBERS_PATH = "admin/members#action-buttons";
const ENVIRONMENT_MANAGEMENT_PATH = `${AdminPlatformPath.ENVIRONMENT_MANAGEMENT}#action-buttons`;
const BUTTON_DETAIL_SYNCS: { path: string; items: typeof MEMBERS_MENU_ITEMS }[] = [
  { path: ADMIN_PATH, items: ADMIN_CATEGORY_MENU_ITEMS },
  { path: "admin/profile#action-buttons", items: PROFILE_MENU_ITEMS },
  { path: MEMBERS_PATH, items: MEMBERS_MENU_ITEMS },
  { path: "admin/content#action-buttons", items: CONTENT_MENU_ITEMS },
  { path: "admin/settings#action-buttons", items: SETTINGS_MENU_ITEMS },
  { path: "admin/platform#action-buttons", items: PLATFORM_MENU_ITEMS },
  { path: ENVIRONMENT_MANAGEMENT_PATH, items: ENVIRONMENT_MANAGEMENT_MENU_ITEMS },
];

export async function up(db: Db) {
  debugLog("Reapplying admin menu fixes for environments that ran an earlier form of the reorganisation");
  const added = await ensureActionButtons(db, MEMBERS_PATH, MEMBERS_MENU_ITEMS, debugLog);
  await deduplicateActionButtonsByHref(db, MEMBERS_PATH, debugLog);
  await pullBannersOntoAdminLanding(db, debugLog);
  await renameSendNotificationToEmailComposer(db, debugLog);
  const updated = await BUTTON_DETAIL_SYNCS.reduce(async (previousPromise, sync) => {
    const total = await previousPromise;
    const updatedCount = await syncActionButtonDetailsByHref(db, sync.path, sync.items, debugLog);
    return total + updatedCount;
  }, Promise.resolve(0));
  debugLog("Reapplied admin menu fixes; %d member buttons added, %d button details synced", added, updated);
}

export async function down(_db: Db) {
  debugLog("No down migration - admin menu fixes are intentionally left in place");
}
