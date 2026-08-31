import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { CONFIG_COLLECTION, NOTIFICATION_CONFIG_COLLECTION } from "../shared/collection-names";
import {
  NOTIFICATION_CONFIG_DEFAULTS,
  PHOTOGRAPHS_AND_VIDEO_SUBJECT_TEXT
} from "../../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { ConfigKey } from "../../../../../projects/ngx-ramblers/src/app/models/config.model";
import { mostCommonBannerId, pickCommitteeRole } from "../shared/notification-config-site-defaults";

const debugLog = createMigrationLogger("add-photographs-and-video-email-config");

export async function up(db: Db, _client: MongoClient) {
  const collection = db.collection(NOTIFICATION_CONFIG_COLLECTION);
  const template = NOTIFICATION_CONFIG_DEFAULTS.find(item => item.subject.text === PHOTOGRAPHS_AND_VIDEO_SUBJECT_TEXT);
  if (!template) {
    debugLog("No default Photographs and video email configuration found");
    return;
  }
  const others = await collection.find({"subject.text": {$ne: PHOTOGRAPHS_AND_VIDEO_SUBJECT_TEXT}}).toArray();
  const bannerId = mostCommonBannerId(others) || template.bannerId || null;
  const committee = await db.collection(CONFIG_COLLECTION).findOne({key: ConfigKey.COMMITTEE});
  const role = pickCommitteeRole(committee?.value?.roles || [], "membership");
  const fields = {
    ...template,
    bannerId,
    senderRole: role,
    replyToRole: role,
    signOffRoles: role ? [role] : [],
    omitComposeStep: true,
    omitEventsStep: true
  };
  const existing = await collection.findOne({"subject.text": PHOTOGRAPHS_AND_VIDEO_SUBJECT_TEXT});
  if (existing) {
    await collection.updateOne({_id: existing._id}, {$set: fields});
    debugLog("Updated Photographs and video email configuration with site banner %s and role %s", bannerId, role);
  } else {
    await collection.insertOne(fields);
    debugLog("Added Photographs and video email configuration with site banner %s and role %s", bannerId, role);
  }
}

export async function down(_db: Db, _client: MongoClient) {
  debugLog("No down migration - Photographs and video email configuration is intentionally left in place");
}
