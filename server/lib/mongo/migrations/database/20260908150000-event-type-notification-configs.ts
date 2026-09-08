import { Db, MongoClient } from "mongodb";
import { keys } from "es-toolkit/compat";
import createMigrationLogger from "../migrations-logger";
import { CONFIG_COLLECTION, NOTIFICATION_CONFIG_COLLECTION } from "../shared/collection-names";
import { ConfigKey } from "../../../../../projects/ngx-ramblers/src/app/models/config.model";
import { RamblersEventType } from "../../../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { notificationConfigIdFieldFor } from "../../../../../projects/ngx-ramblers/src/app/functions/event-type-notification-config";

const debugLog = createMigrationLogger("event-type-notification-configs");

interface StoredNotificationConfig {
  _id: { toString(): string };
  subject?: { text?: string };
  senderRole?: string;
}

const SOCIAL_FIELD = notificationConfigIdFieldFor(RamblersEventType.GROUP_EVENT);
const WALK_FIELD = notificationConfigIdFieldFor(RamblersEventType.GROUP_WALK);

function subjectOf(config: StoredNotificationConfig): string {
  return (config.subject?.text || "").toLowerCase();
}

function roleOf(config: StoredNotificationConfig): string {
  return (config.senderRole || "").toLowerCase();
}

function socialConfig(configs: StoredNotificationConfig[]): StoredNotificationConfig | undefined {
  return configs.find(config => subjectOf(config).includes("social"))
    || configs.find(config => roleOf(config).includes("social"));
}

function newsletterConfig(configs: StoredNotificationConfig[]): StoredNotificationConfig | undefined {
  return configs.find(config => subjectOf(config).includes("newsletter"));
}

export async function up(db: Db, _client: MongoClient) {
  const configCollection = db.collection(CONFIG_COLLECTION);
  const systemConfig = await configCollection.findOne({key: ConfigKey.SYSTEM});
  if (systemConfig?.value?.group) {
    const configs = await db.collection<StoredNotificationConfig>(NOTIFICATION_CONFIG_COLLECTION).find({}).toArray();
    const group = systemConfig.value.group;
    const updates = [
      {field: SOCIAL_FIELD, config: socialConfig(configs)},
      {field: WALK_FIELD, config: newsletterConfig(configs)}
    ]
      .filter(update => !group[update.field] && update.config)
      .reduce((set, update) => ({...set, [`value.group.${update.field}`]: update.config._id.toString()}), {} as Record<string, string>);
    if (keys(updates).length > 0) {
      await configCollection.updateOne({key: ConfigKey.SYSTEM}, {$set: updates});
      debugLog("Wired event type notification configs into group settings: %o", updates);
    } else {
      debugLog("Event type notification configs already set or no matching email types found");
    }
  } else {
    debugLog("No system config found - skipping event type notification configs");
  }
}

export async function down(db: Db, _client: MongoClient) {
  await db.collection(CONFIG_COLLECTION).updateOne({key: ConfigKey.SYSTEM}, {$unset: {[`value.group.${SOCIAL_FIELD}`]: 1, [`value.group.${WALK_FIELD}`]: 1}});
  debugLog("Removed event type notification configs from group settings");
}
