import { MongoClient } from "mongodb";

async function verifyWalkStatus() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI environment variable not set");
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db();
    const collection = db.collection("extendedgroupevents");

    console.log("\n=== Walk Status Verification ===\n");

    const totalWalks = await collection.countDocuments({});
    console.log(`Total groupEvents: ${totalWalks}`);

    const migratedWalks = await collection.countDocuments({
      "fields.migratedFromId": { $exists: true }
    });
    console.log(`Migrated walks (have fields.migratedFromId): ${migratedWalks}`);

    const walksWithNoStatus = await collection.countDocuments({
      "fields.migratedFromId": { $exists: true },
      $or: [
        { "groupEvent.status": { $exists: false } },
        { "groupEvent.status": null }
      ]
    });
    console.log(`Migrated walks WITHOUT status: ${walksWithNoStatus}`);

    const walksWithConfirmed = await collection.countDocuments({
      "fields.migratedFromId": { $exists: true },
      "groupEvent.status": "confirmed"
    });
    console.log(`Migrated walks WITH status='confirmed': ${walksWithConfirmed}`);

    console.log("\n=== Sample Migrated Walks ===\n");

    const sampleWithoutStatus = await collection.findOne({
      "fields.migratedFromId": { $exists: true },
      $or: [
        { "groupEvent.status": { $exists: false } },
        { "groupEvent.status": null }
      ]
    });

    if (sampleWithoutStatus) {
      console.log("Sample walk WITHOUT status:");
      console.log({
        id: sampleWithoutStatus._id,
        title: sampleWithoutStatus.groupEvent?.title,
        startDate: sampleWithoutStatus.groupEvent?.start_date_time,
        migratedFromId: sampleWithoutStatus.fields?.migratedFromId,
        status: sampleWithoutStatus.groupEvent?.status,
        itemType: sampleWithoutStatus.groupEvent?.item_type
      });
    } else {
      console.log("No walks found without status");
    }

    const sampleWithStatus = await collection.findOne({
      "fields.migratedFromId": { $exists: true },
      "groupEvent.status": "confirmed"
    });

    if (sampleWithStatus) {
      console.log("\nSample walk WITH status='confirmed':");
      console.log({
        id: sampleWithStatus._id,
        title: sampleWithStatus.groupEvent?.title,
        startDate: sampleWithStatus.groupEvent?.start_date_time,
        migratedFromId: sampleWithStatus.fields?.migratedFromId,
        status: sampleWithStatus.groupEvent?.status,
        itemType: sampleWithStatus.groupEvent?.item_type
      });
    } else {
      console.log("\nNo walks found with status='confirmed'");
    }

    console.log("\n=== Impact on Leader Aggregation ===\n");

    const confirmedWalksForLeaders = await collection.countDocuments({
      "groupEvent.status": "confirmed"
    });
    console.log(`Total walks that WILL be included in leader stats (status='confirmed'): ${confirmedWalksForLeaders}`);

    const excludedWalks = await collection.countDocuments({
      $or: [
        { "groupEvent.status": { $exists: false } },
        { "groupEvent.status": null },
        { "groupEvent.status": { $ne: "confirmed" } }
      ]
    });
    console.log(`Total walks that are EXCLUDED from leader stats (no status or not confirmed): ${excludedWalks}`);

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.close();
    console.log("\nDisconnected from MongoDB");
  }
}

verifyWalkStatus();
