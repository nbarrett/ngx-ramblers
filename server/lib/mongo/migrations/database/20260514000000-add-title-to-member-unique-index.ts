import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";

const debugLog = createMigrationLogger("add-title-to-member-unique-index");

const OLD_INDEX_NAME = "lastName_1_firstName_1_nameAlias_1";
const NEW_INDEX_KEYS = {lastName: 1, firstName: 1, nameAlias: 1, title: 1};
const NEW_INDEX_NAME = "lastName_1_firstName_1_nameAlias_1_title_1";

export async function up(db: Db, _client: MongoClient) {
  const collection = db.collection("members");
  const indexes = await collection.indexes();

  if (indexes.some(i => i.name === OLD_INDEX_NAME)) {
    await collection.dropIndex(OLD_INDEX_NAME);
    debugLog(`Dropped legacy index ${OLD_INDEX_NAME}`);
  } else {
    debugLog(`Legacy index ${OLD_INDEX_NAME} not present`);
  }

  if (!indexes.some(i => i.name === NEW_INDEX_NAME)) {
    await collection.createIndex(NEW_INDEX_KEYS as any, {unique: true, name: NEW_INDEX_NAME});
    debugLog(`Created unique index ${NEW_INDEX_NAME}`);
  } else {
    debugLog(`Index ${NEW_INDEX_NAME} already exists`);
  }
}

export async function down(db: Db, _client: MongoClient) {
  const collection = db.collection("members");

  try {
    await collection.dropIndex(NEW_INDEX_NAME);
    debugLog(`Dropped index ${NEW_INDEX_NAME}`);
  } catch (error: any) {
    debugLog(`${NEW_INDEX_NAME} not present or already dropped: ${error.message}`);
  }

  try {
    await collection.createIndex({lastName: 1, firstName: 1, nameAlias: 1} as any, {unique: true, name: OLD_INDEX_NAME});
    debugLog(`Recreated legacy index ${OLD_INDEX_NAME}`);
  } catch (error: any) {
    debugLog(`Failed to recreate ${OLD_INDEX_NAME}: ${error.message}`);
  }
}
