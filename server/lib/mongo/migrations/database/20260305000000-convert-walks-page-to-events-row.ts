import { Db } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { dateTimeNow } from "../../../shared/dates";

const debugLog = createMigrationLogger("convert-walks-page-to-events-row");
const PAGE_CONTENT_COLLECTION = "pageContent";
const WALKS_ROOT_PATH = "walks";
const WALKS_PAGE_HEADER_PATH = "walks#page-header";
const WALKS_ACTION_BUTTONS_PATH = "walks#action-buttons";

function createEventsRow() {
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
      eventTypes: ["group-walk"],
      fromDate: now.toMillis(),
      toDate: now.plus({years: 1}).toMillis(),
      filterCriteria: "FUTURE_EVENTS",
      sortOrder: "DATE_ASCENDING"
    }
  };
}

export async function up(db: Db) {
  const collection = db.collection(PAGE_CONTENT_COLLECTION);

  const existingRoot = await collection.findOne({path: WALKS_ROOT_PATH});
  if (existingRoot) {
    const hasEventsRow = (existingRoot.rows || []).some((row: any) => row?.type === "events");
    if (hasEventsRow) {
      debugLog("Walks page at %s already has an events row, skipping", WALKS_ROOT_PATH);
      return {skipped: true, reason: "Events row already exists on walks root page"};
    }
    const updatedRows = [...(existingRoot.rows || []), createEventsRow()];
    await collection.updateOne({_id: existingRoot._id}, {$set: {rows: updatedRows}});
    debugLog("Added events row to existing walks root page at %s", WALKS_ROOT_PATH);
    return;
  }

  const rows: any[] = [];

  const pageHeader = await collection.findOne({path: WALKS_PAGE_HEADER_PATH});
  if (pageHeader?.rows) {
    rows.push(...pageHeader.rows);
  }

  rows.push(createEventsRow());

  const actionButtons = await collection.findOne({path: WALKS_ACTION_BUTTONS_PATH});
  if (actionButtons?.rows) {
    rows.push(...actionButtons.rows);
  }

  if (rows.length === 0) {
    debugLog("No walks page content found to migrate, skipping");
    return {skipped: true, reason: "No walks page content found at any expected path"};
  }

  await collection.insertOne({path: WALKS_ROOT_PATH, rows});
  debugLog("Created walks root page at %s with %d rows assembled from header, events, and action buttons", WALKS_ROOT_PATH, rows.length);
}

export async function down(db: Db) {
  const collection = db.collection(PAGE_CONTENT_COLLECTION);
  await collection.deleteOne({path: WALKS_ROOT_PATH});
  debugLog("Removed walks root page at %s", WALKS_ROOT_PATH);
}
