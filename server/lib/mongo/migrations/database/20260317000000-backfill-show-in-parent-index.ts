import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { PageContentType } from "../../../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { PAGE_CONTENT_COLLECTION } from "../shared/collection-names";

const debugLog = createMigrationLogger("backfill-show-in-parent-index");

export async function up(db: Db, client: MongoClient) {
  const collection = db.collection(PAGE_CONTENT_COLLECTION);

  const albumIndexPages = await collection.find({
    "rows.type": PageContentType.ALBUM_INDEX,
    "rows.albumIndex": {$exists: true}
  }).toArray();

  debugLog(`Found ${albumIndexPages.length} pages with album-index rows`);

  let updatedCount = 0;

  for (const page of albumIndexPages) {
    let modified = false;
    const updatedRows = page.rows.map((row: any) => {
      if (row.type === PageContentType.ALBUM_INDEX && row.albumIndex && row.albumIndex.showInParentIndex === undefined) {
        modified = true;
        return {...row, albumIndex: {...row.albumIndex, showInParentIndex: true}};
      }
      return row;
    });

    if (modified) {
      await collection.updateOne({_id: page._id}, {$set: {rows: updatedRows}});
      updatedCount++;
      debugLog(`Set showInParentIndex=true on page: ${page.path}`);
    }
  }

  debugLog(`Backfilled showInParentIndex on ${updatedCount} of ${albumIndexPages.length} pages`);
}

export async function down(db: Db, client: MongoClient) {
  const collection = db.collection(PAGE_CONTENT_COLLECTION);

  const albumIndexPages = await collection.find({
    "rows.type": PageContentType.ALBUM_INDEX,
    "rows.albumIndex.showInParentIndex": true
  }).toArray();

  debugLog(`Found ${albumIndexPages.length} pages with showInParentIndex=true`);

  let updatedCount = 0;

  for (const page of albumIndexPages) {
    let modified = false;
    const updatedRows = page.rows.map((row: any) => {
      if (row.type === PageContentType.ALBUM_INDEX && row.albumIndex?.showInParentIndex === true) {
        modified = true;
        const {showInParentIndex, ...rest} = row.albumIndex;
        return {...row, albumIndex: rest};
      }
      return row;
    });

    if (modified) {
      await collection.updateOne({_id: page._id}, {$set: {rows: updatedRows}});
      updatedCount++;
      debugLog(`Removed showInParentIndex from page: ${page.path}`);
    }
  }

  debugLog(`Rolled back showInParentIndex on ${updatedCount} pages`);
}
