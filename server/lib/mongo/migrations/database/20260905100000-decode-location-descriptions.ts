import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { decodeHtmlEntities } from "../../../../../projects/ngx-ramblers/src/app/functions/strings";

const debugLog = createMigrationLogger("decode-location-descriptions");
const ENTITY = /&(amp|lt|gt|quot|apos|nbsp|#\d+|#x[0-9a-f]+);/i;
const LOCATIONS = ["start_location", "end_location", "meeting_location"];

export async function up(db: Db, _client: MongoClient) {
  const collection = db.collection("extendedgroupevents");
  const filter = {$or: LOCATIONS.map(location => ({[`groupEvent.${location}.description`]: ENTITY}))};
  const documents = await collection.find(filter).project({_id: 1, groupEvent: 1}).toArray();
  await documents.reduce<Promise<number>>(async (previous, document) => {
    const done = await previous;
    const updates = LOCATIONS
      .map(location => ({key: `groupEvent.${location}.description`, value: document.groupEvent?.[location]?.description}))
      .filter(item => typeof item.value === "string" && ENTITY.test(item.value))
      .reduce((acc, item) => ({...acc, [item.key]: decodeHtmlEntities(item.value)}), {} as Record<string, string>);
    await collection.updateOne({_id: document._id}, {$set: updates});
    return done + 1;
  }, Promise.resolve(0));
  debugLog(`Decoded HTML entities in location descriptions of ${documents.length} events`);
}

export async function down(_db: Db, _client: MongoClient) {
  debugLog("Decoded location descriptions are not re-encoded on rollback");
}
