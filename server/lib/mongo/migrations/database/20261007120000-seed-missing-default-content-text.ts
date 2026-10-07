import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { seedMissingDefaultContentText } from "../shared/seed-default-content-text";

const debugLog = createMigrationLogger("seed-missing-default-content-text");

export async function up(db: Db, _client: MongoClient): Promise<void> {
  await seedMissingDefaultContentText(db, debugLog);
}

export async function down(_db: Db, _client: MongoClient): Promise<void> {
  debugLog("No-op: default content text is left in place");
}
