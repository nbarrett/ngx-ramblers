import { Db } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { createOrUpdateKey, queryKey } from "../../controllers/config";
import { ConfigKey } from "../../../../../projects/ngx-ramblers/src/app/models/config.model";
import { DEFAULT_MEMBER_SYNC_POLICY } from "../../../../../projects/ngx-ramblers/src/app/models/member-sync-policy.model";
import { MemberAuditFieldChange } from "../../../../../projects/ngx-ramblers/src/app/models/member.model";
import { ensureActionButton } from "../shared/page-content-actions";
import { keys } from "es-toolkit/compat";

const debugLog = createMigrationLogger("seed-member-sync-policy");

const BREVO_CONFIG_KEY = "brevo";
const COMMITTEE_CONFIG_KEY = "committee";
const NOTIFICATION_CONFIG_COLLECTION = "notificationConfigs";
const CONFIG_COLLECTION = "config";
const MEMBER_UPDATE_AUDIT_COLLECTION = "memberUpdateAudit";
const MEMBER_SYNC_TEMPLATE_NAME = "member-sync-notification";
const NOTIFICATION_SUBJECT_TEXT = "Your membership details and Head Office records";
const ADMIN_ACTION_BUTTONS_PATH = "admin#action-buttons";

export async function up(db: Db) {
  await seedPolicy();
  await seedNotificationConfig(db);
  await ensureMenuItem(db);
  await backfillAuditFieldChanges(db);
}

async function seedPolicy() {
  const existing = await queryKey(ConfigKey.MEMBER_SYNC_POLICY);
  if (existing?.value) {
    debugLog("MEMBER_SYNC_POLICY already present — leaving as-is");
    return;
  }
  await createOrUpdateKey(ConfigKey.MEMBER_SYNC_POLICY, DEFAULT_MEMBER_SYNC_POLICY);
  debugLog("Seeded MEMBER_SYNC_POLICY with default %o", DEFAULT_MEMBER_SYNC_POLICY);
}

function roleMentionsMembership(role: any): boolean {
  return (role.type || "").toLowerCase().includes("membership") || (role.description || "").toLowerCase().includes("membership");
}

function resolveMembershipRole(committeeRoles: any[]): string | null {
  const roles = committeeRoles || [];
  if (roles.some(role => role.type === "membership")) {
    return "membership";
  }
  const membershipLike = roles.find(role => !role.vacant && roleMentionsMembership(role)) || roles.find(roleMentionsMembership);
  if (membershipLike?.type) {
    return membershipLike.type;
  }
  const fallback = ["secretary", "chairman"].map(type => roles.find(role => role.type === type)).find(Boolean);
  if (fallback?.type) {
    return fallback.type;
  }
  const firstReal = roles.find(role => !role.vacant && role.roleType !== "SYSTEM_ROLE");
  return firstReal?.type || null;
}

const NOTIFICATION_SUBJECT = {
  prefixParameter: "systemMergeFields.APP_SHORTNAME",
  text: NOTIFICATION_SUBJECT_TEXT,
  suffixParameter: "memberMergeFields.FULL_NAME"
};

async function createNotificationConfig(notificationConfigs: any, reference: any, membershipRole: string | null, bannerId: any) {
  const inserted = await notificationConfigs.insertOne({
    subject: NOTIFICATION_SUBJECT,
    preSendActions: [],
    postSendActions: [],
    defaultMemberSelection: reference?.defaultMemberSelection || "recently-added",
    senderRole: membershipRole,
    replyToRole: membershipRole,
    signOffRoles: membershipRole ? [membershipRole] : [],
    templateName: MEMBER_SYNC_TEMPLATE_NAME,
    bannerId
  });
  debugLog("Created Member sync notification config: %s", inserted.insertedId);
  return inserted.insertedId;
}

async function repairNotificationConfig(notificationConfigs: any, existing: any, validRoleTypes: Set<string>, membershipRole: string | null, bannerId: any) {
  const update: any = {};
  if (!validRoleTypes.has(existing.senderRole)) {
    update.senderRole = membershipRole;
  }
  if (!validRoleTypes.has(existing.replyToRole)) {
    update.replyToRole = membershipRole;
  }
  const signOff: string[] = existing.signOffRoles || [];
  const signOffValid = signOff.length > 0 && signOff.every(role => validRoleTypes.has(role));
  if (!signOffValid) {
    const fixed = Array.from(new Set(signOff.map(role => validRoleTypes.has(role) ? role : membershipRole).filter(Boolean)));
    update.signOffRoles = fixed.length ? fixed : (membershipRole ? [membershipRole] : []);
  }
  if (existing.templateName !== MEMBER_SYNC_TEMPLATE_NAME) {
    update.templateName = MEMBER_SYNC_TEMPLATE_NAME;
  }
  if (!existing.bannerId && bannerId) {
    update.bannerId = bannerId;
  }
  if (keys(update).length > 0) {
    await notificationConfigs.updateOne({_id: existing._id}, {$set: update});
    debugLog("Repaired Member sync notification config %s to match this environment: %o", existing._id, update);
  } else {
    debugLog("Member sync notification config already valid for this environment: %s", existing._id);
  }
  return existing._id;
}

