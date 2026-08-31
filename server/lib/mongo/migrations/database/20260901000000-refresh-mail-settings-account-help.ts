import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import {
  MAIL_SETTINGS_ACCOUNT_HELP,
  MAIL_SETTINGS_ACCOUNT_SETTINGS
} from "../../../../../projects/ngx-ramblers/src/app/pages/admin/default-content";

const debugLog = createMigrationLogger("refresh-mail-settings-account-help");
const CONTENT_TEXT_COLLECTIONS = ["contentText", "contentTexts"];
const ENTRIES = [MAIL_SETTINGS_ACCOUNT_HELP, MAIL_SETTINGS_ACCOUNT_SETTINGS];

async function upsertInCollection(db: Db, collectionName: string): Promise<void> {
  const collection = db.collection(collectionName);
  await ENTRIES.reduce<Promise<void>>(
    (previous, entry) => previous.then(async () => {
      const existing = await collection.findOne({
        name: entry.name,
        category: entry.category
      });
      if (existing) {
        await collection.updateOne({_id: existing._id}, {$set: {text: entry.text}});
        debugLog(`Updated content text in ${collectionName}: ${entry.name}`);
      } else {
        await collection.insertOne({...entry});
        debugLog(`Added content text in ${collectionName}: ${entry.name}`);
      }
    }),
    Promise.resolve()
  );
}

export async function up(db: Db, _client: MongoClient): Promise<void> {
  await CONTENT_TEXT_COLLECTIONS.reduce<Promise<void>>(
    (previous, collectionName) => previous.then(() => upsertInCollection(db, collectionName)),
    Promise.resolve()
  );
}

export async function down(_db: Db, _client: MongoClient): Promise<void> {
  debugLog("No-op: refresh of mail settings account help is non-destructive");
}
