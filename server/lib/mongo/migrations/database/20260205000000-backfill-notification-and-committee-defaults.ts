import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { NOTIFICATION_CONFIG_DEFAULTS } from "../../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { RoleType } from "../../../../../projects/ngx-ramblers/src/app/models/committee.model";

const debugLog = createMigrationLogger("backfill-notification-and-committee-defaults");
const NOTIFICATION_CONFIGS_COLLECTION = "notificationConfigs";
const CONFIG_COLLECTION = "config";

async function backfillNotificationConfigs(db: Db) {
  const collection = db.collection(NOTIFICATION_CONFIGS_COLLECTION);

  for (const config of NOTIFICATION_CONFIG_DEFAULTS) {
    const existing = await collection.findOne({ "subject.text": config.subject.text });
    if (existing) {
      debugLog(`Notification config "${config.subject.text}" already exists, skipping`);
      continue;
    }

    await collection.insertOne(config);
    debugLog(`Added notification config: ${config.subject.text}`);
  }
}

async function backfillNotificationDefaults(db: Db) {
  const collection = db.collection(NOTIFICATION_CONFIGS_COLLECTION);
  const monthsResult = await collection.updateMany(
    {
      $or: [
        { monthsInPast: { $exists: false } },
        { monthsInPast: null }
      ]
    },
    { $set: { monthsInPast: 1 } }
  );
  debugLog(`Updated ${monthsResult.modifiedCount} notification configs with missing monthsInPast`);
  const memberSelectionResult = await collection.updateMany(
    {
      $or: [
        { defaultMemberSelection: { $exists: false } },
        { defaultMemberSelection: null }
      ]
    },
    { $set: { defaultMemberSelection: "recently-added" } }
  );
  debugLog(`Updated ${memberSelectionResult.modifiedCount} notification configs with missing defaultMemberSelection`);
}

async function ensureEnquiriesRole(db: Db) {
  const configCollection = db.collection(CONFIG_COLLECTION);
  const committeeConfig = await configCollection.findOne({ key: "committee" });

  if (!committeeConfig) {
    debugLog("No committee config found, skipping enquiries role backfill");
    return;
  }

  const roles = committeeConfig.value?.roles || [];
  const hasEnquiries = roles.some((role: { type: string }) => role.type === "enquiries");

  if (hasEnquiries) {
    debugLog("Enquiries role already exists, skipping");
    return;
  }

  const enquiriesRole = {
    type: "enquiries",
    description: "Enquiries",
    email: "",
    fullName: "(Vacant)",
    memberId: null,
    nameAndDescription: "(Vacant) - Enquiries",
    vacant: true,
    roleType: RoleType.SYSTEM_ROLE
  };

  await configCollection.updateOne(
    { key: "committee" },
    { $push: { "value.roles": enquiriesRole } as any }
  );

  debugLog("Added missing enquiries role to committee config");
}

export async function up(db: Db, client: MongoClient) {
  await backfillNotificationConfigs(db);
  await backfillNotificationDefaults(db);
  await ensureEnquiriesRole(db);
}

export async function down(db: Db, client: MongoClient) {
  debugLog("No down migration - notification configs are intentionally left in place");
}
