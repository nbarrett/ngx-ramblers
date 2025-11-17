import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";

const debugLog = createMigrationLogger("set-status-on-migrated-walks");

export async function up(db: Db, client: MongoClient) {
  const collection = db.collection("extendedgroupevents");

  debugLog("Starting migration to set status based on walk events...");

  const criteria = {
    "fields.migratedFromId": { $exists: true },
    $or: [
      { "groupEvent.status": { $exists: false } },
      { "groupEvent.status": null }
    ]
  };

  const count = await collection.countDocuments(criteria);
  debugLog(`Found ${count} migrated walks without status field`);

  if (count === 0) {
    debugLog("No walks need status field update");
    return;
  }

  const result = await collection.updateMany(
    criteria,
    [
      {
        $set: {
          "groupEvent.status": {
            $let: {
              vars: {
                hasEvents: { $gt: [{ $size: { $ifNull: ["$events", []] } }, 0] },
                statusChangeEvents: {
                  $filter: {
                    input: { $ifNull: ["$events", []] },
                    as: "event",
                    cond: {
                      $in: [
                        "$$event.eventType",
                        ["approved", "deleted", "awaitingLeader", "awaitingWalkDetails", "awaitingApproval"]
                      ]
                    }
                  }
                },
                isWalk: { $eq: ["$groupEvent.item_type", "group-walk"] }
              },
              in: {
                $cond: {
                  if: "$$hasEvents",
                  then: {
                    $cond: {
                      if: { $gt: [{ $size: "$$statusChangeEvents" }, 0] },
                      then: {
                        $let: {
                          vars: {
                            latestEvent: { $arrayElemAt: ["$$statusChangeEvents", -1] }
                          },
                          in: {
                            $switch: {
                              branches: [
                                { case: { $eq: ["$$latestEvent.eventType", "approved"] }, then: "confirmed" },
                                { case: { $eq: ["$$latestEvent.eventType", "deleted"] }, then: "deleted" }
                              ],
                              default: null
                            }
                          }
                        }
                      },
                      else: null
                    }
                  },
                  else: {
                    $cond: {
                      if: "$$isWalk",
                      then: "confirmed",
                      else: null
                    }
                  }
                }
              }
            }
          }
        }
      }
    ]
  );

  debugLog(`Migration completed: ${result.modifiedCount} walks updated with derived status`);
  debugLog(`Matched ${result.matchedCount} documents`);
}

export async function down(db: Db, client: MongoClient) {
  const collection = db.collection("groupEvents");

  debugLog("Rolling back: removing status field from migrated walks...");

  const criteria = {
    "fields.migratedFromId": { $exists: true },
    "groupEvent.status": "confirmed"
  };

  const result = await collection.updateMany(
    criteria,
    {
      $unset: {
        "groupEvent.status": ""
      }
    }
  );

  debugLog(`Rollback completed: ${result.modifiedCount} walks had status removed`);
}
