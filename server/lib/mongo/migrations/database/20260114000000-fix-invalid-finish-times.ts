import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { DateTime } from "luxon";
import { EventType, GroupEventField, EventField } from "../../../../../projects/ngx-ramblers/src/app/models/walk.model";
import { InputSource } from "../../../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { RamblersEventType } from "../../../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { WalkEvent } from "../../../../../projects/ngx-ramblers/src/app/models/walk-event.model";
import { dateTimeNowAsValue } from "../../../shared/dates";
import { walkEventDataFrom } from "../migration-walk-event";

const debugLog = createMigrationLogger("fix-invalid-finish-times");
debugLog.enabled = true;

const DEFAULT_MILES_PER_HOUR = 2.5;

function durationInMsecsForDistanceInMiles(distance: number, milesPerHour: number): number {
  return (distance / milesPerHour) * 60 * 60 * 1000;
}

function calculateFinishTime(startDateTime: string, distanceMiles: number, milesPerHour: number): string {
  const startMillis = DateTime.fromISO(startDateTime).toMillis();
  const durationMillis = durationInMsecsForDistanceInMiles(distanceMiles, milesPerHour || DEFAULT_MILES_PER_HOUR);
  const finishMillis = startMillis + durationMillis;

  let finishDateTime = DateTime.fromMillis(finishMillis);
  const minutes = finishDateTime.minute;
  const remainder = minutes % 15;
  if (remainder !== 0) {
    finishDateTime = finishDateTime.plus({ minutes: 15 - remainder });
  }
  finishDateTime = finishDateTime.set({ second: 0, millisecond: 0 });

  return finishDateTime.toISO();
}

function isInvalidFinishTime(startDateTime: string, endDateTime: string): boolean {
  if (!startDateTime || !endDateTime) {
    return false;
  }
  const start = DateTime.fromISO(startDateTime);
  const end = DateTime.fromISO(endDateTime);

  if (!start.isValid || !end.isValid) {
    return false;
  }

  return end <= start;
}

export async function up(db: Db, client: MongoClient) {
  const collection = db.collection("extendedgroupevents");

  debugLog("Finding FILE_IMPORT walks with invalid finish times (end_date_time <= start_date_time)");

  const totalFileImportWalks = await collection.countDocuments({
    [GroupEventField.ITEM_TYPE]: RamblersEventType.GROUP_WALK,
    [EventField.INPUT_SOURCE]: InputSource.FILE_IMPORT
  });
  debugLog(`Total FILE_IMPORT group walks in database: ${totalFileImportWalks}`);

  const criteria = {
    [GroupEventField.ITEM_TYPE]: RamblersEventType.GROUP_WALK,
    [EventField.INPUT_SOURCE]: InputSource.FILE_IMPORT,
    [GroupEventField.START_DATE]: { $exists: true, $ne: null },
    [GroupEventField.END_DATE_TIME]: { $exists: true, $ne: null },
    [GroupEventField.DISTANCE_MILES]: { $exists: true, $gt: 0 }
  };

  debugLog("Query criteria:", JSON.stringify(criteria, null, 2));

  const cursor = collection.find(criteria, {
    projection: {
      [GroupEventField.TITLE]: 1,
      [GroupEventField.START_DATE]: 1,
      [GroupEventField.END_DATE_TIME]: 1,
      [GroupEventField.DISTANCE_MILES]: 1,
      [EventField.MILES_PER_HOUR]: 1
    }
  }).batchSize(100);

  let processed = 0;
  let updated = 0;
  let skipped = 0;

  const docs = await cursor.toArray();
  for (const doc of docs) {
    processed++;
    const id = doc._id;
    const title = doc?.groupEvent?.title;
    const startDateTime = doc?.groupEvent?.start_date_time;
    const endDateTime = doc?.groupEvent?.end_date_time;
    const distanceMiles = doc?.groupEvent?.distance_miles;
    const milesPerHour = doc?.fields?.milesPerHour || DEFAULT_MILES_PER_HOUR;

    if (!isInvalidFinishTime(startDateTime, endDateTime)) {
      skipped++;
      continue;
    }

    debugLog(`Walk ${id} "${title}": start=${startDateTime}, end=${endDateTime} (INVALID - end <= start)`);

    const newEndDateTime = calculateFinishTime(startDateTime, distanceMiles, milesPerHour);

    debugLog(`Calculated new finish time: ${newEndDateTime} (distance=${distanceMiles} miles, mph=${milesPerHour})`);

    const fixEvent: WalkEvent = {
      eventType: EventType.FINISH_TIME_FIXED,
      date: dateTimeNowAsValue(),
      memberId: "migration",
      description: "Fixed invalid finish time",
      notes: `Finish time was ${endDateTime} (before start time ${startDateTime}). Recalculated to ${newEndDateTime} based on ${distanceMiles} miles at ${milesPerHour} mph.`,
      data: walkEventDataFrom(doc, {
        [GroupEventField.END_DATE_TIME]: newEndDateTime
      })
    };

    const update: any = {
      $set: {
        [GroupEventField.END_DATE_TIME]: newEndDateTime
      },
      $push: {
        events: fixEvent
      }
    };

    const result = await collection.updateOne({ _id: id }, update);
    if (result.modifiedCount > 0) {
      updated++;
      debugLog(`Updated walk ${id} "${title}": end_date_time changed from ${endDateTime} to ${newEndDateTime}`);
    }
  }

  debugLog(`Completed fix-invalid-finish-times: processed=${processed}, updated=${updated}, skipped=${skipped} (valid times)`);
}

export async function down(db: Db, client: MongoClient) {
  debugLog("No down migration; finish time fixes are recorded in events for audit trail");
}
