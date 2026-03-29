import { Db } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { CONFIG_COLLECTION } from "../shared/collection-names";

const debugLog = createMigrationLogger("backfill-area-group-geometry-source");
const SYSTEM_CONFIG_KEY = "system";
const DEFAULT_GEOMETRY_SOURCE = "ons-districts";

export async function up(db: Db) {
  const configCollection = db.collection(CONFIG_COLLECTION);
  const systemConfig = await configCollection.findOne({key: SYSTEM_CONFIG_KEY});

  if (!systemConfig?.value?.area?.groups) {
    debugLog("No area groups found in system config — skipping");
    return;
  }

  const groups: any[] = systemConfig.value.area.groups;
  let updatedCount = 0;

  const updatedGroups = groups.map(group => {
    if (!group.geometrySource) {
      updatedCount++;
      return {...group, geometrySource: DEFAULT_GEOMETRY_SOURCE};
    }
    return group;
  });

  if (updatedCount > 0) {
    await configCollection.updateOne(
      {key: SYSTEM_CONFIG_KEY},
      {$set: {"value.area.groups": updatedGroups}}
    );
    debugLog("Backfilled geometrySource=%s on %d of %d area groups", DEFAULT_GEOMETRY_SOURCE, updatedCount, groups.length);
  } else {
    debugLog("All %d area groups already have geometrySource set — no changes needed", groups.length);
  }
}

export async function down(db: Db) {
  const configCollection = db.collection(CONFIG_COLLECTION);
  const systemConfig = await configCollection.findOne({key: SYSTEM_CONFIG_KEY});

  if (!systemConfig?.value?.area?.groups) {
    debugLog("No area groups found in system config — skipping");
    return;
  }

  const groups: any[] = systemConfig.value.area.groups;
  let updatedCount = 0;

  const updatedGroups = groups.map(group => {
    if (group.geometrySource === DEFAULT_GEOMETRY_SOURCE) {
      updatedCount++;
      const {geometrySource, ...rest} = group;
      return rest;
    }
    return group;
  });

  if (updatedCount > 0) {
    await configCollection.updateOne(
      {key: SYSTEM_CONFIG_KEY},
      {$set: {"value.area.groups": updatedGroups}}
    );
    debugLog("Removed geometrySource from %d area groups", updatedCount);
  } else {
    debugLog("No area groups had geometrySource=%s — no changes needed", DEFAULT_GEOMETRY_SOURCE);
  }
}
