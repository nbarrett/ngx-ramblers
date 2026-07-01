import { Db } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { pullBannersOntoAdminLanding, renameSendNotificationToEmailComposer } from "../shared/admin-menu-actions";
import { deduplicateActionButtonsByHref, deduplicatePageContentDocuments, ensureActionButton, ensureActionButtons, removeActionButtonByHref } from "../shared/page-content-actions";
import {
  ADMIN_CATEGORY_MENU_ITEMS,
  CONTENT_MENU_ITEMS,
  INBOX_MENU_ITEM,
  MEMBERS_MENU_ITEMS,
  PLATFORM_MENU_ITEMS,
  PROFILE_MENU_ITEMS,
  SEND_NOTIFICATION_MENU_ITEM,
  SETTINGS_MENU_ITEMS
} from "../shared/admin-menu-items";
import {
  AdminContentPath,
  AdminPath,
  AdminPlatformPath
} from "../../../../../projects/ngx-ramblers/src/app/models/admin-route-paths.model";

const debugLog = createMigrationLogger("reorganise-admin-menu-into-categories");

const PAGE_CONTENT_COLLECTION = "pageContent";

const ADMIN_PATH = "admin#action-buttons";
const MEMBERS_PATH = "admin/members#action-buttons";
const OLD_ENV_MGMT_PATH = "admin/environment-management#action-buttons";
const NEW_ENV_MGMT_PATH = `${AdminPlatformPath.ENVIRONMENT_MANAGEMENT}#action-buttons`;
const OLD_ENV_MGMT_HREF_PREFIX = "admin/environment-management/";
const NEW_ENV_MGMT_HREF_PREFIX = `${AdminPlatformPath.ENVIRONMENT_MANAGEMENT}/`;
const DUPLICATE_CONTENT_HREF = "admin/content/duplicate-page-content-navigator";
const ENVIRONMENT_MAINTENANCE_HREF = AdminPlatformPath.ENVIRONMENT_MANAGEMENT_MAINTENANCE;
const LEGACY_ADMIN_CONTENT_LINKS = [
  { from: "admin/page-content-navigator", to: AdminContentPath.PAGE_CONTENT_NAVIGATOR },
  { from: "admin/content-templates", to: AdminContentPath.CONTENT_TEMPLATES },
];
const CATEGORY_PATHS: { path: string; items: typeof PROFILE_MENU_ITEMS }[] = [
  { path: "admin/profile#action-buttons", items: PROFILE_MENU_ITEMS },
  { path: MEMBERS_PATH, items: MEMBERS_MENU_ITEMS },
  { path: "admin/content#action-buttons", items: CONTENT_MENU_ITEMS },
  { path: "admin/settings#action-buttons", items: SETTINGS_MENU_ITEMS },
  { path: "admin/platform#action-buttons", items: PLATFORM_MENU_ITEMS },
];

async function ensurePageContentDocumentExists(db: Db, path: string): Promise<boolean> {
  const collection = db.collection(PAGE_CONTENT_COLLECTION);
  await deduplicatePageContentDocuments(db, path, debugLog);
  const existing = await collection.findOne({ path }, { sort: { _id: 1 } });
  if (existing) {
    debugLog("Page content document already exists for %s", path);
    return false;
  }
  await collection.insertOne({
    path,
    rows: [{
      maxColumns: 3,
      showSwiper: false,
      type: "action-buttons",
      columns: []
    }]
  });
  debugLog("Created page content document for %s", path);
  return true;
}

async function replaceAdminLandingButtons(db: Db): Promise<void> {
  const collection = db.collection(PAGE_CONTENT_COLLECTION);
  await deduplicatePageContentDocuments(db, ADMIN_PATH, debugLog);
  let target = await collection.findOne({ path: ADMIN_PATH }, { sort: { _id: 1 } });
  if (!target) {
    debugLog("No page content document found for %s, creating one", ADMIN_PATH);
    await collection.insertOne({
      path: ADMIN_PATH,
      rows: [{
        maxColumns: 3,
        showSwiper: false,
        type: "action-buttons",
        columns: []
      }]
    });
    target = await collection.findOne({ path: ADMIN_PATH }, { sort: { _id: 1 } });
  }
  const actionButtonsRow = (target?.rows || []).findIndex(
    (row: any) => row?.type === "action-buttons"
  );
  if (actionButtonsRow < 0) {
    debugLog("No action-buttons row found in %s, cannot replace columns", ADMIN_PATH);
    return;
  }
  const columns = ADMIN_CATEGORY_MENU_ITEMS.map(item => ({
    accessLevel: item.accessLevel,
    title: item.title,
    icon: item.icon,
    href: item.href,
    contentText: item.contentText,
  }));
  const setField = `rows.${actionButtonsRow}.columns`;
  await collection.updateOne(
    { _id: target._id },
    { $set: { [setField]: columns } }
  );
  debugLog("Replaced admin landing page buttons with %d category buttons", columns.length);
}

