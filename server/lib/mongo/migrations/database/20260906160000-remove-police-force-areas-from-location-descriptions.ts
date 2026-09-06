import { Db, MongoClient } from "mongodb";
import { isArray, isString } from "es-toolkit/compat";
import createMigrationLogger from "../migrations-logger";
import { mentionsPoliceForceArea, withoutPoliceForceAreas } from "../../../addresses/location-description";
import { postcodeLookupFromPostcodesIo } from "../../../addresses/postcode-lookup";
import { GridReferenceLookupResponse } from "../../../../../projects/ngx-ramblers/src/app/models/address-model";

const debugLog = createMigrationLogger("remove-police-force-areas-from-location-descriptions");
const POLICE_FORCE_AREA = /\b(police|constabulary)\b/i;
const LOCATIONS = ["start_location", "end_location", "meeting_location"];

async function lookedUpDescription(postcode: string, cache: Map<string, string>): Promise<string> {
  const key = (postcode || "").replace(/\s+/g, "").toUpperCase();
  if (!key) {
    return "";
  } else if (cache.has(key)) {
    return cache.get(key);
  } else {
    const description = await postcodeLookupFromPostcodesIo(postcode)
      .then(apiResponse => {
        const single = (isArray(apiResponse?.response) ? apiResponse.response[0] : apiResponse?.response) as GridReferenceLookupResponse | undefined;
        return single && !single.error ? single.description || "" : "";
      })
      .catch(error => {
        debugLog(`Lookup failed for ${postcode}: ${(error as Error).message}`);
        return "";
      });
    cache.set(key, description);
    return description;
  }
}

async function replacementDescription(current: string, postcode: string, cache: Map<string, string>): Promise<string> {
  const fromLookup = await lookedUpDescription(postcode, cache);
  return fromLookup && !mentionsPoliceForceArea(fromLookup) ? fromLookup : withoutPoliceForceAreas(current);
}

export async function up(db: Db, _client: MongoClient) {
  const collection = db.collection("extendedgroupevents");
  const filter = {$or: LOCATIONS.map(location => ({[`groupEvent.${location}.description`]: POLICE_FORCE_AREA}))};
  const documents = await collection.find(filter).project({_id: 1, groupEvent: 1}).toArray();
  const cache = new Map<string, string>();
  const counts = await documents.reduce<Promise<{events: number; lookedUp: number}>>(async (previous, document) => {
    const done = await previous;
    const affected = LOCATIONS
      .map(location => ({key: `groupEvent.${location}.description`, description: document.groupEvent?.[location]?.description, postcode: document.groupEvent?.[location]?.postcode}))
      .filter(item => isString(item.description) && mentionsPoliceForceArea(item.description));
    const updates = await affected.reduce<Promise<Record<string, string>>>(async (previousUpdates, item) => {
      const acc = await previousUpdates;
      return {...acc, [item.key]: await replacementDescription(item.description, item.postcode, cache)};
    }, Promise.resolve({}));
    await collection.updateOne({_id: document._id}, {$set: updates});
    return {events: done.events + 1, lookedUp: done.lookedUp + affected.filter(item => cache.get((item.postcode || "").replace(/\s+/g, "").toUpperCase())).length};
  }, Promise.resolve({events: 0, lookedUp: 0}));
  debugLog(`Rebuilt location descriptions of ${counts.events} events; ${counts.lookedUp} from a fresh postcode lookup, the rest by removing the police force area`);
}

export async function down(_db: Db, _client: MongoClient) {
  debugLog("Police force areas are not restored to location descriptions on rollback");
}
