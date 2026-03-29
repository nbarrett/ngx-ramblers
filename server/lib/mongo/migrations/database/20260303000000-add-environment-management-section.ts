import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { ensureActionButton, ensureActionButtons, removeActionButtonByHref } from "../shared/page-content-actions";
import { ENVIRONMENT_MANAGEMENT_MENU_ITEMS } from "../shared/admin-menu-items";
import { PageContentType } from "../../../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { PAGE_CONTENT_COLLECTION } from "../shared/collection-names";

const debugLog = createMigrationLogger("add-environment-management-section");
const ADMIN_PATH = "admin#action-buttons";
const ENVIRONMENT_MANAGEMENT_PATH = "admin/environment-management#action-buttons";

export async function up(db: Db, client: MongoClient) {
  await createEnvironmentManagementPage(db);
  await populateEnvironmentManagementMenu(db);
  await removeMovedItemsFromAdminMenu(db);
  await addEnvironmentManagementToAdminMenu(db);
}

async function createEnvironmentManagementPage(db: Db) {
  const collection = db.collection(PAGE_CONTENT_COLLECTION);
  const existing = await collection.findOne({ path: ENVIRONMENT_MANAGEMENT_PATH });

  if (existing) {
    debugLog("Page content at %s already exists, skipping creation", ENVIRONMENT_MANAGEMENT_PATH);
    return;
  }

  await collection.insertOne({
    path: ENVIRONMENT_MANAGEMENT_PATH,
    rows: [{
      maxColumns: 3,
      showSwiper: false,
      type: PageContentType.ACTION_BUTTONS,
      columns: []
    }]
  });
  debugLog("Created page content at %s", ENVIRONMENT_MANAGEMENT_PATH);
}

async function populateEnvironmentManagementMenu(db: Db) {
  const addedCount = await ensureActionButtons(db, ENVIRONMENT_MANAGEMENT_PATH, ENVIRONMENT_MANAGEMENT_MENU_ITEMS, debugLog);
  debugLog("Added %d environment management menu items", addedCount);
}

async function removeMovedItemsFromAdminMenu(db: Db) {
  const removedItems = [
    "admin/environment-setup",
    "admin/backup-and-restore"
  ];
  let totalRemoved = 0;
  for (const href of removedItems) {
    totalRemoved += await removeActionButtonByHref(db, ADMIN_PATH, href, debugLog);
  }
  debugLog("Removed %d items from admin menu", totalRemoved);
}

async function addEnvironmentManagementToAdminMenu(db: Db) {
  const added = await ensureActionButton(db, ADMIN_PATH, {
    accessLevel: "environmentAdmin",
    title: "Environment Management",
    icon: "faServer",
    href: "admin/environment-management",
    contentText: "Manage environment setup, backups, environments monitoring, and maintenance"
  }, debugLog);

  if (added) {
    debugLog("Added Environment Management menu item to admin page");
  } else {
    debugLog("Environment Management menu item already exists or could not be added");
  }
}

export async function down(db: Db, client: MongoClient) {
  debugLog("No down migration - environment management section is intentionally left in place");
}
