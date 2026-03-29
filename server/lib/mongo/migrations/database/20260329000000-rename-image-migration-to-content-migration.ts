import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";

const debugLog = createMigrationLogger("rename-image-migration-to-content-migration");
const PAGE_CONTENT_COLLECTION = "pageContent";
const TARGET_PATH = "admin#action-buttons";

export async function up(db: Db, client: MongoClient) {
  debugLog("Renaming Image Migration menu item to Content Migration");

  const collection = db.collection(PAGE_CONTENT_COLLECTION);
  const target = await collection.findOne({ path: TARGET_PATH });

  if (!target) {
    debugLog("No admin page content found");
    return;
  }

  let updated = false;
  const newRows = (target.rows || []).map((row: any) => ({
    ...row,
    columns: (row.columns || []).map((column: any) => {
      if (column.href === "admin/image-migration") {
        updated = true;
        return {
          ...column,
          title: "Content Migration",
          href: "admin/content-migration",
          contentText: "Scan site content for images, PDFs, and documents hosted on external domains and migrate them to S3 storage"
        };
      }
      return column;
    })
  }));

  if (updated) {
    await collection.updateOne({ _id: target._id }, { $set: { rows: newRows } });
    debugLog("Image Migration menu item renamed to Content Migration successfully");
  } else {
    debugLog("Image Migration menu item not found — may have already been renamed");
  }
}

export async function down(db: Db, client: MongoClient) {
  debugLog("No down migration — Content Migration menu item is intentionally left in place");
}
