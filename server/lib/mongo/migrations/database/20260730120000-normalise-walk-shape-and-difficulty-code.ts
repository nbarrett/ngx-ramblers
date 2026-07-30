import { Db } from "mongodb";
import { GroupEventField, WALK_GRADES, WalkType } from "../../../../../projects/ngx-ramblers/src/app/models/walk.model";
import { RamblersEventType } from "../../../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { pluraliseWithCount } from "../../../shared/string-utils";
import createMigrationLogger from "../migrations-logger";

const debugLog = createMigrationLogger("normalise-walk-shape-and-difficulty-code");

const WALK_ITEM_TYPES = [RamblersEventType.GROUP_WALK, RamblersEventType.WELLBEING_WALK];
const DIFFICULTY_CODE = `${GroupEventField.DIFFICULTY}.code`;
const DIFFICULTY_DESCRIPTION = `${GroupEventField.DIFFICULTY}.description`;

export async function up(db: Db) {
  const events = db.collection("extendedgroupevents");
  const walkFilter = {[GroupEventField.ITEM_TYPE]: {$in: WALK_ITEM_TYPES}};
  const missingOrEmpty = (field: string) => ({$or: [{[field]: {$exists: false}}, {[field]: {$in: [null, ""]}}]});

  const lowerCased = await events.updateMany(
    {...walkFilter, [GroupEventField.SHAPE]: {$type: "string"}},
    [{$set: {[GroupEventField.SHAPE]: {$toLower: `$${GroupEventField.SHAPE}`}}}]
  );
  debugLog("walk shape lower-cased on", pluraliseWithCount(lowerCased.modifiedCount, "walk"));

  const defaulted = await events.updateMany(
    {...walkFilter, ...missingOrEmpty(GroupEventField.SHAPE)},
    {$set: {[GroupEventField.SHAPE]: WalkType.CIRCULAR.toLowerCase()}}
  );
  debugLog("walk shape defaulted to circular on", pluraliseWithCount(defaulted.modifiedCount, "walk"), "that had no shape");

  const clearedFromGroupEvents = await events.updateMany(
    {[GroupEventField.ITEM_TYPE]: RamblersEventType.GROUP_EVENT, [GroupEventField.SHAPE]: {$exists: true}},
    {$unset: {[GroupEventField.SHAPE]: ""}}
  );
  debugLog("walk shape removed from", pluraliseWithCount(clearedFromGroupEvents.modifiedCount, "group event"), "which should never carry one");

  const difficultyCodesApplied = await WALK_GRADES.reduce(async (previousTotal, grade) => {
    const runningTotal = await previousTotal;
    const result = await events.updateMany(
      {
        ...walkFilter,
        [DIFFICULTY_DESCRIPTION]: {$regex: `^${grade.description}$`, $options: "i"},
        ...missingOrEmpty(DIFFICULTY_CODE)
      },
      {$set: {[DIFFICULTY_CODE]: grade.code}}
    );
    debugLog("difficulty code", grade.code, "applied to", pluraliseWithCount(result.modifiedCount, "walk"));
    return runningTotal + result.modifiedCount;
  }, Promise.resolve(0));
  debugLog("difficulty codes backfilled on", pluraliseWithCount(difficultyCodesApplied, "walk"), "in total");
}

export async function down() {
  debugLog("Down is a no-op: the original mixed shape casing and absent difficulty codes carry no information worth restoring");
}
