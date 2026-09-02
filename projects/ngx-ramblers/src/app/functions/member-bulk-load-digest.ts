import { startCase, isString } from "es-toolkit/compat";
import {
  Member,
  MemberAction,
  MemberAuditFieldChange,
  MemberBulkLoadAudit,
  MemberBulkLoadDigest,
  MemberBulkLoadDigestMember,
  NO_CHANGES_OR_DIFFERENCES,
  MemberUpdateAudit
} from "../models/member.model";
import { memberForUpdateAudit, memberUpdateAuditRows } from "./member-bulk-load-rows";
import { memberFullName } from "./member-names";

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
    changeSummary: summariseFieldChanges(audit.fieldChanges || []),
    errorText: memberBulkLoadDigestErrorText(audit)
  };
}

export function memberBulkLoadDigest(
  session: MemberBulkLoadAudit,
  audits: MemberUpdateAudit[],
  members: Member[],
  uploadedByName: string
): MemberBulkLoadDigest {
  const rows = memberUpdateAuditRows(audits, members);
  return {
    sessionId: session?.id || "",
    uploadedOn: session?.createdDate || 0,
    uploadedByName,
    dataFileName: session?.files?.data || "",
    created: rows.filter(row => row.memberAction === MemberAction.created).map(row => digestMember(row, members)),
    updated: rows.filter(row => row.memberAction === MemberAction.updated).map(row => digestMember(row, members)),
    errors: rows.filter(row => row.memberAction === MemberAction.error).map(row => digestMember(row, members)),
    skippedCount: rows.filter(row => row.memberAction === MemberAction.skipped).length,
    totalAudits: rows.length
  };
}

export function memberBulkLoadDigestCountsLabel(digest: MemberBulkLoadDigest): string {
  return [
    `${digest.created.length} created`,
    `${digest.updated.length} updated`,
    `${digest.skippedCount} skipped`,
    `${digest.errors.length} failed`
  ].join(", ");
}

function escapeHtml(value: string): string {
  return (value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function memberListHtml(title: string, members: MemberBulkLoadDigestMember[], includeSummary: boolean): string {
  if (members.length === 0) {
    return "";
  } else {
    const rows = members.map(member => {
      const name = escapeHtml(member.name);
      const number = member.membershipNumber ? ` (${escapeHtml(member.membershipNumber)})` : "";
      const extra = includeSummary && member.changeSummary
        ? `: ${escapeHtml(member.changeSummary)}`
        : member.errorText
          ? `: ${escapeHtml(member.errorText)}`
          : "";
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
    ${memberListHtml("New members", digest.created, false)}
    ${memberListHtml("Updated members", digest.updated, true)}
    ${memberListHtml("Failed to save", digest.errors, false)}
    <p style="margin:18px 0;">
      <a href="${escapeHtml(historyUrl)}" style="display:inline-block;padding:10px 18px;background-color:#ec6a09;color:#ffffff;text-decoration:none;border-radius:4px;">Open upload history</a>
    </p>`;
}
