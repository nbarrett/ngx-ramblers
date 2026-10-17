import { Db, MongoClient } from "mongodb";
import { siteRegistration } from "../../models/site-registration";
import { ensureCollectionIndexesInDatabase } from "../../utils/collection-indexes";
import createMigrationLogger from "../migrations-logger";

const debugLog = createMigrationLogger("centralise-registration-indexes");

export async function up(db: Db, _client: MongoClient): Promise<void> {
  await ensureCollectionIndexesInDatabase(db, siteRegistration, false);
  debugLog("Registration indexes checked against the model for existing collections");
}

export async function down(_db: Db, _client: MongoClient): Promise<void> {
  debugLog("Registration indexes retained");
}
