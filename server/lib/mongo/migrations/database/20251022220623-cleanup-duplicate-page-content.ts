import { Db, MongoClient, ObjectId } from "mongodb";
import { isArray, isEqual, isString } from "es-toolkit/compat";
import createMigrationLogger from "../migrations-logger";

const debugLog = createMigrationLogger("cleanup-and-inline-page-content");

export async function up(db: Db, client: MongoClient) {
    const pageContentCollection = db.collection("pageContent");
    const contentTextCollection = db.collection("contentText");

    debugLog("Step 1: Cleanup duplicate page content entries...");

    const duplicates = await pageContentCollection.aggregate([
      {
        $group: {
          _id: "$path",
          count: { $sum: 1 },
          docs: { $push: { id: "$_id", updatedAt: "$updatedAt", rowCount: { $size: { $ifNull: ["$rows", []] } } } }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      }
    ]).toArray();

    debugLog(`Found ${duplicates.length} paths with duplicates`);

    let totalDeleted = 0;

    for (const duplicate of duplicates) {
      const path = duplicate._id;
      const duplicateDocs = duplicate.docs;

      duplicateDocs.sort((a: any, b: any) => {
        if (a.updatedAt && b.updatedAt) {
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        }
        if (a.updatedAt) return -1;
        if (b.updatedAt) return 1;
        return b.rowCount - a.rowCount;
      });

      const [keep, ...remove] = duplicateDocs;

      debugLog(`Path "${path}": keeping ${keep.id}, removing ${remove.length} duplicate(s)`);

      for (const doc of remove) {
        await pageContentCollection.deleteOne({ _id: doc.id });
        totalDeleted++;
      }
    }

    debugLog(`Deleted ${totalDeleted} duplicate documents`);

    debugLog("Creating unique index on path field...");
    await pageContentCollection.createIndex({ path: 1 }, { unique: true });

    debugLog("Step 2: Inline content text references...");

    const docs = await pageContentCollection.find({}).toArray();
    debugLog(`Found ${docs.length} page content documents to scan`);

    let updated = 0;

    async function migrateRows(rows: any): Promise<any> {
      if (!rows || !isArray(rows)) return rows;

      const migratedRows: any[] = [];
      for (const row of rows) {
        const newRow: any = { ...row, columns: [] };

        for (const col of row.columns || []) {
          const newCol: any = { ...col };

          if (newCol.contentTextId && !newCol.contentText) {
            const contentTextId = newCol.contentTextId;
            try {
              const _id = isString(contentTextId) ? new ObjectId(contentTextId) : contentTextId;
              const contentTextDoc = await contentTextCollection.findOne({ _id });
              if (contentTextDoc) {
                newCol.contentText = contentTextDoc.text || "";
                delete newCol.contentTextId;
                debugLog(`  Inlined contentTextId ${contentTextId}`);
              }
            } catch (error: any) {
              debugLog(`  Failed to inline contentTextId ${contentTextId}:`, error.message);
            }
          }

          if (newCol.rows) {
            newCol.rows = await migrateRows(newCol.rows);
          }

          newRow.columns.push(newCol);
        }

        migratedRows.push(newRow);
      }

      return migratedRows;
    }

    for (const doc of docs) {
      const migratedRows = await migrateRows(doc.rows || []);
      const hasChanged = !isEqual(doc.rows, migratedRows);

      if (hasChanged) {
        await pageContentCollection.updateOne(
          { _id: doc._id },
          { $set: { rows: migratedRows } }
        );
        debugLog(`Updated path: ${doc.path}`);
        updated++;
      }
    }

    debugLog(`Migration completed: ${totalDeleted} duplicates removed, ${updated} documents updated with inlined content out of ${docs.length} scanned`);
}

export async function down(db: Db, client: MongoClient) {
    const pageContentCollection = db.collection("pageContent");

    debugLog("Removing unique index on path field...");
    try {
      await pageContentCollection.dropIndex("path_1");
      debugLog("Index removed successfully");
    } catch (error: any) {
      debugLog("Index may not exist or already removed:", error.message);
    }

    debugLog("Content inlining cannot be automatically rolled back");
    debugLog("Manual restoration from backup would be required");
}
