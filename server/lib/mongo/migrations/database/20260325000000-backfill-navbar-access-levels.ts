import { Db } from "mongodb";
import createMigrationLogger from "../migrations-logger";

import { CONFIG_COLLECTION } from "../shared/collection-names";

const debugLog = createMigrationLogger("backfill-navbar-access-levels");
const DEFAULT_ACCESS_LEVEL = "public";

export async function up(db: Db) {
  const collection = db.collection(CONFIG_COLLECTION);
  const systemConfig = await collection.findOne({key: "system"});

  if (!systemConfig?.value?.group?.pages) {
    debugLog("No group pages found in system config — skipping");
    return;
  }

  const pages = systemConfig.value.group.pages;
  let updated = 0;

  pages.forEach((page: any) => {
    if (!page.accessLevel) {
      page.accessLevel = DEFAULT_ACCESS_LEVEL;
      updated++;
    }
  });

  if (updated > 0) {
    await collection.updateOne({key: "system"}, {$set: {"value.group.pages": pages}});
    debugLog("Backfilled accessLevel on %d of %d navbar items", updated, pages.length);
  } else {
    debugLog("All %d navbar items already have accessLevel set", pages.length);
  }
}

export async function down(db: Db) {
  const collection = db.collection(CONFIG_COLLECTION);
  const systemConfig = await collection.findOne({key: "system"});

  if (!systemConfig?.value?.group?.pages) {
    return;
  }

  const pages = systemConfig.value.group.pages;
  pages.forEach((page: any) => {
    delete page.accessLevel;
  });

  await collection.updateOne({key: "system"}, {$set: {"value.group.pages": pages}});
  debugLog("Removed accessLevel from %d navbar items", pages.length);
}
