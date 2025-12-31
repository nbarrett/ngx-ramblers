import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { systemConfig } from "../../../config/system-config";
import { syncWalksManagerData } from "../../../walks/walks-manager-sync";
import { dateTimeFromObject, dateTimeNow } from "../../../shared/dates";

const debugLog = createMigrationLogger("full-walks-manager-sync");

export async function up(db: Db, client: MongoClient) {
  debugLog("Starting full Walks Manager sync migration for all time");

  try {
    const config = await systemConfig();
    const result = await syncWalksManagerData(config, {
      fullSync: true,
      dateFrom: dateTimeFromObject({ year: 2000, month: 1, day: 1 }),
      dateTo: dateTimeNow().plus({ years: 10 })
    });

    debugLog("Full sync completed:", {
      added: result.added,
      updated: result.updated,
      deleted: result.deleted,
      totalProcessed: result.totalProcessed,
      errors: result.errors.length
    });

    if (result.errors.length > 0) {
      debugLog("Sync errors:", result.errors);
      throw new Error(`Full sync completed with ${result.errors.length} errors`);
    }

    debugLog("Full Walks Manager sync migration completed successfully");
  } catch (error) {
    debugLog("Full sync migration failed:", error);
    throw error;
  }
}

export async function down(db: Db, client: MongoClient) {
  debugLog("No down migration; full sync cannot be reversed");
}