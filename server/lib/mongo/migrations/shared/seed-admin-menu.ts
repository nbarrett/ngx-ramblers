import { Db } from "mongodb";
import {
  ActionButtonColumn,
  PAGE_CONTENT_COLLECTION,
  PageContentType
} from "../../../../../projects/ngx-ramblers/src/app/models/content-text.model";
import {
  AdminContentPath,
  AdminMembersPath,
  AdminPath,
  AdminPlatformPath,
  AdminProfilePath,
  AdminSettingsPath
} from "../../../../../projects/ngx-ramblers/src/app/models/admin-route-paths.model";
import {
  ADMIN_CATEGORY_MENU_ITEMS,
  CONTENT_MENU_ITEMS,
  ENVIRONMENT_MANAGEMENT_MENU_ITEMS,
  MEMBERS_MENU_ITEMS,
  PLATFORM_MENU_ITEMS,
  PROFILE_MENU_ITEMS,
  SETTINGS_MENU_ITEMS
} from "./admin-menu-items";
import { deduplicateActionButtonsByHref, ensureActionButtons } from "./page-content-actions";

const ADMIN_LANDING_PATH = `${AdminPath.ADMIN}#action-buttons`;

const CATEGORY_PAGES: { path: string; items: ActionButtonColumn[] }[] = [
  { path: `${AdminProfilePath.ROOT}#action-buttons`, items: PROFILE_MENU_ITEMS },
  { path: `${AdminMembersPath.ROOT}#action-buttons`, items: MEMBERS_MENU_ITEMS },
  { path: `${AdminContentPath.ROOT}#action-buttons`, items: CONTENT_MENU_ITEMS },
  { path: `${AdminSettingsPath.ROOT}#action-buttons`, items: SETTINGS_MENU_ITEMS },
  { path: `${AdminPlatformPath.ROOT}#action-buttons`, items: PLATFORM_MENU_ITEMS },
  { path: `${AdminPlatformPath.ENVIRONMENT_MANAGEMENT}#action-buttons`, items: ENVIRONMENT_MANAGEMENT_MENU_ITEMS }
];

function actionButtonsDocument(path: string, columns: ActionButtonColumn[]) {
  return {
    path,
    rows: [{
      maxColumns: 3,
      showSwiper: false,
      type: PageContentType.ACTION_BUTTONS,
      columns: columns.map(item => ({
        accessLevel: item.accessLevel,
        title: item.title,
        icon: item.icon,
        href: item.href,
        contentText: item.contentText
      }))
    }]
  };
}

export async function replaceActionButtonsAtPath(
  db: Db,
  path: string,
  columns: ActionButtonColumn[],
  log: (message: string) => void = () => {}
): Promise<void> {
  const collection = db.collection(PAGE_CONTENT_COLLECTION);
  const existing = await collection.findOne({ path }, { sort: { _id: 1 } });
  if (!existing) {
    await collection.insertOne(actionButtonsDocument(path, columns));
    log(`Created action buttons page ${path} with ${columns.length} items`);
  } else {
    const rowIndex = (existing.rows || []).findIndex((row: { type?: string }) => row?.type === PageContentType.ACTION_BUTTONS);
    if (rowIndex < 0) {
      await collection.updateOne(
        { _id: existing._id },
        {
          $set: {
            rows: actionButtonsDocument(path, columns).rows
          }
        }
      );
      log(`Replaced rows on ${path} with action-buttons containing ${columns.length} items`);
    } else {
      await collection.updateOne(
        { _id: existing._id },
        { $set: { [`rows.${rowIndex}.columns`]: actionButtonsDocument(path, columns).rows[0].columns } }
      );
      log(`Replaced action buttons on ${path} with ${columns.length} items`);
    }
  }
}

export async function seedAdminMenuStructure(db: Db, log: (message: string) => void = () => {}): Promise<void> {
  log("Seeding admin menu from shared category definitions");
  await replaceActionButtonsAtPath(db, ADMIN_LANDING_PATH, ADMIN_CATEGORY_MENU_ITEMS, log);
  await CATEGORY_PAGES.reduce(async (previous, page) => {
    await previous;
    const existing = await db.collection(PAGE_CONTENT_COLLECTION).findOne({ path: page.path });
    if (!existing) {
      await db.collection(PAGE_CONTENT_COLLECTION).insertOne(actionButtonsDocument(page.path, []));
      log(`Created empty category page ${page.path}`);
    }
    const added = await ensureActionButtons(db, page.path, page.items, log);
    await deduplicateActionButtonsByHref(db, page.path, log);
    log(`Category page ${page.path}: ${added} items added`);
  }, Promise.resolve());
  log("Admin menu structure seeded");
}
