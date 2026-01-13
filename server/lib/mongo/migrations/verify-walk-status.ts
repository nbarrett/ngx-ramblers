import { MongoClient } from "mongodb";
import { EventField, GroupEventField } from "../../../../projects/ngx-ramblers/src/app/models/walk.model";
import createMigrationLogger from "./migrations-logger";

const debugLog = createMigrationLogger("verify-walk-status");
debugLog.enabled = true;

async function verifyWalkStatus() {
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
    const collection = db.collection("extendedgroupevents");

    debugLog("\n=== Walk Status Verification ===\n");

    const totalWalks = await collection.countDocuments({});
    debugLog(`Total groupEvents: ${totalWalks}`);

    const migratedWalks = await collection.countDocuments({
      [EventField.MIGRATED_FROM_ID]: { $exists: true }
    });
    debugLog(`Migrated walks (have fields.migratedFromId): ${migratedWalks}`);

    const walksWithNoStatus = await collection.countDocuments({
      [EventField.MIGRATED_FROM_ID]: { $exists: true },
      $or: [
        { [GroupEventField.STATUS]: { $exists: false } },
        { [GroupEventField.STATUS]: null }
      ]
    });
    debugLog(`Migrated walks WITHOUT status: ${walksWithNoStatus}`);

    const walksWithConfirmed = await collection.countDocuments({
      [EventField.MIGRATED_FROM_ID]: { $exists: true },
      [GroupEventField.STATUS]: "confirmed"
    });
    debugLog(`Migrated walks WITH status='confirmed': ${walksWithConfirmed}`);

    debugLog("\n=== Sample Migrated Walks ===\n");

    const sampleWithoutStatus = await collection.findOne({
      [EventField.MIGRATED_FROM_ID]: { $exists: true },
      $or: [
        { [GroupEventField.STATUS]: { $exists: false } },
        { [GroupEventField.STATUS]: null }
      ]
    });

    if (sampleWithoutStatus) {
      debugLog("Sample walk WITHOUT status:");
      debugLog({
        id: sampleWithoutStatus._id,
        title: sampleWithoutStatus.groupEvent?.title,
        startDate: sampleWithoutStatus.groupEvent?.start_date_time,
        migratedFromId: sampleWithoutStatus.fields?.migratedFromId,
        status: sampleWithoutStatus.groupEvent?.status,
        itemType: sampleWithoutStatus.groupEvent?.item_type
      });
    } else {
      debugLog("No walks found without status");
    }

    const sampleWithStatus = await collection.findOne({
      [EventField.MIGRATED_FROM_ID]: { $exists: true },
      [GroupEventField.STATUS]: "confirmed"
    });

    if (sampleWithStatus) {
      debugLog("\nSample walk WITH status='confirmed':");
      debugLog({
        id: sampleWithStatus._id,
        title: sampleWithStatus.groupEvent?.title,
        startDate: sampleWithStatus.groupEvent?.start_date_time,
        migratedFromId: sampleWithStatus.fields?.migratedFromId,
        status: sampleWithStatus.groupEvent?.status,
        itemType: sampleWithStatus.groupEvent?.item_type
      });
    } else {
      debugLog("\nNo walks found with status='confirmed'");
    }

    debugLog("\n=== Impact on Leader Aggregation ===\n");

    const confirmedWalksForLeaders = await collection.countDocuments({
      [GroupEventField.STATUS]: "confirmed"
    });
    debugLog(`Total walks that WILL be included in leader stats (status='confirmed'): ${confirmedWalksForLeaders}`);

    const excludedWalks = await collection.countDocuments({
      $or: [
        { [GroupEventField.STATUS]: { $exists: false } },
        { [GroupEventField.STATUS]: null },
        { [GroupEventField.STATUS]: { $ne: "confirmed" } }
      ]
    });
    debugLog(`Total walks that are EXCLUDED from leader stats (no status or not confirmed): ${excludedWalks}`);

  } catch (error) {
    debugLog("Error:", error);
  } finally {
    await client.close();
    debugLog("\nDisconnected from MongoDB");
  }
}

verifyWalkStatus();
