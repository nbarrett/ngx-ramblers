import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { CONFIG_COLLECTION, NOTIFICATION_CONFIG_COLLECTION } from "../shared/collection-names";
import { ConfigKey } from "../../../../../projects/ngx-ramblers/src/app/models/config.model";
import {
  EMAIL_COMPOSER_BODY_PLACEHOLDER,
  EmailTemplateName,
  MEETING_MINUTES_NOTIFICATION_SUBJECT_TEXT
} from "../../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { mostCommonBannerId, pickCommitteeRole } from "../shared/notification-config-site-defaults";

const debugLog = createMigrationLogger("meeting-minutes-ready-notification");

export async function up(db: Db, _client: MongoClient) {
  const notificationConfigs = db.collection(NOTIFICATION_CONFIG_COLLECTION);
  const configCollection = db.collection(CONFIG_COLLECTION);
  const committeeConfig = await configCollection.findOne({key: ConfigKey.COMMITTEE});
  const committeeRoles: {type?: string; description?: string; vacant?: boolean}[] = committeeConfig?.value?.roles || [];
  const secretaryRole = pickCommitteeRole(committeeRoles, "secretary");
  const others = await notificationConfigs.find({"subject.text": {$ne: MEETING_MINUTES_NOTIFICATION_SUBJECT_TEXT}}).toArray();
  const bannerId = mostCommonBannerId(others);
  const reference = others[0];
  const existing = await notificationConfigs.findOne({"subject.text": MEETING_MINUTES_NOTIFICATION_SUBJECT_TEXT});
  const seed = {
    subject: {
      prefixParameter: "systemMergeFields.APP_SHORTNAME",
      text: MEETING_MINUTES_NOTIFICATION_SUBJECT_TEXT,
      suffixParameter: ""
    },
    preSendActions: [],
    postSendActions: [],
    defaultMemberSelection: reference?.defaultMemberSelection || "recently-added",
    senderRole: secretaryRole,
    replyToRole: secretaryRole,
    signOffRoles: secretaryRole ? [secretaryRole] : [],
    bccRoles: [],
    templateName: EmailTemplateName.FULLY_AUTOMATED_TEXT_BODY,
    bannerId,
    body: EMAIL_COMPOSER_BODY_PLACEHOLDER,
    omitComposeStep: true,
    omitEventsStep: true
  };
  if (existing) {
    await notificationConfigs.updateOne({_id: existing._id}, {$set: {bannerId}});
    debugLog("Meeting minutes ready notification config %s already exists; banner set to most-used %s", existing._id, bannerId);
  } else {
    const inserted = await notificationConfigs.insertOne(seed);
    debugLog("Created meeting minutes ready notification config: %s (not mapped; Built-in Processes stays None until chosen)", inserted.insertedId);
  }
}

export async function down(db: Db, _client: MongoClient) {
  await db.collection(NOTIFICATION_CONFIG_COLLECTION).deleteOne({"subject.text": MEETING_MINUTES_NOTIFICATION_SUBJECT_TEXT});
  debugLog("Removed meeting minutes ready notification config");
}