async function migrateEnvironmentManagementPath(db: Db): Promise<void> {
  const collection = db.collection(PAGE_CONTENT_COLLECTION);
  const existingAtNew = await collection.findOne({ path: NEW_ENV_MGMT_PATH });
  const existingAtOld = await collection.findOne({ path: OLD_ENV_MGMT_PATH });
  if (!existingAtNew && existingAtOld) {
    await collection.updateOne({ _id: existingAtOld._id }, { $set: { path: NEW_ENV_MGMT_PATH } });
    debugLog("Moved page content from %s to %s", OLD_ENV_MGMT_PATH, NEW_ENV_MGMT_PATH);
  }
}

async function fixEnvironmentManagementHrefs(db: Db): Promise<void> {
  const collection = db.collection(PAGE_CONTENT_COLLECTION);
  const doc = await collection.findOne({ path: NEW_ENV_MGMT_PATH });
  if (!doc) {
    return;
  }
  let hrefUpdates = 0;
  const rows = (doc.rows || []).map((row: any) => {
    if (row?.type !== "action-buttons") {
      return row;
    }
    const columns = (row.columns || []).map((col: any) => {
      if (col?.href && col.href.startsWith(OLD_ENV_MGMT_HREF_PREFIX)) {
        hrefUpdates++;
        return { ...col, href: col.href.replace(OLD_ENV_MGMT_HREF_PREFIX, NEW_ENV_MGMT_HREF_PREFIX) };
      }
      return col;
    });
    return { ...row, columns };
  });
  if (hrefUpdates > 0) {
    await collection.updateOne({ _id: doc._id }, { $set: { rows } });
    debugLog("Fixed %d environment management href(s) to use %s prefix", hrefUpdates, NEW_ENV_MGMT_HREF_PREFIX);
  }
}

async function removeDuplicateAndMovedButtons(db: Db): Promise<void> {
  await removeActionButtonByHref(db, MEMBERS_PATH, "send-notification", debugLog);
  await removeActionButtonByHref(db, MEMBERS_PATH, AdminPath.SEND_NOTIFICATION, debugLog);
  await removeActionButtonByHref(db, `${AdminContentPath.ROOT}#action-buttons`, DUPLICATE_CONTENT_HREF, debugLog);
  await removeActionButtonByHref(db, ADMIN_PATH, DUPLICATE_CONTENT_HREF, debugLog);
  await removeActionButtonByHref(db, NEW_ENV_MGMT_PATH, ENVIRONMENT_MAINTENANCE_HREF, debugLog);
}

async function setMembersLandingColumns(db: Db): Promise<void> {
  const collection = db.collection(PAGE_CONTENT_COLLECTION);
  const doc = await collection.findOne({ path: MEMBERS_PATH });
  if (!doc) {
    return;
  }
  const rows = (doc.rows || []).map((row: any) => row?.type === "action-buttons" ? { ...row, maxColumns: 2 } : row);
  await collection.updateOne({ _id: doc._id }, { $set: { rows } });
  debugLog("Set %s action buttons to two columns", MEMBERS_PATH);
}

function replaceLegacyAdminContentLinksInText(text: string): { text: string; changed: boolean } {
  const updatedText = LEGACY_ADMIN_CONTENT_LINKS.reduce((currentText, mapping) =>
    currentText.replace(new RegExp(mapping.from, "g"), mapping.to), text);
  return { text: updatedText, changed: updatedText !== text };
}

function replaceLegacyAdminContentLinksInColumn(column: any): { column: any; changed: boolean } {
  const hrefMapping = LEGACY_ADMIN_CONTENT_LINKS.find(mapping => column?.href === mapping.from || column?.href?.startsWith(`${mapping.from}?`));
  const contentTextReplacement = column?.contentText ? replaceLegacyAdminContentLinksInText(column.contentText) : { text: column?.contentText, changed: false };
  const rowsReplacement = replaceLegacyAdminContentLinksInRows(column?.rows || []);
  const href = hrefMapping ? column.href.replace(hrefMapping.from, hrefMapping.to) : column?.href;
  const changed = !!hrefMapping || contentTextReplacement.changed || rowsReplacement.changed;
  if (changed) {
    return { column: { ...column, href, contentText: contentTextReplacement.text, rows: rowsReplacement.rows }, changed };
  }
  return { column, changed };
}

function replaceLegacyAdminContentLinksInRows(rows: any[]): { rows: any[]; changed: boolean } {
  let changed = false;
  const updatedRows = rows.map(row => {
    const columns = (row?.columns || []).map((column: any) => {
      const replacement = replaceLegacyAdminContentLinksInColumn(column);
      changed = changed || replacement.changed;
      return replacement.column;
    });
    return changed ? { ...row, columns } : row;
  });
  return { rows: updatedRows, changed };
}

