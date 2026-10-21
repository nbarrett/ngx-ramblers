import { Db, MongoClient } from "mongodb";
import { MigrationUpResult } from "../../../../../projects/ngx-ramblers/src/app/models/mongo-migration-model";
import { migrateZoneInboxRouter } from "../shared/zone-inbox-router";
import { ensureActionButton } from "../shared/page-content-actions";
import { CLOUDFLARE_WORKERS_MENU_ITEM } from "../shared/admin-menu-items";
import { AdminPlatformPath } from "../../../../../projects/ngx-ramblers/src/app/models/admin-route-paths.model";
import createMigrationLogger from "../migrations-logger";

const debugLog = createMigrationLogger("scope-inbox-router-to-zone");

export async function up(db: Db, _client: MongoClient): Promise<MigrationUpResult> {
  await ensureActionButton(db, `${AdminPlatformPath.ROOT}#action-buttons`, CLOUDFLARE_WORKERS_MENU_ITEM, debugLog);
  const result = await migrateZoneInboxRouter(db);
  if (result.reason) {
    debugLog(result.reason);
  }
  return result;
}

export async function down(_db: Db, _client: MongoClient): Promise<void> {
  debugLog("Zone inbox routers and SSL settings retained; reverting would restore shared fallback ownership");
}
