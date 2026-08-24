import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { COMMITTEE_OUTBOUND_EMAIL_HELP } from "../../../../../projects/ngx-ramblers/src/app/pages/admin/default-content";

const debugLog = createMigrationLogger("refresh-committee-outbound-email-help");
const CONTENT_TEXT_COLLECTIONS = ["contentText", "contentTexts"];

async function upsertInCollection(db: Db, collectionName: string): Promise<void> {
  const collection = db.collection(collectionName);
  const existing = await collection.findOne({
    name: COMMITTEE_OUTBOUND_EMAIL_HELP.name,
    category: COMMITTEE_OUTBOUND_EMAIL_HELP.category
  });
  if (existing) {
    await collection.updateOne({_id: existing._id}, {$set: {text: COMMITTEE_OUTBOUND_EMAIL_HELP.text}});
    debugLog(`Updated content text in ${collectionName}: ${COMMITTEE_OUTBOUND_EMAIL_HELP.name}`);
  } else {
    await collection.insertOne({...COMMITTEE_OUTBOUND_EMAIL_HELP});
    debugLog(`Added content text in ${collectionName}: ${COMMITTEE_OUTBOUND_EMAIL_HELP.name}`);
  }
}

export async function up(db: Db, _client: MongoClient): Promise<void> {
  await CONTENT_TEXT_COLLECTIONS.reduce<Promise<void>>(
    (previous, collectionName) => previous.then(() => upsertInCollection(db, collectionName)),
    Promise.resolve()
  );
}

export async function down(_db: Db, _client: MongoClient): Promise<void> {
  debugLog(`No-op: refresh of ${COMMITTEE_OUTBOUND_EMAIL_HELP.name} is non-destructive`);
}
