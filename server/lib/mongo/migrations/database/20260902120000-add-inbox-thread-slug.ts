import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { InboxThread } from "../../../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { inboxThreadSlug } from "../../../../../projects/ngx-ramblers/src/app/functions/inbox-thread";
import { RISK_ASSESSMENT_CONTENT_ENTRIES } from "../../../../../projects/ngx-ramblers/src/app/pages/admin/default-content";
import { CONFIG_COLLECTION, NOTIFICATION_CONFIG_COLLECTION } from "../shared/collection-names";
import { ConfigKey } from "../../../../../projects/ngx-ramblers/src/app/models/config.model";
import { MEMBER_BULK_LOAD_DIGEST_SUBJECT_TEXT } from "../../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { pickCommitteeRole } from "../shared/notification-config-site-defaults";

const debugLog = createMigrationLogger("add-inbox-thread-slug");
const TEMPLATE_NAME = "member-sync-notification";
const CONTENT_TEXT_COLLECTION = "contentText";

export async function up(db: Db, _client: MongoClient) {
  await backfillInboxThreadSlugs(db);
  await seedRiskAssessmentContent(db);
  await ensureMemberBulkLoadDigest(db);
}

export async function down(db: Db, _client: MongoClient) {
  await removeRiskAssessmentContent(db);
  await unwireMemberBulkLoadDigest(db);
  debugLog("Inbox thread slug backfill left in place");
}

async function backfillInboxThreadSlugs(db: Db) {
  const threads = db.collection("inboxThreads");
  const missing = await threads.find({$or: [{slug: {$exists: false}}, {slug: ""}]}).toArray();
  const progress = {updated: 0};
  await missing.reduce(async (previous, thread) => {
    await previous;
    const slug = inboxThreadSlug({
      normalisedSubject: thread.normalisedSubject,
      subject: thread.subject
    } as InboxThread);
    if (slug) {
      await threads.updateOne({_id: thread._id}, {$set: {slug}});
      progress.updated += 1;
    }
  }, Promise.resolve());
  await threads.createIndex({tenantSlug: 1, slug: 1, lastSeenAt: -1});
  debugLog(`backfilled slug on ${progress.updated} inbox thread(s)`);
}

async function seedRiskAssessmentContent(db: Db) {
  const collection = db.collection(CONTENT_TEXT_COLLECTION);
  await RISK_ASSESSMENT_CONTENT_ENTRIES.reduce(async (previous, entry) => {
    await previous;
    const existing = await collection.findOne({name: entry.name, category: entry.category});
    if (existing) {
      debugLog(`Content text "${entry.name}" already exists, skipping`);
    } else {
      await collection.insertOne({name: entry.name, category: entry.category, text: entry.text});
      debugLog(`Added content text: ${entry.name}`);
    }
  }, Promise.resolve());
}

async function removeRiskAssessmentContent(db: Db) {
  const collection = db.collection(CONTENT_TEXT_COLLECTION);
  await RISK_ASSESSMENT_CONTENT_ENTRIES.reduce(async (previous, entry) => {
    await previous;
    await collection.deleteOne({name: entry.name, category: entry.category});
    debugLog(`Removed content text: ${entry.name}`);
  }, Promise.resolve());
}

async function ensureMemberBulkLoadDigest(db: Db) {
  const notificationConfigs = db.collection(NOTIFICATION_CONFIG_COLLECTION);
  const configCollection = db.collection(CONFIG_COLLECTION);
  const committeeConfig = await configCollection.findOne({key: ConfigKey.COMMITTEE});
  const committeeRoles: {type?: string; description?: string; vacant?: boolean}[] = committeeConfig?.value?.roles || [];
  const membershipRole = pickCommitteeRole(committeeRoles, "membership");
  const reference = await notificationConfigs.findOne({});
  const bannerReference = await notificationConfigs.findOne({bannerId: {$exists: true, $ne: null}});
  const bannerId = bannerReference?.bannerId || reference?.bannerId || null;
  const existing = await notificationConfigs.findOne({"subject.text": MEMBER_BULK_LOAD_DIGEST_SUBJECT_TEXT});
  if (!existing) {
    const inserted = await notificationConfigs.insertOne({
      subject: {
        prefixParameter: "systemMergeFields.APP_SHORTNAME",
        text: MEMBER_BULK_LOAD_DIGEST_SUBJECT_TEXT,
        suffixParameter: ""
      },
      preSendActions: [],
      postSendActions: [],
      defaultMemberSelection: reference?.defaultMemberSelection || "recently-added",
      senderRole: membershipRole,
      replyToRole: membershipRole,
      signOffRoles: membershipRole ? [membershipRole] : [],
      bccRoles: [],
      templateName: TEMPLATE_NAME,
      bannerId
    });
    debugLog("Created member bulk load digest notification config: %s", inserted.insertedId);
  } else {
    const update: Record<string, unknown> = {
      bccRoles: []
    };
    if (!existing.templateName) {
      update.templateName = TEMPLATE_NAME;
    }
    if (!existing.senderRole && membershipRole) {
      update.senderRole = membershipRole;
    }
    if (!existing.replyToRole && membershipRole) {
      update.replyToRole = membershipRole;
    }
    await notificationConfigs.updateOne({_id: existing._id}, {$set: update});
    debugLog("Repaired member bulk load digest notification config %s: %o", existing._id, update);
  }
  await unwireMemberBulkLoadDigest(db);
}

async function unwireMemberBulkLoadDigest(db: Db) {
  const configCollection = db.collection(CONFIG_COLLECTION);
  await configCollection.updateOne(
    {key: ConfigKey.BREVO},
    {$unset: {"value.memberBulkLoadDigestConfigId": 1}}
  );
  debugLog("Removed memberBulkLoadDigestConfigId from brevo config");
}
