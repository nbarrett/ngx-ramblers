import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { IndexContentType } from "../../../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { RegistrationMigrationTemplate } from "../../../../../projects/ngx-ramblers/src/app/models/site-registration.model";

const debugLog = createMigrationLogger("photos-index-years-only");

export async function up(db: Db, _client: MongoClient): Promise<void> {
  const template = await db.collection("pageContent").updateOne(
    {path: RegistrationMigrationTemplate.PHOTOS_INDEX},
    {$set: {"rows.$[row].albumIndex.contentTypes": [IndexContentType.INDEX_PAGES]}}
    , {arrayFilters: [{"row.type": "album-index"}]}
  );
  const landing = await db.collection("pageContent").updateOne(
    {path: "photos", "rows.albumIndex.contentPaths.contentPath": "photos"},
    {$set: {"rows.$[row].albumIndex.contentTypes": [IndexContentType.INDEX_PAGES]}}
    , {arrayFilters: [{"row.type": "album-index"}]}
  );
  const logs = await db.collection("pageContent").updateMany(
    {debugLogs: {$exists: true}},
    {$unset: {debugLogs: ""}}
  );
  debugLog(`Photos index template matched ${template.matchedCount}, photos landing ${landing.matchedCount}, debugLogs cleared on ${logs.modifiedCount} pages`);
}

export async function down(_db: Db, _client: MongoClient): Promise<void> {
  debugLog("Photos index content types are retained.");
}
