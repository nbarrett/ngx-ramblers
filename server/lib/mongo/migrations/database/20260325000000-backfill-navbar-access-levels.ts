import { Db } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { systemConfig } from "../../../config/system-config";
import { createOrUpdateKey } from "../../controllers/config";
import { ConfigKey } from "../../../../../projects/ngx-ramblers/src/app/models/config.model";
import { AccessLevel } from "../../../../../projects/ngx-ramblers/src/app/models/member-resource.model";

const debugLog = createMigrationLogger("backfill-navbar-access-levels");
const DEFAULT_ACCESS_LEVEL = AccessLevel.PUBLIC;

export async function up(_db: Db) {
  const config = await systemConfig();

  if (!config?.group?.pages) {
    debugLog("No group pages found in system config — skipping");
    return;
  }

  const pages = config.group.pages;
  let updated = 0;

  pages.forEach(page => {
    if (!page.accessLevel) {
      page.accessLevel = DEFAULT_ACCESS_LEVEL;
      updated++;
    }
  });

  if (updated > 0) {
    await createOrUpdateKey(ConfigKey.SYSTEM, config);
    debugLog("Backfilled accessLevel on %d of %d navbar items", updated, pages.length);
  } else {
    debugLog("All %d navbar items already have accessLevel set", pages.length);
  }
}

export async function down(_db: Db) {
  const config = await systemConfig();

  if (!config?.group?.pages) {
    return;
  }

  const pages = config.group.pages;
  pages.forEach(page => {
    delete page.accessLevel;
  });

  await createOrUpdateKey(ConfigKey.SYSTEM, config);
  debugLog("Removed accessLevel from %d navbar items", pages.length);
}
