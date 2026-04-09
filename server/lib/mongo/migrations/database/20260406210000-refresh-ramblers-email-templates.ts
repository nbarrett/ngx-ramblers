import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { up as applyRamblersAlignedEmailTemplates } from "./20260406000000-apply-ramblers-aligned-email-templates";

const debugLog = createMigrationLogger("refresh-ramblers-email-templates");

export async function up(db: Db, client: MongoClient) {
  debugLog("Re-running Ramblers-aligned template reseed and repair after post-release layout refinements");
  return await applyRamblersAlignedEmailTemplates(db, client);
}

export async function down(db: Db, client: MongoClient) {
  debugLog("Down migration not implemented - refreshed template content cannot be automatically reverted");
}
