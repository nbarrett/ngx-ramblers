import { Db } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { seedAdminMenuStructure } from "../shared/seed-admin-menu";

const debugLog = createMigrationLogger("seed-admin-menu-categories");

export async function up(db: Db) {
  debugLog("Ensuring admin landing and category pages use the shared menu definitions");
  await seedAdminMenuStructure(db, debugLog);
  debugLog("Admin menu category structure applied");
}

export async function down(_db: Db) {
  debugLog("No down migration - admin menu category structure is intentionally left in place");
}
