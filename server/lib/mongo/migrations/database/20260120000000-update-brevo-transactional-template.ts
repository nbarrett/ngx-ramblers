import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { MigrationUpResult } from "../../../../../projects/ngx-ramblers/src/app/models/mongo-migration-model";

const debugLog = createMigrationLogger("update-brevo-transactional-template");

export async function up(_db: Db, _client: MongoClient): Promise<MigrationUpResult | void> {
  const reason = "Email templates are rendered in NGX and sent via the Brevo API; Brevo no longer stores templates";
  debugLog(reason);
  return {skipped: true, reason};
}

export async function down(_db: Db, _client: MongoClient) {
  debugLog("Down migration not implemented - template content cannot be automatically reverted");
}
