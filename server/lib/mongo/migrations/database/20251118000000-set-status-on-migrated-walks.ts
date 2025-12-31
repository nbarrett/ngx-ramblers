import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { WalkStatus } from "../../../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { EventType, EventField, GroupEventField } from "../../../../../projects/ngx-ramblers/src/app/models/walk.model";

const debugLog = createMigrationLogger("set-status-on-migrated-walks");

export async function up(db: Db, client: MongoClient) {
  const collection = db.collection("extendedgroupevents");

  debugLog("Starting migration to set status based on walk events...");

  const criteria = {
    [EventField.MIGRATED_FROM_ID]: { $exists: true },
    $or: [
      { [GroupEventField.STATUS]: { $exists: false } },
      { [GroupEventField.STATUS]: null }
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
          [GroupEventField.STATUS]: {
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
                        [
                          EventType.APPROVED,
                          EventType.DELETED,
                          EventType.AWAITING_LEADER,
                          EventType.AWAITING_WALK_DETAILS,
                          EventType.AWAITING_APPROVAL
                        ]
                      ]
                    }
                  }
                },
                isWalk: { $eq: [`$${GroupEventField.ITEM_TYPE}`, "group-walk"] }
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
                                { case: { $eq: ["$$latestEvent.eventType", EventType.APPROVED] }, then: WalkStatus.CONFIRMED },
                                { case: { $eq: ["$$latestEvent.eventType", EventType.DELETED] }, then: "deleted" }
                              ],
                              default: WalkStatus.DRAFT
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
                      then: WalkStatus.CONFIRMED,
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
    [EventField.MIGRATED_FROM_ID]: { $exists: true },
    [GroupEventField.STATUS]: WalkStatus.CONFIRMED
  };

  const result = await collection.updateMany(
    criteria,
    {
      $unset: {
        [GroupEventField.STATUS]: ""
      }
    }
  );

  debugLog(`Rollback completed: ${result.modifiedCount} walks had status removed`);
}
