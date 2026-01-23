import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";

const debugLog = createMigrationLogger("fix-boolean-publishing-fields");
debugLog.enabled = true;

export async function up(db: Db, client: MongoClient) {
  const collection = db.collection("extendedgroupevents");

  debugLog("Finding walks with boolean publishing.meetup or publishing.ramblers fields");

  const meetupBooleanCriteria = {
    "fields.publishing.meetup": { $type: "bool" }
  };

  const ramblersBooleanCriteria = {
    "fields.publishing.ramblers": { $type: "bool" }
  };

  const meetupCount = await collection.countDocuments(meetupBooleanCriteria);
  const ramblersCount = await collection.countDocuments(ramblersBooleanCriteria);

  debugLog(`Found ${meetupCount} documents with boolean meetup field`);
  debugLog(`Found ${ramblersCount} documents with boolean ramblers field`);

  if (meetupCount > 0) {
    const meetupResult = await collection.updateMany(
      meetupBooleanCriteria,
      {
        $set: {
          "fields.publishing.meetup": { publish: false, contactName: null }
        }
      }
    );
    debugLog(`Updated ${meetupResult.modifiedCount} documents with boolean meetup -> {publish: false, contactName: null}`);
  }

  if (ramblersCount > 0) {
    const ramblersResult = await collection.updateMany(
      ramblersBooleanCriteria,
      {
        $set: {
          "fields.publishing.ramblers": { publish: true, contactName: null }
        }
      }
    );
    debugLog(`Updated ${ramblersResult.modifiedCount} documents with boolean ramblers -> {publish: true, contactName: null}`);
  }

  debugLog("Completed fix-boolean-publishing-fields migration");
}

export async function down(db: Db, client: MongoClient) {
  debugLog("No down migration for fix-boolean-publishing-fields");
}
