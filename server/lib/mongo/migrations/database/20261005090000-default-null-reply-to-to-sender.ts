import {Db, MongoClient, ObjectId} from "mongodb";
import {keys} from "es-toolkit/compat";
import {ConfigKey} from "../../../../../projects/ngx-ramblers/src/app/models/config.model";
import {CommitteeConfig} from "../../../../../projects/ngx-ramblers/src/app/models/committee.model";
import {BUILT_IN_PROCESS_NOTIFICATION_MAPPINGS, MailConfig} from "../../../../../projects/ngx-ramblers/src/app/models/mail.model";
import createMigrationLogger from "../migrations-logger";
import {CONFIG_COLLECTION, NOTIFICATION_CONFIG_COLLECTION} from "../shared/collection-names";

const debugLog = createMigrationLogger("default-null-reply-to-to-sender");

export async function up(db: Db, _client: MongoClient): Promise<void> {
  const configCollection = db.collection(CONFIG_COLLECTION);
  const mailDocument = await configCollection.findOne({key: ConfigKey.BREVO});
  const committeeDocument = await configCollection.findOne({key: ConfigKey.COMMITTEE});
  const mailConfig = mailDocument?.value as MailConfig;
  const committeeConfig = committeeDocument?.value as CommitteeConfig;
  const senderRoles = (committeeConfig?.roles ?? []).filter(role => !!role.type?.trim() && !!role.email?.trim()).map(role => role.type);
  const mappedIds = [
    ...keys(BUILT_IN_PROCESS_NOTIFICATION_MAPPINGS).map(key => mailConfig?.[key]),
    mailConfig?.backupNotificationConfigId,
    mailConfig?.memberBulkLoadDigestConfigId
  ].filter(id => !!id && ObjectId.isValid(id)).map(id => new ObjectId(id));
  const invalidBuiltInCount = await db.collection(NOTIFICATION_CONFIG_COLLECTION).countDocuments({
    _id: {$in: mappedIds}, senderRole: {$nin: senderRoles}
  });
  if (invalidBuiltInCount > 0) {
    debugLog("%s built-in email configuration(s) need a valid saved Sender role; no replacement sender has been guessed", invalidBuiltInCount);
  }
  const result = await db.collection(NOTIFICATION_CONFIG_COLLECTION).updateMany(
    {$or: [{replyToRole: null}, {replyToRole: /^\s*$/}, {$expr: {$eq: ["$replyToRole", "$senderRole"]}}], senderRole: {$in: senderRoles}},
    {$set: {replyToRole: ""}}
  );
  debugLog("Normalised %s email configuration(s) to Same as sender with no separate Reply-To; different Reply-To roles and composer preferences are unchanged", result.modifiedCount);
}

export async function down(_db: Db, _client: MongoClient): Promise<void> {
  debugLog("Same as sender settings are retained; previous null, missing or matching role values cannot be inferred");
}
