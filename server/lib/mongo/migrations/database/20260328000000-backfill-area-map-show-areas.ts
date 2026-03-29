import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { PageContentType } from "../../../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { PAGE_CONTENT_COLLECTION } from "../shared/collection-names";

const debugLog = createMigrationLogger("backfill-area-map-show-areas");

export async function up(db: Db, client: MongoClient) {
  const collection = db.collection(PAGE_CONTENT_COLLECTION);

  const areaMapPages = await collection.find({
    "rows.type": PageContentType.AREA_MAP,
    "rows.areaMap": {$exists: true}
  }).toArray();

  debugLog(`Found ${areaMapPages.length} pages with area-map rows`);

  let updatedCount = 0;

  for (const page of areaMapPages) {
    let modified = false;
    const updatedRows = page.rows.map((row: any) => {
      if (row.type === PageContentType.AREA_MAP && row.areaMap && row.areaMap.showAreas === undefined) {
        modified = true;
        return {...row, areaMap: {...row.areaMap, showAreas: true}};
      }
      return row;
    });

    if (modified) {
      await collection.updateOne({_id: page._id}, {$set: {rows: updatedRows}});
      updatedCount++;
      debugLog(`Set showAreas=true on page: ${page.path}`);
    }
  }

  debugLog(`Backfilled showAreas on ${updatedCount} of ${areaMapPages.length} pages`);
}

export async function down(db: Db, client: MongoClient) {
  const collection = db.collection(PAGE_CONTENT_COLLECTION);

  const areaMapPages = await collection.find({
    "rows.type": PageContentType.AREA_MAP,
    "rows.areaMap.showAreas": true
  }).toArray();

  debugLog(`Found ${areaMapPages.length} pages with showAreas=true`);

  let updatedCount = 0;

  for (const page of areaMapPages) {
    let modified = false;
    const updatedRows = page.rows.map((row: any) => {
      if (row.type === PageContentType.AREA_MAP && row.areaMap?.showAreas === true) {
        modified = true;
        const {showAreas, ...rest} = row.areaMap;
        return {...row, areaMap: rest};
      }
      return row;
    });

    if (modified) {
      await collection.updateOne({_id: page._id}, {$set: {rows: updatedRows}});
      updatedCount++;
      debugLog(`Removed showAreas from page: ${page.path}`);
    }
  }

  debugLog(`Rolled back showAreas on ${updatedCount} pages`);
}
