import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";

const debugLog = createMigrationLogger("add-walk-config-help-content");
const CONTENT_TEXT_COLLECTION = "contentTexts";
const CONFIG_COLLECTION = "config";
const WALKS_CONFIG_KEY = "walks";
const WALKS_COLLECTION = "extendedGroupEvents";
const CATEGORY = "walks-admin";
const OLD_NAME = "meetup-settings-help";
const NEW_NAME = "walk-config-help";
const NEW_TEXT = "* Configure walk validation rules and default walking pace\n" +
  "* Maintain content that automatically gets added to our walk description\n" +
  "* Configure defaults for Meetup publishing";

export async function up(db: Db, _client: MongoClient) {
  const contentTexts = db.collection(CONTENT_TEXT_COLLECTION);
  const existing = await contentTexts.findOne({name: NEW_NAME, category: CATEGORY});
  if (existing) {
    debugLog(`Content text "${NEW_NAME}" already exists, skipping insert`);
  } else {
    await contentTexts.insertOne({name: NEW_NAME, category: CATEGORY, text: NEW_TEXT});
    debugLog(`Added content text: ${NEW_NAME}`);
  }
  const deleted = await contentTexts.deleteOne({name: OLD_NAME, category: CATEGORY});
  if (deleted.deletedCount > 0) {
    debugLog(`Removed old content text: ${OLD_NAME}`);
  } else {
    debugLog(`Content text "${OLD_NAME}" not found, nothing to remove`);
  }
  const riskAssessmentsExist = await db.collection(WALKS_COLLECTION).findOne({"fields.riskAssessment": {$exists: true, $not: {$size: 0}}}) !== null;
  debugLog(`Risk assessments exist in database: ${riskAssessmentsExist}`);
  await db.collection(CONFIG_COLLECTION).updateOne(
    {key: WALKS_CONFIG_KEY},
    {$set: {"value.requireRiskAssessment": riskAssessmentsExist}},
    {upsert: false}
  );
  debugLog(`Set requireRiskAssessment to ${riskAssessmentsExist} in walks config`);
}

export async function down(db: Db, _client: MongoClient) {
  const contentTexts = db.collection(CONTENT_TEXT_COLLECTION);
  await contentTexts.deleteOne({name: NEW_NAME, category: CATEGORY});
  debugLog(`Removed content text: ${NEW_NAME}`);
  const existing = await contentTexts.findOne({name: OLD_NAME, category: CATEGORY});
  if (!existing) {
    await contentTexts.insertOne({
      name: OLD_NAME,
      category: CATEGORY,
      text: "* Maintain content that automatically gets added to our walk description\n" +
        "* Configure defaults for Meetup publishing"
    });
    debugLog(`Restored old content text: ${OLD_NAME}`);
  }
  await db.collection(CONFIG_COLLECTION).updateOne(
    {key: WALKS_CONFIG_KEY},
    {$unset: {"value.requireRiskAssessment": ""}},
    {upsert: false}
  );
  debugLog(`Removed requireRiskAssessment from walks config`);
}
