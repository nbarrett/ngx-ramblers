import { Collection, Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";

const debugLog = createMigrationLogger("rename-fragment-index-to-content-templates");
const CONTENT_TEXT_COLLECTION = "content-text";
const PAGE_CONTENT_COLLECTION = "pageContent";
const OLD_NAME = "fragment-index";
const NEW_NAME = "content-templates";
const OLD_HREF = "admin/fragment-index";
const NEW_HREF = "admin/content-templates";
const NEW_TITLE = "Content templates";
const NEW_DESCRIPTION = "Browse shared fragments, user templates, and migration templates with live previews and usage links";
const OLD_TITLE = "Fragment Index";
const OLD_DESCRIPTION = "Lists all Shared Fragments, shows a live preview for each, and links to all pages that reference them";

export async function up(db: Db, client: MongoClient) {
  await renameContentTextEntries(db);
  await renameMenuButtons(db);
}

export async function down(db: Db, client: MongoClient) {
  await revertContentTextEntries(db);
  await revertMenuButtons(db);
}

async function renameContentTextEntries(db: Db) {
  const result = await db.collection(CONTENT_TEXT_COLLECTION).updateMany(
    { category: "admin", name: OLD_NAME },
    { $set: { name: NEW_NAME } }
  );
  debugLog(`Renamed ${result.modifiedCount} admin content text entries to ${NEW_NAME}`);
}

async function renameMenuButtons(db: Db) {
  const collection = db.collection(PAGE_CONTENT_COLLECTION);
  const targets = await fetchPagesWithHref(collection, OLD_HREF);
  await Promise.all(targets.map(async doc => {
    const updatedRows = (doc.rows || []).map(row => ({
      ...row,
      columns: (row.columns || []).map(column => {
        if (normaliseHref(column?.href) === OLD_HREF) {
          return {...column, href: NEW_HREF, title: NEW_TITLE, contentText: NEW_DESCRIPTION};
        }
        return column;
      })
    }));
    await collection.updateOne({ _id: doc._id }, { $set: { rows: updatedRows } });
    debugLog(`Updated content template link inside page content ${doc.path}`);
  }));
}

async function revertContentTextEntries(db: Db) {
  const result = await db.collection(CONTENT_TEXT_COLLECTION).updateMany(
    { category: "admin", name: NEW_NAME },
    { $set: { name: OLD_NAME } }
  );
  debugLog(`Reverted ${result.modifiedCount} admin content text entries to ${OLD_NAME}`);
}

async function revertMenuButtons(db: Db) {
  const collection = db.collection(PAGE_CONTENT_COLLECTION);
  const targets = await fetchPagesWithHref(collection, NEW_HREF);
  await Promise.all(targets.map(async doc => {
    const updatedRows = (doc.rows || []).map(row => ({
      ...row,
      columns: (row.columns || []).map(column => {
        if (normaliseHref(column?.href) === NEW_HREF) {
          return {...column, href: OLD_HREF, title: OLD_TITLE, contentText: OLD_DESCRIPTION};
        }
        return column;
      })
    }));
    await collection.updateOne({ _id: doc._id }, { $set: { rows: updatedRows } });
    debugLog(`Reverted fragment index link inside page content ${doc.path}`);
  }));
}

async function fetchPagesWithHref(collection: Collection, href: string) {
  return collection.find({
    rows: {
      $elemMatch: {
        columns: {
          $elemMatch: { href }
        }
      }
    }
  }).toArray();
}

function normaliseHref(value: string): string {
  return (value || "").trim();
}
