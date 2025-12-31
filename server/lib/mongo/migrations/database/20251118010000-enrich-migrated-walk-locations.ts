import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { postcodeLookupFromPostcodesIo } from "../../../addresses/postcode-lookup";
import {
  GridReferenceLookupApiResponse,
  GridReferenceLookupResponse
} from "../../../../../projects/ngx-ramblers/src/app/models/address-model";
import { GroupEventField, EventField } from "../../../../../projects/ngx-ramblers/src/app/models/walk.model";

const debugLog = createMigrationLogger("enrich-migrated-walk-locations");

async function lookupPostcode(postcode: string): Promise<GridReferenceLookupResponse | null> {
  const trimmedPostcode = (postcode || "").trim();
  if (!trimmedPostcode) {
    return null;
  } else {
    try {
      const result: GridReferenceLookupApiResponse = await postcodeLookupFromPostcodesIo(trimmedPostcode);
      return result.response as GridReferenceLookupResponse;
    } catch (error) {
      debugLog(`lookupPostcode error for ${trimmedPostcode}:`, error);
      return null;
    }
  }
}

export async function up(db: Db, client: MongoClient) {
  const collection = db.collection("extendedgroupevents");

  const criteria = {
    [EventField.MIGRATED_FROM_ID]: {$exists: true},
    [GroupEventField.ITEM_TYPE]: "group-walk",
    $and: [
      {
        $or: [
          {[GroupEventField.START_LOCATION_LATITUDE]: {$exists: false}},
          {[GroupEventField.START_LOCATION_LATITUDE]: null},
          {[GroupEventField.START_LOCATION_LATITUDE]: 0}
        ]
      },
      {
        $or: [
          {[GroupEventField.START_LOCATION_LONGITUDE]: {$exists: false}},
          {[GroupEventField.START_LOCATION_LONGITUDE]: null},
          {[GroupEventField.START_LOCATION_LONGITUDE]: 0}
        ]
      }
    ],
    [GroupEventField.START_LOCATION_POSTCODE]: {$ne: null}
  };

  const total = await collection.countDocuments(criteria);
  debugLog(`Found ${total} migrated group walks with missing coordinates but a postcode`);

  if (!total) {
    return;
  }

  const cursor = collection.find(criteria, {projection: {[GroupEventField.START_LOCATION_POSTCODE]: 1}}).batchSize(50);

  let processed = 0;
  let updated = 0;
  let failedLookups = 0;

  while (await cursor.hasNext()) {
    const doc: any = await cursor.next();
    processed++;
    const id = doc._id;
    const postcode = doc?.groupEvent?.start_location?.postcode;

    const lookup = await lookupPostcode(postcode);
    if (!lookup || lookup.error || !lookup.latlng) {
      failedLookups++;
      continue;
    }

    const update: any = {
      $set: {
        [GroupEventField.START_LOCATION_LATITUDE]: lookup.latlng.lat,
        [GroupEventField.START_LOCATION_LONGITUDE]: lookup.latlng.lng
      }
    };

    if (!doc.groupEvent?.start_location?.grid_reference_6 && lookup.gridReference6) {
      update.$set["groupEvent.start_location.grid_reference_6"] = lookup.gridReference6;
    }
    if (!doc.groupEvent?.start_location?.grid_reference_8 && lookup.gridReference8) {
      update.$set["groupEvent.start_location.grid_reference_8"] = lookup.gridReference8;
    }
    if (!doc.groupEvent?.start_location?.grid_reference_10 && lookup.gridReference10) {
      update.$set["groupEvent.start_location.grid_reference_10"] = lookup.gridReference10;
    }

    const result = await collection.updateOne({_id: id}, update);
    if (result.modifiedCount > 0) {
      updated++;
    }
  }

  debugLog(`Completed postcode enrichment: processed=${processed}, updated=${updated}, failedLookups=${failedLookups}`);
}

export async function down(db: Db, client: MongoClient) {
  debugLog("No down migration; walk location enrichment is not reversible");
}
