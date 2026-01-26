import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { postcodeLookupFromPostcodesIo } from "../../../addresses/postcode-lookup";
import { GridReferenceLookupApiResponse, GridReferenceLookupResponse } from "../../../../../projects/ngx-ramblers/src/app/models/address-model";
import { inferVenueTypeFromName } from "../../../../../projects/ngx-ramblers/src/app/models/event-venue.model";
import { EventField, GroupEventField } from "../../../../../projects/ngx-ramblers/src/app/models/walk.model";
import { dateTimeNowAsValue, dateTimeFromJsDate } from "../../../shared/dates";

const debugLog = createMigrationLogger("populate-venues-collection");

async function lookupPostcode(postcode: string): Promise<GridReferenceLookupResponse | null> {
  const trimmedPostcode = (postcode || "").trim();
  if (!trimmedPostcode) {
    return null;
  }
  try {
    const result: GridReferenceLookupApiResponse = await postcodeLookupFromPostcodesIo(trimmedPostcode);
    return result.response as GridReferenceLookupResponse;
  } catch (error) {
    debugLog(`lookupPostcode error for ${trimmedPostcode}:`, error);
    return null;
  }
}

export async function up(db: Db, client: MongoClient) {
  const walksCollection = db.collection("extendedgroupevents");
  const venuesCollection = db.collection("venues");

  const existingCount = await venuesCollection.countDocuments();
  if (existingCount > 0) {
    debugLog(`Venues collection already has ${existingCount} documents, skipping migration`);
    return;
  }

  const aggregationPipeline = [
    {
      $match: {
        $or: [
          {[EventField.VENUE_NAME]: {$exists: true, $nin: [null, ""]}},
          {[EventField.VENUE_POSTCODE]: {$exists: true, $nin: [null, ""]}}
        ]
      }
    },
    {
      $project: {
        startDate: `$${GroupEventField.START_DATE}`,
        venueName: `$${EventField.VENUE_NAME}`,
        venueAddress1: `$${EventField.VENUE_ADDRESS1}`,
        venueAddress2: `$${EventField.VENUE_ADDRESS2}`,
        venuePostcode: `$${EventField.VENUE_POSTCODE}`,
        venueType: `$${EventField.VENUE_TYPE}`,
        venueUrl: `$${EventField.VENUE_URL}`
      }
    },
    {
      $group: {
        _id: {
          name: {$toLower: {$trim: {input: {$ifNull: ["$venueName", ""]}}}},
          postcode: {$toLower: {$trim: {input: {$ifNull: ["$venuePostcode", ""]}}}}
        },
        name: {$first: "$venueName"},
        address1: {$first: "$venueAddress1"},
        address2: {$first: "$venueAddress2"},
        postcode: {$first: "$venuePostcode"},
        type: {$first: "$venueType"},
        url: {$first: "$venueUrl"},
        usageCount: {$sum: 1},
        lastUsed: {$max: "$startDate"}
      }
    },
    {
      $match: {
        "_id.name": {$ne: ""}
      }
    },
    {
      $sort: {usageCount: -1}
    }
  ];

  const venues = await walksCollection.aggregate(aggregationPipeline).toArray();
  debugLog(`Found ${venues.length} unique venues from walk history`);

  if (venues.length === 0) {
    debugLog("No venues to migrate");
    return;
  }

  let inserted = 0;
  let geocoded = 0;
  const now = dateTimeNowAsValue();

  for (const venue of venues) {
    const venueType = venue.type || inferVenueTypeFromName(venue.name);
    const venueDoc: any = {
      name: venue.name,
      address1: venue.address1 || null,
      address2: venue.address2 || null,
      postcode: venue.postcode || null,
      type: venueType,
      url: venue.url || null,
      usageCount: venue.usageCount || 1,
      lastUsed: venue.lastUsed ? dateTimeFromJsDate(venue.lastUsed).toMillis() : now,
      createdAt: now,
      createdBy: "migration"
    };

    if (venue.postcode) {
      const lookup = await lookupPostcode(venue.postcode);
      if (lookup?.latlng?.lat && lookup?.latlng?.lng) {
        venueDoc.lat = lookup.latlng.lat;
        venueDoc.lon = lookup.latlng.lng;
        geocoded++;
      }
    }

    try {
      await venuesCollection.insertOne(venueDoc);
      inserted++;
    } catch (error: any) {
      if (error.code === 11000) {
        debugLog(`Duplicate venue skipped: ${venue.name} (${venue.postcode})`);
      } else {
        debugLog(`Error inserting venue ${venue.name}:`, error);
      }
    }
  }

  await venuesCollection.createIndex({name: 1, postcode: 1}, {unique: true});

  debugLog(`Migration complete: inserted=${inserted}, geocoded=${geocoded}`);
}

export async function down(db: Db, client: MongoClient) {
  const venuesCollection = db.collection("venues");
  const result = await venuesCollection.deleteMany({createdBy: "migration"});
  debugLog(`Removed ${result.deletedCount} migrated venues`);
}
