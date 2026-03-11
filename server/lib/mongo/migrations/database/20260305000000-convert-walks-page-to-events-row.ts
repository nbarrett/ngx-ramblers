import { Db } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { dateTimeNow } from "../../../shared/dates";

const debugLog = createMigrationLogger("convert-walks-page-to-events-row");
const PAGE_CONTENT_COLLECTION = "pageContent";
const CONFIG_COLLECTION = "config";
const SYSTEM_CONFIG_KEY = "system";
const WALKS_ROOT_PATH = "walks";
const WALKS_PAGE_HEADER_PATH = "walks#page-header";
const WALKS_ACTION_BUTTONS_PATH = "walks#action-buttons";
const SOCIAL_CONTENT_ANCHOR = "social-content";
const DEFAULT_SOCIAL_PATH = "social";
const EVENT_TYPE_GROUP_WALK = "group-walk";
const EVENT_TYPE_GROUP_EVENT = "group-event";

function createEventsRow(eventTypes: string[]) {
  const now = dateTimeNow();
  return {
    type: "events",
    showSwiper: false,
    maxColumns: 2,
    columns: [],
    events: {
      minColumns: 2,
      maxColumns: 2,
      allow: {
        addNew: true,
        pagination: true,
        quickSearch: true,
        alert: true,
        autoTitle: true,
        advancedSearch: true,
        viewSelector: true
      },
      eventTypes,
      fromDate: now.toMillis(),
      toDate: now.plus({years: 1}).toMillis(),
      filterCriteria: "FUTURE_EVENTS",
      sortOrder: "DATE_ASCENDING"
    }
  };
}

async function deleteFragmentPages(collection: any, fragmentPaths: string[]) {
  const result = await collection.deleteMany({path: {$in: fragmentPaths}});
  if (result.deletedCount > 0) {
    debugLog("Deleted %d fragment page(s): %o", result.deletedCount, fragmentPaths);
  }
  return result.deletedCount;
}

async function migrateWalksPage(collection: any) {
  const fragmentPaths = [WALKS_PAGE_HEADER_PATH, WALKS_ACTION_BUTTONS_PATH];
  const existingRoot = await collection.findOne({path: WALKS_ROOT_PATH});
  if (existingRoot) {
    const hasEventsRow = (existingRoot.rows || []).some((row: any) => row?.type === "events");
    if (hasEventsRow) {
      const deletedCount = await deleteFragmentPages(collection, fragmentPaths);
      debugLog("Walks page at %s already has an events row — cleaned up %d fragment(s)", WALKS_ROOT_PATH, deletedCount);
      return;
    }
    const updatedRows = [...(existingRoot.rows || []), createEventsRow([EVENT_TYPE_GROUP_WALK])];
    await collection.updateOne({_id: existingRoot._id}, {$set: {rows: updatedRows}});
    await deleteFragmentPages(collection, fragmentPaths);
    debugLog("Added events row to existing walks root page at %s and cleaned up fragments", WALKS_ROOT_PATH);
    return;
  }

  const rows: any[] = [];

  const pageHeader = await collection.findOne({path: WALKS_PAGE_HEADER_PATH});
  if (pageHeader?.rows) {
    rows.push(...pageHeader.rows);
  }

  rows.push(createEventsRow([EVENT_TYPE_GROUP_WALK]));

  const actionButtons = await collection.findOne({path: WALKS_ACTION_BUTTONS_PATH});
  if (actionButtons?.rows) {
    rows.push(...actionButtons.rows);
  }

  if (rows.length === 0) {
    debugLog("No walks page content found to migrate, skipping");
    return;
  }

  await collection.insertOne({path: WALKS_ROOT_PATH, rows});
  await deleteFragmentPages(collection, fragmentPaths);
  debugLog("Created walks root page at %s with %d rows and cleaned up fragments", WALKS_ROOT_PATH, rows.length);
}

async function findSocialPagePath(db: Db): Promise<string> {
  const configCollection = db.collection(CONFIG_COLLECTION);
  const systemConfig = await configCollection.findOne({key: SYSTEM_CONFIG_KEY});
  const pages = systemConfig?.value?.group?.pages || [];
  const socialPage = pages.find((page: any) => page?.href?.toLowerCase() === DEFAULT_SOCIAL_PATH || page?.title?.toLowerCase() === DEFAULT_SOCIAL_PATH);
  const socialPath = socialPage?.href || DEFAULT_SOCIAL_PATH;
  debugLog("Resolved social page path: %s from %d configured pages", socialPath, pages.length);
  return socialPath;
}

async function migrateSocialPage(db: Db, collection: any) {
  const socialPath = await findSocialPagePath(db);
  const socialContentPath = `${socialPath}#${SOCIAL_CONTENT_ANCHOR}`;
  const existingRoot = await collection.findOne({path: socialPath});

  if (existingRoot) {
    const hasEventsRow = (existingRoot.rows || []).some((row: any) => row?.type === "events");
    if (hasEventsRow) {
      const deletedCount = await deleteFragmentPages(collection, [socialContentPath]);
      debugLog("Social page at %s already has an events row — cleaned up %d fragment(s)", socialPath, deletedCount);
      return;
    }
    const updatedRows = [...(existingRoot.rows || []), createEventsRow([EVENT_TYPE_GROUP_EVENT])];
    await collection.updateOne({_id: existingRoot._id}, {$set: {rows: updatedRows}});
    await deleteFragmentPages(collection, [socialContentPath]);
    debugLog("Added events row to existing social root page at %s and cleaned up fragments", socialPath);
    return;
  }

  const fragmentPage = await collection.findOne({path: socialContentPath});
  const rows: any[] = [];

  if (fragmentPage?.rows) {
    fragmentPage.rows.forEach((row: any) => {
      rows.push(row);
    });
  }

  rows.push(createEventsRow([EVENT_TYPE_GROUP_EVENT]));

  if (rows.length === 0) {
    debugLog("No social page content found to migrate, skipping");
    return;
  }

  await collection.insertOne({path: socialPath, rows});
  await deleteFragmentPages(collection, [socialContentPath]);
  debugLog("Created social root page at %s with %d rows and cleaned up fragment at %s", socialPath, rows.length, socialContentPath);
}

export async function up(db: Db) {
  const collection = db.collection(PAGE_CONTENT_COLLECTION);
  await migrateWalksPage(collection);
  await migrateSocialPage(db, collection);
}

export async function down(db: Db) {
  const collection = db.collection(PAGE_CONTENT_COLLECTION);
  const socialPath = await findSocialPagePath(db);
  await collection.deleteOne({path: WALKS_ROOT_PATH});
  await collection.deleteOne({path: socialPath});
  debugLog("Removed walks root page at %s and social root page at %s", WALKS_ROOT_PATH, socialPath);
}
