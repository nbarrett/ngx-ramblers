import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { CONFIG_COLLECTION, NOTIFICATION_CONFIG_COLLECTION } from "../shared/collection-names";
import { ConfigKey } from "../../../../../projects/ngx-ramblers/src/app/models/config.model";
import { PHOTO_UPLOAD_NOTIFICATION_SUBJECT_TEXT } from "../../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { pickCommitteeRole } from "../shared/notification-config-site-defaults";

const debugLog = createMigrationLogger("walk-photos-added-notification");
const TEMPLATE_NAME = "fully-automated-text-body";

export async function up(db: Db, _client: MongoClient) {
  const notificationConfigs = db.collection(NOTIFICATION_CONFIG_COLLECTION);
  const configCollection = db.collection(CONFIG_COLLECTION);
  const committeeConfig = await configCollection.findOne({key: ConfigKey.COMMITTEE});
  const committeeRoles: {type?: string; description?: string; vacant?: boolean}[] = committeeConfig?.value?.roles || [];
  const walksRole = pickCommitteeRole(committeeRoles, "walks");
  const reference = await notificationConfigs.findOne({});
  const bannerReference = await notificationConfigs.findOne({bannerId: {$exists: true, $ne: null}});
  const bannerId = bannerReference?.bannerId || reference?.bannerId || null;
  const existing = await notificationConfigs.findOne({"subject.text": PHOTO_UPLOAD_NOTIFICATION_SUBJECT_TEXT});
  const configId = existing
    ? existing._id
    : (await notificationConfigs.insertOne({
      subject: {
        prefixParameter: "systemMergeFields.APP_SHORTNAME",
        text: PHOTO_UPLOAD_NOTIFICATION_SUBJECT_TEXT,
        suffixParameter: ""
      },
      preSendActions: [],
      postSendActions: [],
      defaultMemberSelection: reference?.defaultMemberSelection || "recently-added",
      senderRole: walksRole,
      replyToRole: walksRole,
      signOffRoles: walksRole ? [walksRole] : [],
      bccRoles: [],
      templateName: TEMPLATE_NAME,
      bannerId
    })).insertedId;
  debugLog(existing ? "Walk photos added notification config already exists: %s" : "Created walk photos added notification config: %s", configId);
  const brevoConfig = await configCollection.findOne({key: ConfigKey.BREVO});
  if (brevoConfig && !brevoConfig.value?.photoUploadNotificationConfigId) {
    await configCollection.updateOne({key: ConfigKey.BREVO}, {$set: {"value.photoUploadNotificationConfigId": configId.toString()}});
    debugLog("Wired photoUploadNotificationConfigId %s into brevo config", configId);
  } else {
    debugLog("photoUploadNotificationConfigId already wired or no brevo config present");
  }
}

export async function down(db: Db, _client: MongoClient) {
  await db.collection(CONFIG_COLLECTION).updateOne({key: ConfigKey.BREVO}, {$unset: {"value.photoUploadNotificationConfigId": 1}});
  debugLog("Removed photoUploadNotificationConfigId from brevo config");
}
