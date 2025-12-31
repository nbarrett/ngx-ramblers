import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { GroupEventField } from "../../../../../projects/ngx-ramblers/src/app/models/walk.model";

const debugLog = createMigrationLogger("migrate-media-urls");

export async function up(db: Db, client: MongoClient) {
  const collection = db.collection("groupEvents");

  debugLog("Starting migration of media URLs from api/aws/s3/ format...");

  const criteria = {[`${GroupEventField.MEDIA}.styles.url`]: {$regex: "api/aws/s3/"}};

  const count = await collection.countDocuments(criteria);
  debugLog(`Found ${count} documents with old media URL format`);

  if (count === 0) {
    debugLog("No documents to migrate");
    return;
  }

  const update = [
    {
      $set: {
        [GroupEventField.MEDIA]: {
          $map: {
            input: `$${GroupEventField.MEDIA}`,
            as: "media",
            in: {
              $mergeObjects: [
                "$$media",
                {
                  styles: {
                    $map: {
                      input: "$$media.styles",
                      as: "style",
                      in: {
                        $mergeObjects: [
                          "$$style",
                          {
                            url: {
                              $let: {
                                vars: {
                                  matchResult: {
                                    $regexFind: {
                                      input: "$$style.url",
                                      regex: "api/aws/s3/(.+)$"
                                    }
                                  }
                                },
                                in: {
                                  $cond: [
                                    {$ne: ["$$matchResult", null]},
                                    {$arrayElemAt: ["$$matchResult.captures", 0]},
                                    "$$style.url"
                                  ]
                                }
                              }
                            }
                          }
                        ]
                      }
                    }
                  }
                }
              ]
            }
          }
        }
      }
    }
  ];

  const result = await collection.updateMany(criteria, update);

  debugLog(`Migration completed: ${result.modifiedCount} documents updated`);
}

export async function down(db: Db, client: MongoClient) {
  debugLog("This migration cannot be automatically rolled back");
  debugLog("Manual restoration from backup would be required");
}
