import { Db } from "mongodb";
import { PAGE_CONTENT_COLLECTION } from "../../../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { AdminPath } from "../../../../../projects/ngx-ramblers/src/app/models/admin-route-paths.model";
import { ensureActionButton, removeActionButtonByHref, syncActionButtonDetailsByHref } from "./page-content-actions";
import { ADMIN_CATEGORY_MENU_ITEMS, SEND_NOTIFICATION_MENU_ITEM } from "./admin-menu-items";

type MigrationLog = (message: string, ...args: any[]) => void;

const ADMIN_ACTION_BUTTONS_PATH = "admin#action-buttons";
const CONTENT_ACTION_BUTTONS_PATH = "admin/content#action-buttons";
const OLD_BANNERS_HREF = "admin/content/banners";

export async function updateAdminLandingButtonHref(db: Db, oldHref: string, newHref: string, log: MigrationLog): Promise<void> {
  const collection = db.collection(PAGE_CONTENT_COLLECTION);
  const doc = await collection.findOne({ path: ADMIN_ACTION_BUTTONS_PATH }, { sort: { _id: 1 } });
  if (!doc) {
    return;
  }
  const rowIndex = (doc.rows || []).findIndex((row: any) => row?.type === "action-buttons");
  if (rowIndex < 0) {
    return;
  }
  const columns: any[] = doc.rows[rowIndex].columns || [];
  const index = columns.findIndex(column => column?.href === oldHref);
  if (index < 0) {
    return;
  }
  await collection.updateOne(
    { _id: doc._id },
    { $set: { [`rows.${rowIndex}.columns.${index}.href`]: newHref } }
  );
  log("Updated admin landing button href from %s to %s", oldHref, newHref);
}

export async function pullBannersOntoAdminLanding(db: Db, log: MigrationLog): Promise<void> {
  const bannersItem = ADMIN_CATEGORY_MENU_ITEMS.find(item => item.href === AdminPath.BANNERS);
  if (!bannersItem) {
    return;
  }
  await removeActionButtonByHref(db, CONTENT_ACTION_BUTTONS_PATH, OLD_BANNERS_HREF, log);
  await updateAdminLandingButtonHref(db, OLD_BANNERS_HREF, AdminPath.BANNERS, log);
  const added = await ensureActionButton(db, ADMIN_ACTION_BUTTONS_PATH, bannersItem, log);
  if (added) {
    log("Configure Banners button pulled up onto the admin landing page so it's reachable in NGX-Lite mode");
  }
}

export async function renameSendNotificationToEmailComposer(db: Db, log: MigrationLog): Promise<void> {
  const updated = await syncActionButtonDetailsByHref(db, ADMIN_ACTION_BUTTONS_PATH, [SEND_NOTIFICATION_MENU_ITEM], log);
  if (updated > 0) {
    log("Renamed Send Notification button to %s on the admin landing page", SEND_NOTIFICATION_MENU_ITEM.title);
  }
}
