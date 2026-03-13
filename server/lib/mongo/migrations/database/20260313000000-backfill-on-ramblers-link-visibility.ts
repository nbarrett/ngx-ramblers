import { Db, MongoClient } from "mongodb";
import { keys } from "es-toolkit/compat";
import createMigrationLogger from "../migrations-logger";
import { ConfigKey } from "../../../../../projects/ngx-ramblers/src/app/models/config.model";

const debugLog = createMigrationLogger("backfill-on-ramblers-link-visibility");
const CONFIG_COLLECTION = "config";

export async function up(db: Db, client: MongoClient) {
  const collection = db.collection(CONFIG_COLLECTION);
  const systemConfig = await collection.findOne({key: ConfigKey.SYSTEM});

  if (!systemConfig?.value?.group) {
    debugLog("No system config group found, skipping");
    return;
  }

  const updates: Record<string, boolean> = {};

  if (systemConfig.value.group.showWalkOnRamblersLink === null || systemConfig.value.group.showWalkOnRamblersLink === undefined) {
    updates["value.group.showWalkOnRamblersLink"] = true;
  }

  if (systemConfig.value.group.showSocialOnRamblersLink === null || systemConfig.value.group.showSocialOnRamblersLink === undefined) {
    updates["value.group.showSocialOnRamblersLink"] = true;
  }

  if (keys(updates).length === 0) {
    debugLog("On Ramblers link visibility flags already present, skipping");
    return;
  }

  const result = await collection.updateOne(
    {key: ConfigKey.SYSTEM},
    {$set: updates}
  );

  debugLog(`Backfilled On Ramblers link visibility flags for ${result.modifiedCount} system config`);
}

export async function down(db: Db, client: MongoClient) {
  const collection = db.collection(CONFIG_COLLECTION);
  const systemConfig = await collection.findOne({key: ConfigKey.SYSTEM});

  if (!systemConfig?.value?.group) {
    debugLog("No system config group found, skipping rollback");
    return;
  }

  const unsets: Record<string, string> = {};

  if (systemConfig.value.group.showWalkOnRamblersLink === true) {
    unsets["value.group.showWalkOnRamblersLink"] = "";
  }

  if (systemConfig.value.group.showSocialOnRamblersLink === true) {
    unsets["value.group.showSocialOnRamblersLink"] = "";
  }

  if (keys(unsets).length === 0) {
    debugLog("No On Ramblers link visibility flags to roll back");
    return;
  }

  const result = await collection.updateOne(
    {key: ConfigKey.SYSTEM},
    {$unset: unsets}
  );

  debugLog(`Rolled back On Ramblers link visibility flags for ${result.modifiedCount} system config`);
}
