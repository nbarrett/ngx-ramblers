import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";

const debugLog = createMigrationLogger("update-osmaps-urls");

export async function up(db: Db, client: MongoClient) {
  const collection = db.collection("groupEvents");

  debugLog("Starting migration of OS Maps URLs from osmaps.ordnancesurvey.co.uk to explore.osmaps.com...");

  const criteria = {osMapsRoute: {$regex: "https://osmaps.ordnancesurvey.co.uk"}};

  const count = await collection.countDocuments(criteria);
  debugLog(`Found ${count} documents with old OS Maps URL format`);

  if (count === 0) {
    debugLog("No documents to migrate");
    return;
  }

  const update = [
    {
      $set: {
        osMapsRoute: {
          $replaceOne: {
            input: "$osMapsRoute",
            find: "https://osmaps.ordnancesurvey.co.uk",
            replacement: "https://explore.osmaps.com"
          }
        }
      }
    }
  ];

  const result = await collection.updateMany(criteria, update);

  debugLog(`Migration completed: ${result.modifiedCount} documents updated`);
}

export async function down(db: Db, client: MongoClient) {
  const collection = db.collection("groupEvents");

  debugLog("Rolling back OS Maps URL migration...");

  const criteria = {osMapsRoute: {$regex: "https://explore.osmaps.com"}};

  const update = [
    {
      $set: {
        osMapsRoute: {
          $replaceOne: {
            input: "$osMapsRoute",
            find: "https://explore.osmaps.com",
            replacement: "https://osmaps.ordnancesurvey.co.uk"
          }
        }
      }
    }
  ];

  const result = await collection.updateMany(criteria, update);

  debugLog(`Rollback completed: ${result.modifiedCount} documents updated`);
}
