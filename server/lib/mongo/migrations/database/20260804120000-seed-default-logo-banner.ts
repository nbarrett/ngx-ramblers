import { Db } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { MigrationUpResult } from "../../../../../projects/ngx-ramblers/src/app/models/mongo-migration-model";
import { seedDefaultLogoBanner } from "../shared/seed-default-banner";

const debugLog = createMigrationLogger("seed-default-logo-banner");

export async function up(db: Db): Promise<MigrationUpResult | void> {
  debugLog("Seeding a default logo-and-text banner when none exist and a logo is configured");
  const result = await seedDefaultLogoBanner(db, debugLog);
  debugLog(result.reason);
  const migrationResult: MigrationUpResult = result.seeded
    ? {}
    : {skipped: true, reason: result.reason};
  return migrationResult;
}

export async function down(_db: Db) {
  debugLog("No down migration - default banner is left in place if present");
}
