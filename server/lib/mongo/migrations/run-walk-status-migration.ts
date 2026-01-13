import { MongoClient } from "mongodb";
import { up } from "./database/20251118000000-set-status-on-migrated-walks";
import createMigrationLogger from "./migrations-logger";

const debugLog = createMigrationLogger("run-walk-status-migration");
debugLog.enabled = true;

async function runMigration() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    debugLog("MONGODB_URI environment variable not set");
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    debugLog("Connected to MongoDB");

    const db = client.db();

    debugLog("\n=== Running Migration: set-status-on-migrated-walks ===\n");

    await up(db, client);

    debugLog("\nMigration completed successfully!");
  } catch (error) {
    debugLog("Migration failed:", error);
    process.exit(1);
  } finally {
    await client.close();
    debugLog("\nDisconnected from MongoDB");
  }
}

runMigration();
