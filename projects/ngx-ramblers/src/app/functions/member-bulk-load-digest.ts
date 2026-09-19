import { startCase, isString } from "es-toolkit/compat";
import {
  Member,
  MemberAction,
  MemberAuditFieldChange,
  MemberBulkLoadAudit,
  MemberBulkLoadDigest,
  MemberBulkLoadDigestEmailSends,
  MemberBulkLoadDigestMember,
  MemberBulkLoadExpiryConfigIds,
  NO_CHANGES_OR_DIFFERENCES,
  MemberUpdateAudit
} from "../models/member.model";
import { EmailTemplateName, NotificationConfig, WorkflowAction } from "../models/mail.model";
import { memberForUpdateAudit, memberUpdateAuditRows } from "./member-bulk-load-rows";
import { memberFullName } from "./member-names";
import { escapeHtml } from "./strings";

export function summariseFieldChanges(fieldChanges: MemberAuditFieldChange[]): string {
  if (!fieldChanges?.length) {
    return NO_CHANGES_OR_DIFFERENCES;
  } else {
    const fields = fieldChanges.map(change => startCase(change.fieldName));
    return `${fields.length === 1 ? "1 field" : `${fields.length} fields`}: ${fields.join(", ")}`;
  }
}

export function memberBulkLoadDigestErrorText(audit: MemberUpdateAudit): string | null {
  const errorMessage = audit?.auditErrorMessage as {error?: string; message?: string} | string | null;
  if (!errorMessage) {
    return null;
  } else if (isString(errorMessage)) {
    return errorMessage;
  } else {
    const detail = errorMessage.error || errorMessage.message;
    return isString(detail) ? detail.replace(/^ValidationError:\s*/i, "") : null;
  }
}

function digestMember(audit: MemberUpdateAudit, members: Member[]): MemberBulkLoadDigestMember {
  const member = memberForUpdateAudit(audit, members);
  return {
    name: memberFullName(member, "Unknown member"),
    membershipNumber: member?.membershipNumber || "",
    errorText: memberBulkLoadDigestErrorText(audit)
  };
}

export function memberBulkLoadDigest(
  session: MemberBulkLoadAudit,
  audits: MemberUpdateAudit[],
  members: Member[],
  uploadedByName: string,
  emailSends: MemberBulkLoadDigestEmailSends = {expiryWarnings: [], expiryNotices: []}
): MemberBulkLoadDigest {
  const rows = memberUpdateAuditRows(audits, members);
  return {
    sessionId: session?.id || "",
    uploadedOn: session?.createdDate || 0,
    uploadedByName,
    dataFileName: session?.files?.data || "",
    created: rows.filter(row => row.memberAction === MemberAction.created).map(row => digestMember(row, members)),
    updatedCount: rows.filter(row => row.memberAction === MemberAction.updated).length,
    errors: rows.filter(row => row.memberAction === MemberAction.error).map(row => digestMember(row, members)),
    skippedCount: rows.filter(row => row.memberAction === MemberAction.skipped).length,
    totalAudits: rows.length,
    expiryWarnings: emailSends.expiryWarnings,
    expiryNotices: emailSends.expiryNotices
  };
}

export function expiryNotificationConfigIds(configs: NotificationConfig[]): MemberBulkLoadExpiryConfigIds {
  const removesMember = (config: NotificationConfig) => (config.postSendActions || [])
    .some(action => action === WorkflowAction.BULK_DELETE_GROUP_MEMBER || action === WorkflowAction.DISABLE_GROUP_MEMBER);
  const expiryConfigs = configs.filter(config => removesMember(config) || config.templateName === EmailTemplateName.MEMBERSHIP_EXPIRY);
  const expiryIds = expiryConfigs.map(config => config.id);
  const linkedWarningIds = expiryConfigs.map(config => config.nextNotificationConfigId).filter(id => !!id);
  const warningIds = configs
    .filter(config => !expiryIds.includes(config.id))
    .filter(config => config.templateName === EmailTemplateName.MEMBERSHIP_EXPIRY_WARNING || linkedWarningIds.includes(config.id))
    .map(config => config.id);
  return {warningIds, expiryIds};
}

export function memberBulkLoadDigestCountsLabel(digest: MemberBulkLoadDigest): string {
  return [
    `${digest.created.length} created`,
    `${digest.updatedCount} updated`,
    `${digest.skippedCount} skipped`,
    `${digest.errors.length} failed`,
    `${digest.expiryWarnings.length} sent an expiry warning`,
    `${digest.expiryNotices.length} sent the expiry email`
  ].join(", ");
}


function memberListHtml(title: string, members: MemberBulkLoadDigestMember[]): string {
  if (members.length === 0) {
    return "";
  } else {
    const rows = members.map(member => {
      const name = escapeHtml(member.name);
      const number = member.membershipNumber ? ` (${escapeHtml(member.membershipNumber)})` : "";
      const extra = member.errorText ? `: ${escapeHtml(member.errorText)}` : "";
      return `<li>${name}${number}${extra}</li>`;
    }).join("");
    return `<h3 style="margin:16px 0 8px;">${escapeHtml(title)}</h3><ul>${rows}</ul>`;
  }
}

export function memberBulkLoadDigestHtml(digest: MemberBulkLoadDigest, uploadedOnLabel: string, historyUrl: string): string {
  const fileLine = digest.dataFileName ? ` from ${escapeHtml(digest.dataFileName)}` : "";
  const byLine = digest.uploadedByName ? ` by ${escapeHtml(digest.uploadedByName)}` : "";
  return `
    <p>Here is a summary of the member bulk load on ${escapeHtml(uploadedOnLabel)}${byLine}${fileLine}.</p>
    <p><strong>${escapeHtml(memberBulkLoadDigestCountsLabel(digest))}</strong> (${digest.totalAudits} member actions in total).</p>
    ${memberListHtml("New members", digest.created)}
    ${memberListHtml("Sent an expiry warning", digest.expiryWarnings)}
    ${memberListHtml("Sent the expiry email and removed from the site", digest.expiryNotices)}
    ${memberListHtml("Failed to save", digest.errors)}
    <p style="margin:18px 0;">
      <a href="${escapeHtml(historyUrl)}" style="display:inline-block;padding:10px 18px;background-color:#ec6a09;color:#ffffff;text-decoration:none;border-radius:4px;">Open upload history</a>
    </p>`;
}