async function seedNotificationConfig(db: Db) {
  const notificationConfigs = db.collection(NOTIFICATION_CONFIG_COLLECTION);
  const configCollection = db.collection(CONFIG_COLLECTION);

  const committeeConfig = await configCollection.findOne({key: COMMITTEE_CONFIG_KEY});
  const committeeRoles: any[] = committeeConfig?.value?.roles || [];
  const validRoleTypes = new Set<string>(committeeRoles.map(role => role.type).filter(Boolean));
  const membershipRole = resolveMembershipRole(committeeRoles);

  const reference = await notificationConfigs.findOne({});
  const bannerReference = await notificationConfigs.findOne({bannerId: {$exists: true, $ne: null}});
  const bannerId = bannerReference?.bannerId || reference?.bannerId || null;

  const existing = await notificationConfigs.findOne({"subject.text": NOTIFICATION_SUBJECT_TEXT});
  const configId = existing
    ? await repairNotificationConfig(notificationConfigs, existing, validRoleTypes, membershipRole, bannerId)
    : await createNotificationConfig(notificationConfigs, reference, membershipRole, bannerId);

  const brevoConfig = await configCollection.findOne({key: BREVO_CONFIG_KEY});
  if (brevoConfig && !brevoConfig.value?.memberSyncNotificationConfigId) {
    await configCollection.updateOne(
      {key: BREVO_CONFIG_KEY},
      {$set: {"value.memberSyncNotificationConfigId": configId.toString()}}
    );
    debugLog("Wired memberSyncNotificationConfigId %s into brevo config", configId);
  }
}

async function ensureMenuItem(db: Db) {
  const added = await ensureActionButton(db, ADMIN_ACTION_BUTTONS_PATH, {
    accessLevel: "committee",
    title: "Member Sync Notifications",
    icon: "faBell",
    href: "admin/member-sync-notifications",
    contentText: "Review and send notifications when a member's record differs from Head Office records"
  }, debugLog);
  debugLog(added ? "Added Member Sync Notifications menu item" : "Member Sync Notifications menu item already present");
}

function parseAuditSegment(segment: string): MemberAuditFieldChange | null {
  const separatorIndex = segment.indexOf(": ");
  if (separatorIndex < 0) {
    return null;
  }
  const fieldName = segment.slice(0, separatorIndex);
  const rest = segment.slice(separatorIndex + 2);
  if (rest.startsWith("kept as ")) {
    const value = rest.slice("kept as ".length).replace(/ \(skipped, admin policy\)$/, "");
    return {fieldName, from: value, to: value, resolution: "Kept (admin policy)"};
  }
  const appliedMatch = rest.match(/^(.*) applied as (.*?)(?: \(([^)]*)\))?$/);
  if (appliedMatch) {
    return {fieldName, from: appliedMatch[1], to: appliedMatch[2], resolution: appliedMatch[3] || "Applied"};
  }
  const updatedMatch = rest.match(/^(.*) updated to (.*)$/);
  if (updatedMatch) {
    return {fieldName, from: updatedMatch[1], to: updatedMatch[2], resolution: "Updated"};
  }
  const notOverwrittenMatch = rest.match(/^(.*) not overwritten with (.*)$/);
  if (notOverwrittenMatch) {
    return {fieldName, from: notOverwrittenMatch[1], to: notOverwrittenMatch[2], resolution: "Not overwritten"};
  }
  return {fieldName, from: "", to: rest, resolution: ""};
}

function parseAuditMessage(auditMessage: string): MemberAuditFieldChange[] {
  if (!auditMessage) {
    return [];
  }
  return auditMessage
    .split(/, (?=[a-zA-Z][a-zA-Z0-9]*: )/)
    .map(parseAuditSegment)
    .filter((change): change is MemberAuditFieldChange => !!change);
}

async function backfillAuditFieldChanges(db: Db) {
  const collection = db.collection(MEMBER_UPDATE_AUDIT_COLLECTION);
  const legacyAudits = await collection
    .find({auditMessage: {$exists: true, $ne: null}, fieldChanges: {$exists: false}})
    .project({auditMessage: 1})
    .toArray();
  if (legacyAudits.length === 0) {
    debugLog("No historic member update audits to rebuild");
    return;
  }
  const operations = legacyAudits.map(audit => ({
    updateOne: {
      filter: {_id: audit._id},
      update: {$set: {fieldChanges: parseAuditMessage(audit.auditMessage)}, $unset: {auditMessage: ""}}
    }
  }));
  const result = await collection.bulkWrite(operations, {ordered: false});
  debugLog("Rebuilt fieldChanges on %d historic member update audits from the legacy auditMessage string", result.modifiedCount);
}

export async function down(_db: Db) {
  debugLog("down: no-op for member sync policy, notification config, menu item seed and audit backfill");
}
