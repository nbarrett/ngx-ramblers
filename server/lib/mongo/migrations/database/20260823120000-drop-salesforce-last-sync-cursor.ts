import { Db } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { ConfigKey } from "../../../../../projects/ngx-ramblers/src/app/models/config.model";

const debugLog = createMigrationLogger("drop-salesforce-last-sync-cursor");

export async function up(db: Db) {
  const configResult = await db.collection("config")
    .updateOne({key: ConfigKey.SALESFORCE}, {$unset: {"value.lastSyncCursor": ""}});
  debugLog("cleared lastSyncCursor from %d salesforce config documents", configResult.modifiedCount);
}

export async function down(_db: Db) {
  debugLog("down: no-op, lastSyncCursor was an inert remnant of the legacy incremental client");
}
