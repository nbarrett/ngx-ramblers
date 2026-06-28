import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { NOTIFICATION_CONFIG_COLLECTION } from "../shared/collection-names";

const debugLog = createMigrationLogger("backfill-notification-time-unit");

export async function up(db: Db, client: MongoClient) {
  const collection = db.collection(NOTIFICATION_CONFIG_COLLECTION);
  const result = await collection.updateMany(
    {
      $or: [
        { timeUnit: { $exists: false } },
        { timeUnit: null }
      ]
    },
    { $set: { timeUnit: "months" } }
  );
  debugLog(`Updated ${result.modifiedCount} notification configs with missing timeUnit`);
}

export async function down(db: Db, client: MongoClient) {
  debugLog("No down migration - notification config timeUnit is intentionally left in place");
}
