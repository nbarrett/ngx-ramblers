import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { gridReferenceLookupFromLatLng } from "../../../addresses/reverse-geocode";
import {
  gridReference10From,
  gridReference6From,
  gridReference8From, parseGridReference
} from "../../../addresses/grid-reference";
import {
  GeocodeMatchData,
  GeocodeMatchType,
  GridReferenceLookupApiResponse,
  GridReferenceLookupResponse
} from "../../../../../projects/ngx-ramblers/src/app/models/address-model";
import { EventField, EventType, GroupEventField } from "../../../../../projects/ngx-ramblers/src/app/models/walk.model";
import { InputSource } from "../../../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { RamblersEventType } from "../../../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { WalkEvent } from "../../../../../projects/ngx-ramblers/src/app/models/walk-event.model";
import { EPSG_27700_PROJ4 } from "../../../../../projects/ngx-ramblers/src/app/common/maps/map-projection.constants";
import { LatLngLiteral } from "leaflet";
import proj4 from "proj4";
import { dateTimeNowAsValue } from "../../../shared/dates";
import { gridReferenceAudit, walkEventDataFrom } from "../migration-walk-event";
import {
  geocodeFromText,
  preferredAreaCenterFromSystemConfig,
  preferredCountyFromSystemConfig,
  textGeocodeUpdate
} from "../geocode-from-text";
import { isArray } from "es-toolkit/compat";

const debugLog = createMigrationLogger("reverse-geocode-missing-postcodes");
debugLog.enabled = true;
const bngToWgs84 = proj4(EPSG_27700_PROJ4, "+proj=longlat +datum=WGS84 +no_defs");
export const manual = true;
const maxAreaDistanceMiles = 50;

