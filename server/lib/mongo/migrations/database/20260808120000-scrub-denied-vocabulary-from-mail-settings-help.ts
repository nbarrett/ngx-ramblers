import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";

const debugLog = createMigrationLogger("scrub-denied-vocabulary-from-mail-settings-help");
const CONTENT_TEXT_COLLECTIONS = ["contentText", "contentTexts"];
const HELP_NAME = "mail-settings-unsubscribes-help";
const HELP_CATEGORY = "admin";
const FROM = "global blacklist flag";
const TO = "global email-denied flag";

async function scrubInCollection(db: Db, collectionName: string): Promise<void> {
  const collection = db.collection(collectionName);
  const existing = await collection.findOne({name: HELP_NAME, category: HELP_CATEGORY});
  if (!existing || typeof existing.text !== "string") {
    debugLog(`No content text in ${collectionName}: ${HELP_NAME}`);
    return;
  }
  if (!existing.text.includes(FROM)) {
    debugLog(`No scrub needed in ${collectionName}: ${HELP_NAME}`);
    return;
  }
  const text = existing.text.split(FROM).join(TO);
  await collection.updateOne({_id: existing._id}, {$set: {text}});
  debugLog(`Scrubbed vocabulary in ${collectionName}: ${HELP_NAME}`);
}

export async function up(db: Db, _client: MongoClient): Promise<void> {
  await CONTENT_TEXT_COLLECTIONS.reduce<Promise<void>>(
    (previous, collectionName) => previous.then(() => scrubInCollection(db, collectionName)),
    Promise.resolve()
  );
}

export async function down(_db: Db, _client: MongoClient): Promise<void> {
  debugLog("No-op: vocabulary scrub is non-destructive");
}