async function moveSendNotificationBeforeMailReports(db: Db): Promise<void> {
  const collection = db.collection(PAGE_CONTENT_COLLECTION);
  const doc = await collection.findOne({ path: ADMIN_PATH }, { sort: { _id: 1 } });
  if (!doc) {
    debugLog("No page content document at %s; nothing to reorder", ADMIN_PATH);
    return;
  }
  const rowIndex = (doc.rows || []).findIndex((row: any) => row?.type === "action-buttons");
  if (rowIndex < 0) {
    debugLog("No action-buttons row in %s; nothing to reorder", ADMIN_PATH);
    return;
  }
  const columns: any[] = doc.rows[rowIndex].columns || [];
  const sendIndex = columns.findIndex(column => column?.href === AdminPath.SEND_NOTIFICATION);
  const mailIndex = columns.findIndex(column => column?.href === AdminPath.MAIL_REPORTS);
  if (sendIndex < 0 || mailIndex < 0 || sendIndex + 1 === mailIndex) {
    return;
  }
  const sendButton = columns[sendIndex];
  const withoutSend = columns.filter((_, index) => index !== sendIndex);
  const insertAt = withoutSend.findIndex(column => column?.href === AdminPath.MAIL_REPORTS);
  const reordered = [...withoutSend.slice(0, insertAt), sendButton, ...withoutSend.slice(insertAt)];
  await collection.updateOne({ _id: doc._id }, { $set: { [`rows.${rowIndex}.columns`]: reordered } });
  debugLog("Moved Send Notification immediately before Mail Reports on the admin landing page");
}

async function movePlatformAdministrationToEnd(db: Db): Promise<void> {
  const collection = db.collection(PAGE_CONTENT_COLLECTION);
  const doc = await collection.findOne({ path: ADMIN_PATH }, { sort: { _id: 1 } });
  if (!doc) {
    debugLog("No page content document at %s; nothing to reorder", ADMIN_PATH);
    return;
  }
  const rowIndex = (doc.rows || []).findIndex((row: any) => row?.type === "action-buttons");
  if (rowIndex < 0) {
    debugLog("No action-buttons row in %s; nothing to reorder", ADMIN_PATH);
    return;
  }
  const columns: any[] = doc.rows[rowIndex].columns || [];
  const platformIndex = columns.findIndex(column => column?.href === AdminPlatformPath.ROOT);
  if (platformIndex < 0 || platformIndex === columns.length - 1) {
    return;
  }
  const platformButton = columns[platformIndex];
  const reordered = [...columns.filter((_, index) => index !== platformIndex), platformButton];
  await collection.updateOne({ _id: doc._id }, { $set: { [`rows.${rowIndex}.columns`]: reordered } });
  debugLog("Moved Platform Administration to the end of the admin landing page");
}

async function adjustAdminMailMenu(db: Db): Promise<void> {
  await moveSendNotificationBeforeMailReports(db);
  const added = await ensureActionButton(db, ADMIN_PATH, INBOX_MENU_ITEM, debugLog);
  if (added) {
    debugLog("Inbox menu item added as the last admin landing button");
  }
  await movePlatformAdministrationToEnd(db);
}

async function updateLegacyAdminContentLinks(db: Db): Promise<void> {
  const collection = db.collection(PAGE_CONTENT_COLLECTION);
  const documents = await collection.find({
    $or: LEGACY_ADMIN_CONTENT_LINKS.flatMap(mapping => [
      { "rows.columns.href": mapping.from },
      { "rows.columns.href": { $regex: `^${mapping.from}\\?` } },
      { "rows.columns.contentText": { $regex: mapping.from } },
    ])
  }).toArray();
  for (const document of documents) {
    const replacement = replaceLegacyAdminContentLinksInRows(document.rows || []);
    if (replacement.changed) {
      await collection.updateOne({ _id: document._id }, { $set: { rows: replacement.rows } });
      debugLog("Updated legacy admin content links in %s", document.path);
    }
  }
}

export async function up(db: Db) {
  debugLog("Reorganising admin menu into category pages");

  await migrateEnvironmentManagementPath(db);
  await fixEnvironmentManagementHrefs(db);
  await replaceAdminLandingButtons(db);

  for (const { path, items } of CATEGORY_PATHS) {
    await ensurePageContentDocumentExists(db, path);
    const addedCount = await ensureActionButtons(db, path, items, debugLog);
    await deduplicateActionButtonsByHref(db, path, debugLog);
    debugLog("Seeded %d action buttons for %s", addedCount, path);
  }
  await removeDuplicateAndMovedButtons(db);
  await setMembersLandingColumns(db);
  await updateLegacyAdminContentLinks(db);
  await adjustAdminMailMenu(db);
  await pullBannersOntoAdminLanding(db, debugLog);
  await renameSendNotificationToEmailComposer(db, debugLog);

  debugLog("Migration complete: admin menu reorganised into categories");
}

export async function down(_db: Db) {
  debugLog("No down migration - admin menu reorganisation is intentionally left in place");
}
