import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { GeocodeMatchData } from "../../../../../projects/ngx-ramblers/src/app/models/address-model";
import { EventField, EventType, GroupEventField } from "../../../../../projects/ngx-ramblers/src/app/models/walk.model";
import { RamblersEventType } from "../../../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { InputSource } from "../../../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { WalkEvent } from "../../../../../projects/ngx-ramblers/src/app/models/walk-event.model";
import { gridReferenceAudit, walkEventDataFrom } from "../migration-walk-event";
import { dateTimeNowAsValue } from "../../../shared/dates";
import { geocodeFromText, preferredCountyFromSystemConfig, textGeocodeUpdate } from "../geocode-from-text";

const debugLog = createMigrationLogger("geocode-from-title-description");
debugLog.enabled = true;
export const manual = true;

export async function up(db: Db, client: MongoClient) {
  const collection = db.collection<any>("extendedgroupevents");

  debugLog("Finding walks with invalid SV grid references or missing postcodes that couldn't be geocoded");

  const criteria = {
    [GroupEventField.ITEM_TYPE]: RamblersEventType.GROUP_WALK,
    [EventField.INPUT_SOURCE]: { $ne: InputSource.MANUALLY_CREATED },
    $or: [
      { [GroupEventField.START_LOCATION_POSTCODE]: { $exists: false } },
      { [GroupEventField.START_LOCATION_POSTCODE]: null },
      { [GroupEventField.START_LOCATION_POSTCODE]: "" }
    ]
  };

  const total = await collection.countDocuments(criteria);
  debugLog(`Found ${total} group walks still missing postcodes`);

  if (!total) {
    debugLog("No walks found needing geocoding from title/description");
    return;
  }

  const cursor = collection.find(criteria, {
    projection: {
      [GroupEventField.TITLE]: 1,
      [GroupEventField.DESCRIPTION]: 1,
      [GroupEventField.START_LOCATION_LATITUDE]: 1,
      [GroupEventField.START_LOCATION_LONGITUDE]: 1,
      [GroupEventField.START_LOCATION_POSTCODE]: 1,
      [GroupEventField.START_LOCATION_GRID_REFERENCE_6]: 1,
      [GroupEventField.START_LOCATION_GRID_REFERENCE_8]: 1,
      [GroupEventField.START_LOCATION_GRID_REFERENCE_10]: 1,
      [GroupEventField.START_LOCATION_DESCRIPTION]: 1
    }
  }).batchSize(20);

  let processed = 0;
  let updated = 0;
  let failedLookups = 0;
  const preferredCounty = await preferredCountyFromSystemConfig(debugLog);
  while (await cursor.hasNext()) {
    const doc: any = await cursor.next();
    processed++;
    const id = doc._id;
    const title = doc?.groupEvent?.title || "";
    const description = doc?.groupEvent?.description || "";

    debugLog(`Processing walk ${id} "${title}"`);

    const gridReference = gridReferenceAudit(doc);
    if (gridReference.invalidFields.length > 0) {
      await collection.updateOne({ _id: id }, { $unset: gridReference.unsetPayload });
    }

    const result = await geocodeFromText({ title, description, preferredCounty, debugLog });
    const lookup = result.lookup;
    const matchType = result.matchType;
    const sourceText = result.sourceText;
    const sourceField: GeocodeMatchData["sourceField"] = result.sourceField;

    if (!lookup?.postcode || !matchType) {
      debugLog(`Failed to geocode walk ${id} "${title}"`);
      const failureEvent: WalkEvent = {
        eventType: EventType.LOCATION_GEOCODED,
        date: dateTimeNowAsValue(),
        memberId: "migration",
        description: "Location geocode failed",
        notes: `Could not resolve ${sourceField} "${sourceText || "text"}" to a postcode.`,
        data: walkEventDataFrom(doc, gridReference.updateSet)
      };
      await collection.updateOne({ _id: id }, { $push: { events: failureEvent } } as any);
      failedLookups++;
      continue;
    }

    const updateResult = textGeocodeUpdate({
      doc,
      lookup,
      matchType,
      sourceText,
      sourceField,
      gridReference
    });

    updateResult.update.$push = { events: updateResult.event };

    debugLog(`Updating walk ${id} "${title}" with:`, JSON.stringify(updateResult.update.$set));
    const updateResponse = await collection.updateOne({ _id: id }, updateResult.update);
    if (updateResponse.modifiedCount > 0) {
      updated++;
      debugLog(`Updated walk ${id} "${title}": postcode=${lookup.postcode}, event recorded`);
    }

    await new Promise(resolve => setTimeout(resolve, 1100));
  }

  debugLog(`Completed geocoding from title/description: processed=${processed}, updated=${updated}, failedLookups=${failedLookups}`);
}

export async function down(db: Db, client: MongoClient) {
  debugLog("No down migration; geocode enrichment from title/description is not reversible");
}
