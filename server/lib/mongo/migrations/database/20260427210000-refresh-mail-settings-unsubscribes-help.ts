import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { upsertContentText } from "../shared/upsert-content-text";
import { MAIL_SETTINGS_UNSUBSCRIBES_HELP } from "../../../../../projects/ngx-ramblers/src/app/pages/admin/default-content";

const debugLog = createMigrationLogger("refresh-mail-settings-unsubscribes-help");

export async function up(db: Db, _client: MongoClient): Promise<void> {
  await upsertContentText(db, MAIL_SETTINGS_UNSUBSCRIBES_HELP, debugLog);
}

export async function down(_db: Db, _client: MongoClient): Promise<void> {
  debugLog(`No-op: refresh of ${MAIL_SETTINGS_UNSUBSCRIBES_HELP.name} is non-destructive`);
}
