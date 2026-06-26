import { Db } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { booleanOf } from "../../../shared/string-utils";

const debugLog = createMigrationLogger("normalise-marketing-consent-booleans");

const CONSENT_FIELDS = ["emailMarketingConsent", "groupMarketingConsent", "areaMarketingConsent", "otherMarketingConsent"];

export async function up(db: Db) {
  const members = db.collection("members");
  await Promise.all(CONSENT_FIELDS.map(async field => {
    const stringValued = await members.find({[field]: {$type: "string"}}).toArray();
    debugLog("normalising %d members whose %s is stored as a string", stringValued.length, field);
    await Promise.all(stringValued.map(doc => members.updateOne({_id: doc._id}, {$set: {[field]: booleanOf(doc[field])}})));
  }));
}

export async function down(_db: Db) {
  debugLog("down: no-op for marketing-consent boolean normalisation");
}
