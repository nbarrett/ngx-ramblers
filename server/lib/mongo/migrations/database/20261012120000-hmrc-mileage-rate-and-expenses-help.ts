import { Db, MongoClient } from "mongodb";
import { ConfigKey } from "../../../../../projects/ngx-ramblers/src/app/models/config.model";
import { DEFAULT_COST_PER_MILE } from "../../../../../projects/ngx-ramblers/src/app/models/committee.model";
import { COMMITTEE_EXPENSES_HELP } from "../../../../../projects/ngx-ramblers/src/app/pages/admin/default-content";
import createMigrationLogger from "../migrations-logger";
import { CONFIG_COLLECTION, CONTENT_TEXT_COLLECTION } from "../shared/collection-names";
import { CONTENT_TEXT_APP_COLLECTION } from "../shared/upsert-content-text";

const debugLog = createMigrationLogger("hmrc-mileage-rate-and-expenses-help");
const PREVIOUS_HMRC_COST_PER_MILE = 0.45;
const CONTENT_TEXT_COLLECTIONS = [CONTENT_TEXT_COLLECTION, CONTENT_TEXT_APP_COLLECTION];

function matchesPreviousHmrcRate(value: unknown): boolean {
  const asNumber = Number(value);
  return Number.isFinite(asNumber) && asNumber === PREVIOUS_HMRC_COST_PER_MILE;
}

function alreadyAtHmrcRate(value: unknown): boolean {
  const asNumber = Number(value);
  return Number.isFinite(asNumber) && asNumber === DEFAULT_COST_PER_MILE;
}

async function applyHmrcMileageRate(db: Db): Promise<void> {
  const configCollection = db.collection(CONFIG_COLLECTION);
  const committeeConfig = await configCollection.findOne({key: ConfigKey.COMMITTEE});
  if (!committeeConfig) {
    debugLog("No committee config found, skipping mileage update");
  } else {
    const currentRate = committeeConfig.value?.expenses?.costPerMile;
    if (alreadyAtHmrcRate(currentRate)) {
      debugLog(`Cost per mile is already ${DEFAULT_COST_PER_MILE}, skipping`);
    } else if (matchesPreviousHmrcRate(currentRate)) {
      await configCollection.updateOne(
        {key: ConfigKey.COMMITTEE},
        {$set: {"value.expenses.costPerMile": DEFAULT_COST_PER_MILE}}
      );
      debugLog(`Updated costPerMile from the previous HMRC rate ${PREVIOUS_HMRC_COST_PER_MILE} to ${DEFAULT_COST_PER_MILE}`);
    } else {
      debugLog(`Left local costPerMile of ${String(currentRate)} unchanged`);
    }
  }
}

async function applyCommitteeExpensesHelp(db: Db, collectionName: string): Promise<void> {
  const collection = db.collection(collectionName);
  const existing = await collection.findOne({
    name: COMMITTEE_EXPENSES_HELP.name,
    category: COMMITTEE_EXPENSES_HELP.category
  });
  if (!existing) {
    await collection.insertOne({...COMMITTEE_EXPENSES_HELP});
    debugLog(`Added content text in ${collectionName}: ${COMMITTEE_EXPENSES_HELP.name}`);
  } else if (existing.text === COMMITTEE_EXPENSES_HELP.text) {
    debugLog(`Content text in ${collectionName} already current: ${COMMITTEE_EXPENSES_HELP.name}`);
  } else {
    await collection.updateOne({_id: existing._id}, {$set: {text: COMMITTEE_EXPENSES_HELP.text}});
    debugLog(`Updated content text in ${collectionName}: ${COMMITTEE_EXPENSES_HELP.name}`);
  }
}

export async function up(db: Db, _client: MongoClient): Promise<void> {
  await applyHmrcMileageRate(db);
  await CONTENT_TEXT_COLLECTIONS.reduce<Promise<void>>(
    (previous, collectionName) => previous.then(() => applyCommitteeExpensesHelp(db, collectionName)),
    Promise.resolve()
  );
}

export async function down(_db: Db, _client: MongoClient): Promise<void> {
  debugLog("No-op: mileage rate and expenses help refresh is non-destructive");
}
