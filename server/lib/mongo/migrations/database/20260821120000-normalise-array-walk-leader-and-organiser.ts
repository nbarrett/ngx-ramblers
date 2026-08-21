import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";

const debugLog = createMigrationLogger("normalise-array-walk-leader-and-organiser");
debugLog.enabled = true;

function firstElementOrNull(field: string) {
  return {
    $cond: [
      { $isArray: `$${field}` },
      { $ifNull: [{ $arrayElemAt: [`$${field}`, 0] }, null] },
      `$${field}`
    ]
  };
}

export async function up(db: Db, client: MongoClient) {
  const walks = db.collection("extendedgroupevents");
  const criteria = {
    $or: [
      { "groupEvent.walk_leader": { $type: "array" } },
      { "groupEvent.event_organiser": { $type: "array" } }
    ]
  };
  const candidateCount = await walks.countDocuments(criteria);
  debugLog(`Found ${candidateCount} walks with walk_leader or event_organiser stored as an array`);

  const result = await walks.updateMany(criteria, [
    {
      $set: {
        "groupEvent.walk_leader": firstElementOrNull("groupEvent.walk_leader"),
        "groupEvent.event_organiser": firstElementOrNull("groupEvent.event_organiser")
      }
    }
  ]);
  debugLog(`Completed: matched=${result.matchedCount}, modified=${result.modifiedCount}`);
}

export async function down(db: Db, client: MongoClient) {
  debugLog("No down migration; array-to-object normalisation is not reversible");
}