function distanceMiles(a: LatLngLiteral, b: LatLngLiteral): number {
  const toRadians = (value: number) => value * (Math.PI / 180);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLng = toRadians(b.lng - a.lng);
  const sinDeltaLat = Math.sin(deltaLat / 2);
  const sinDeltaLng = Math.sin(deltaLng / 2);
  const haversine = sinDeltaLat * sinDeltaLat + Math.cos(lat1) * Math.cos(lat2) * sinDeltaLng * sinDeltaLng;
  return 3958.7613 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function extractGridReference(response: GridReferenceLookupApiResponse): GridReferenceLookupResponse | undefined {
  const payload = response?.response;
  if (isArray(payload)) {
    return payload[0];
  }
  return payload as GridReferenceLookupResponse;
}

async function lookupFromGridReference(gridRef: string): Promise<GridReferenceLookupResponse | null> {
  if (!gridRef) {
    return null;
  }
  const parsed = parseGridReference(gridRef);
  if (!parsed) {
    debugLog(`Failed to parse grid reference: ${gridRef}`);
    return null;
  }

  const {eastings, northings} = parsed;
  debugLog(`Parsed ${gridRef} to eastings=${eastings}, northings=${northings}`);

  const [lng, lat] = bngToWgs84.forward([eastings, northings]);
  debugLog(`Converted to WGS84 lat=${lat}, lng=${lng}`);

  try {
    const gridReferenceResponse = await gridReferenceLookupFromLatLng({lat, lng});
    const gridReference = extractGridReference(gridReferenceResponse);

    if (!gridReference) {
      return null;
    }

    return {
      ...gridReference,
      gridReference6: gridReference6From(eastings, northings),
      gridReference8: gridReference8From(eastings, northings),
      gridReference10: gridReference10From(eastings, northings),
      latlng: {lat, lng},
      description: gridReference.description || gridRef
    };
  } catch (error) {
    debugLog(`lookupFromGridReference error for ${gridRef}:`, error);
    return null;
  }
}

async function reverseGeocodeLookup(latlng: LatLngLiteral): Promise<GridReferenceLookupResponse | null> {
  if (!latlng?.lat || !latlng?.lng) {
    return null;
  }
  try {
    const result: GridReferenceLookupApiResponse = await gridReferenceLookupFromLatLng(latlng);
    const responses = result.response as GridReferenceLookupResponse[];
    return responses?.[0] || null;
  } catch (error) {
    debugLog(`reverseGeocodeLookup error for lat=${latlng.lat}, lng=${latlng.lng}:`, error);
    return null;
  }
}

export async function up(db: Db, client: MongoClient) {
  const collection = db.collection<any>("extendedgroupevents");

  debugLog("Finding walks missing postcode that have either valid lat/lng coordinates or a grid reference");

  const totalWalks = await collection.countDocuments({[GroupEventField.ITEM_TYPE]: RamblersEventType.GROUP_WALK});
  debugLog(`Total group walks in database: ${totalWalks}`);

  const criteria = {
    [GroupEventField.ITEM_TYPE]: RamblersEventType.GROUP_WALK,
    [EventField.INPUT_SOURCE]: {$ne: InputSource.MANUALLY_CREATED},
    $or: [
      {[GroupEventField.START_LOCATION_POSTCODE]: {$exists: false}},
      {[GroupEventField.START_LOCATION_POSTCODE]: null},
      {[GroupEventField.START_LOCATION_POSTCODE]: ""},
      {
        $or: [
          {[GroupEventField.START_LOCATION_LATITUDE]: {$exists: false}},
          {[GroupEventField.START_LOCATION_LATITUDE]: null},
          {[GroupEventField.START_LOCATION_LATITUDE]: 0},
          {[GroupEventField.START_LOCATION_LONGITUDE]: {$exists: false}},
          {[GroupEventField.START_LOCATION_LONGITUDE]: null},
          {[GroupEventField.START_LOCATION_LONGITUDE]: 0}
        ]
      }
    ],
    $and: [
      {
        $or: [
          {
            $and: [
              {[GroupEventField.START_LOCATION_LATITUDE]: {$exists: true, $nin: [null, 0]}},
              {[GroupEventField.START_LOCATION_LONGITUDE]: {$exists: true, $nin: [null, 0]}}
            ]
          },
          {[GroupEventField.START_LOCATION_GRID_REFERENCE_6]: {$exists: true, $nin: [null, ""]}},
          {[GroupEventField.START_LOCATION_GRID_REFERENCE_8]: {$exists: true, $nin: [null, ""]}},
          {[GroupEventField.START_LOCATION_GRID_REFERENCE_10]: {$exists: true, $nin: [null, ""]}}
        ]
      }
    ]
  };

  debugLog("Query criteria:", JSON.stringify(criteria, null, 2));

  const total = await collection.countDocuments(criteria);
  debugLog(`Found ${total} group walks with coordinates or grid reference but missing postcode`);

  if (!total) {
    debugLog("No walks found matching criteria - checking why...");
    const walksWithoutPostcode = await collection.countDocuments({
      [GroupEventField.ITEM_TYPE]: RamblersEventType.GROUP_WALK,
      $or: [
        {[GroupEventField.START_LOCATION_POSTCODE]: {$exists: false}},
        {[GroupEventField.START_LOCATION_POSTCODE]: null},
        {[GroupEventField.START_LOCATION_POSTCODE]: ""}
      ]
    });
    debugLog(`Group walks missing postcode: ${walksWithoutPostcode}`);

    const walksWithGridRef = await collection.countDocuments({
      [GroupEventField.ITEM_TYPE]: RamblersEventType.GROUP_WALK,
      $or: [
        {[GroupEventField.START_LOCATION_GRID_REFERENCE_6]: {$exists: true, $nin: [null, ""]}},
        {[GroupEventField.START_LOCATION_GRID_REFERENCE_8]: {$exists: true, $nin: [null, ""]}},
        {[GroupEventField.START_LOCATION_GRID_REFERENCE_10]: {$exists: true, $nin: [null, ""]}}
      ]
    });
    debugLog(`Group walks with grid reference: ${walksWithGridRef}`);

    const sampleWalk = await collection.findOne({[GroupEventField.ITEM_TYPE]: RamblersEventType.GROUP_WALK});
    debugLog("Sample walk structure:", JSON.stringify(sampleWalk, null, 2));
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
  }).batchSize(50);

  let processed = 0;
  let updated = 0;
  let failedLookups = 0;
  const preferredCounty = await preferredCountyFromSystemConfig(debugLog);
  const areaCenter = await preferredAreaCenterFromSystemConfig(debugLog);
  const areaCenterLatLng = areaCenter ? { lat: areaCenter[0], lng: areaCenter[1] } : null;
  const docs = await cursor.toArray();
  for (const doc of docs) {
    processed++;
    const id = doc._id;
    const title = doc?.groupEvent?.title;
    const lat = doc?.groupEvent?.start_location?.latitude;
    const lng = doc?.groupEvent?.start_location?.longitude;
    const gridReference = gridReferenceAudit(doc);
    const gridRef6 = gridReference.gridReference6;
    const gridRef8 = gridReference.gridReference8;
    const gridRef10 = gridReference.gridReference10;
    const gridRef = gridReference.validGridReference;
    let gridReferenceDistanceMiles: number | null = null;
    let gridReferenceLookupFailed = false;
    let clearedInvalidGridReferences = false;

    if (gridReference.invalidFields.length > 0) {
      await collection.updateOne({_id: id}, {$unset: gridReference.unsetPayload});
      clearedInvalidGridReferences = true;
    }

    debugLog(`Processing walk ${id} "${title}": lat=${lat}, lng=${lng}, gridRef=${gridRef}`);

    let lookup: GridReferenceLookupResponse | null = null;
    let matchType: GeocodeMatchData["matchType"] | null = null;

    debugLog(`Checking if coordinates are valid: lat=${lat}, lng=${lng}, isValid=${lat && lng && lat !== 0 && lng !== 0}`);
    if (lat && lng && lat !== 0 && lng !== 0) {
      debugLog(`Trying reverse geocode for walk ${id}: lat=${lat}, lng=${lng}`);
      lookup = await reverseGeocodeLookup({lat, lng});
      if (lookup?.postcode) {
        matchType = GeocodeMatchType.COORDINATES;
      }
    }

    debugLog(`Checking if should try grid reference: lookup?.postcode=${lookup?.postcode}, gridRef=${gridRef}`);
    if (!lookup?.postcode && gridRef) {
      debugLog(`Trying grid reference lookup for walk ${id}: gridRef=${gridRef}`);
      lookup = await lookupFromGridReference(gridRef);
      if (lookup?.postcode) {
        matchType = GeocodeMatchType.GRID_REFERENCE;
        if (lookup.latlng && areaCenterLatLng) {
          gridReferenceDistanceMiles = distanceMiles(lookup.latlng, areaCenterLatLng);
          debugLog(`Grid reference ${gridRef} is ${gridReferenceDistanceMiles.toFixed(1)} miles from area center`);
          if (gridReferenceDistanceMiles > maxAreaDistanceMiles) {
            lookup = null;
            matchType = null;
            gridReferenceLookupFailed = true;
          }
        }
      } else {
        gridReferenceLookupFailed = true;
      }
    }

    const hasCoordinates = !!(lat && lng && lat !== 0 && lng !== 0);
    const shouldTryTextFallback = !hasCoordinates && (!lookup?.postcode || !matchType);

    if (!lookup || lookup.error || !lookup.postcode || !matchType) {
      debugLog(`Failed lookup for walk ${id} "${title}": lat=${lat}, lng=${lng}, gridRef=${gridRef}, error=${lookup?.error}`);
      const failureNotesParts = [
        lookup?.error ? `lookup error: ${lookup?.error}` : null,
        lat && lng ? `lat=${lat.toFixed(6)}, lng=${lng.toFixed(6)}` : null,
        gridRef ? `gridRef=${gridRef}` : null,
        gridReferenceDistanceMiles !== null ? `gridRefDistance=${gridReferenceDistanceMiles.toFixed(1)} miles` : null
      ].filter(Boolean);
      if (shouldTryTextFallback) {
        const fallbackGridReference = gridReferenceLookupFailed
          ? gridReferenceAudit(doc, true)
          : gridReference;
        const fallbackResult = await geocodeFromText({
          title: doc?.groupEvent?.title || "",
          description: doc?.groupEvent?.description || "",
          preferredCounty,
          debugLog
        });
        if (fallbackResult.lookup?.postcode && fallbackResult.matchType) {
          const updateResult = textGeocodeUpdate({
            doc,
            lookup: fallbackResult.lookup,
            matchType: fallbackResult.matchType,
            sourceText: fallbackResult.sourceText,
            sourceField: fallbackResult.sourceField,
            gridReference: fallbackGridReference
          });

          updateResult.update.$push = { events: updateResult.event };

          debugLog(`Updating walk ${id} "${title}" with:`, JSON.stringify(updateResult.update.$set));
          const updateResponse = await collection.updateOne({ _id: id }, updateResult.update);
          if (updateResponse.modifiedCount > 0) {
            updated++;
            debugLog(`Updated walk ${id} "${title}": postcode=${fallbackResult.lookup.postcode}, event recorded`);
          }
          continue;
        }
        failedLookups++;
        continue;
      }
      const failureEvent: WalkEvent = {
        eventType: EventType.LOCATION_GEOCODED,
        date: dateTimeNowAsValue(),
        memberId: "migration",
        description: "Reverse geocode lookup failed",
        notes: `Unable to resolve location (${failureNotesParts.join("; ")})`,
        data: walkEventDataFrom(doc, gridReference.updateSet)
      };
      await collection.updateOne({_id: id}, {$push: {events: failureEvent}} as any);
      failedLookups++;
      continue;
    }

    const update: any = {
      $set: {
        [GroupEventField.START_LOCATION_POSTCODE]: lookup.postcode
      }
    };

    debugLog(`Checking if should update coordinates: lookup.latlng?.lat=${lookup.latlng?.lat}, lat=${lat}`);
    if (lookup.latlng?.lat && (!lat || lat === 0)) {
      update.$set[GroupEventField.START_LOCATION_LATITUDE] = lookup.latlng.lat;
    }
    if (lookup.latlng?.lng && (!lng || lng === 0)) {
      update.$set[GroupEventField.START_LOCATION_LONGITUDE] = lookup.latlng.lng;
    }

    debugLog(`Checking if should update grid references: gridRef6=${gridRef6}, lookup.gridReference6=${lookup.gridReference6}`);
    if (!gridRef6 && lookup.gridReference6) {
      update.$set[GroupEventField.START_LOCATION_GRID_REFERENCE_6] = lookup.gridReference6;
    }
    if (!gridRef8 && lookup.gridReference8) {
      update.$set[GroupEventField.START_LOCATION_GRID_REFERENCE_8] = lookup.gridReference8;
    }
    if (!gridRef10 && lookup.gridReference10) {
      update.$set[GroupEventField.START_LOCATION_GRID_REFERENCE_10] = lookup.gridReference10;
    }
    if (!doc.groupEvent?.start_location?.description && lookup.description) {
      update.$set[GroupEventField.START_LOCATION_DESCRIPTION] = lookup.description;
    }

    const geocodeEvent: WalkEvent = {
      eventType: EventType.LOCATION_GEOCODED,
      date: dateTimeNowAsValue(),
      memberId: "migration",
      description: `Location geocoded from ${matchType}`,
      notes: matchType === GeocodeMatchType.COORDINATES
        ? `Reverse geocoded lat=${lat}, lng=${lng} to postcode ${lookup.postcode}`
        : `Resolved grid reference ${gridRef} to postcode ${lookup.postcode}`,
      data: walkEventDataFrom(doc, {...update.$set, ...gridReference.updateSet})
    };

    update.$push = { events: geocodeEvent };

    debugLog(`Updating walk ${id} "${title}" with:`, JSON.stringify(update.$set));
    const result = await collection.updateOne({_id: id}, update);
    if (result.modifiedCount > 0) {
      updated++;
      debugLog(`Updated walk ${id} "${title}": postcode=${lookup.postcode}, gridRef6=${lookup.gridReference6}, event recorded`);
    }
  }

  debugLog(`Completed reverse geocoding: processed=${processed}, updated=${updated}, failedLookups=${failedLookups}`);
}

export async function down(db: Db, client: MongoClient) {
  debugLog("No down migration; reverse geocode enrichment is not reversible");
}
