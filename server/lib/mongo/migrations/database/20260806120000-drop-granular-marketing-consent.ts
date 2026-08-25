import { Db } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { ConfigKey } from "../../../../../projects/ngx-ramblers/src/app/models/config.model";

const debugLog = createMigrationLogger("drop-granular-marketing-consent");

const GRANULAR_CONSENT_FIELDS = ["groupMarketingConsent", "areaMarketingConsent", "otherMarketingConsent"];

const unsetSpec = Object.fromEntries(GRANULAR_CONSENT_FIELDS.map(field => [field, ""]));
const existsFilter = {$or: GRANULAR_CONSENT_FIELDS.map(field => ({[field]: {$exists: true}}))};

export async function up(db: Db) {
  const memberResult = await db.collection("members").updateMany(existsFilter, {$unset: unsetSpec});
  debugLog("cleared granular marketing consent from %d members", memberResult.modifiedCount);

  const auditResult = await db.collection("memberBulkLoadAudit")
    .updateMany(
      {members: {$exists: true, $type: "array"}},
      {$unset: Object.fromEntries(GRANULAR_CONSENT_FIELDS.map(field => [`members.$[].${field}`, ""]))}
    );
  debugLog("cleared granular marketing consent from %d bulk load audits", auditResult.modifiedCount);

  const notificationResult = await db.collection("memberSyncNotifications")
    .deleteMany({fieldName: {$in: GRANULAR_CONSENT_FIELDS}});
  debugLog("deleted %d granular marketing consent sync notifications", notificationResult.deletedCount);

  const configResult = await db.collection("config")
    .updateOne({key: ConfigKey.SALESFORCE}, {$unset: {"value.enableGranularConsent": ""}});
  debugLog("cleared enableGranularConsent from %d salesforce config documents", configResult.modifiedCount);
}

export async function down(_db: Db) {
  debugLog("down: no-op, granular marketing consent was dropped from the wire contract");
}
