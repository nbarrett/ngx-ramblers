import { ComposerExternalRecipient } from "../models/email-composer.model";
import { CommitteeMember } from "../models/committee.model";
import { Member } from "../models/member.model";
import { committeeAssignedEmailsForMemberId, memberHoldsCommitteeRole } from "./committee-members";
import { GUEST_MEETING_EMAIL_PARAM, GUEST_MEETING_NAME_PARAM } from "./video-meeting-join";
import { escapeHtml, normaliseEmail } from "./strings";

const INVITEE_NAME_MERGE_FIELD = "{{params.memberMergeFields.FULL_NAME}}";
const INVITEE_EMAIL_MERGE_FIELD = "{{params.memberMergeFields.EMAIL}}";

export function meetingInviteRecipientMember(
  recipient: ComposerExternalRecipient,
  members: Member[],
  roles: CommitteeMember[]
): Member | null {
  const byId = recipient.memberId
    ? (members ?? []).find(member => member.id === recipient.memberId)
    : undefined;
  if (byId) {
    return byId;
  } else {
    const wanted = normaliseEmail(recipient.email);
    return wanted
      ? ((members ?? []).find(member => normaliseEmail(member.email) === wanted)
        || (members ?? []).find(member =>
          committeeAssignedEmailsForMemberId(roles, member.id ?? null)
            .some(entry => normaliseEmail(entry.email) === wanted))
        || null)
      : null;
  }
}

export function meetingInviteCommitteeRoleSendOffered(
  recipients: ComposerExternalRecipient[],
  members: Member[],
  roles: CommitteeMember[]
): boolean {
  const chosen = (recipients ?? []).filter(item => !!(item.email || "").trim());
  if (chosen.length === 0) {
    return false;
  } else {
    return chosen.every(recipient => {
      const member = meetingInviteRecipientMember(recipient, members, roles);
      return !!member && memberHoldsCommitteeRole(member, roles);
    });
  }
}

export function personalisedGuestJoinUrl(joinUrl: string): string {
  const base = (joinUrl || "").trim();
  if (!base) {
    return "";
  } else {
    const separator = base.includes("?") ? "&" : "?";
    return `${base}${separator}${GUEST_MEETING_NAME_PARAM}=${INVITEE_NAME_MERGE_FIELD}&${GUEST_MEETING_EMAIL_PARAM}=${INVITEE_EMAIL_MERGE_FIELD}`;
  }
}

export function personaliseJoinLinkHtml(html: string, joinUrl: string): string {
  const base = (joinUrl || "").trim();
  if (!base || !html) {
    return html || "";
  } else {
    const personalised = escapeHtml(personalisedGuestJoinUrl(base));
    return html.split(`href="${base}"`).join(`href="${personalised}"`);
  }
}

export function meetingInviteBodyMarkdown(input: {
  dateLabel: string;
  timeLabel: string;
  joinUrl: string;
  location: string;
  note: string;
  guestInstructions: string;
  signoff: string;
}): string {
  const note = (input.note || "").trim();
  const whereLines = [
    input.joinUrl ? `**Join:** [${input.joinUrl}](${input.joinUrl})` : "",
    input.location ? `**Where:** ${input.location}` : ""
  ].filter(Boolean).join("\n\n");
  const guidance = input.joinUrl
    ? `Open the link above to join the meeting. ${input.guestInstructions}`
    : "We look forward to seeing you there.";
  const signoff = (input.signoff || "").trim();
  return [
    "You are invited to a committee meeting.",
    note,
    `**When:** ${input.dateLabel} at ${input.timeLabel}`,
    whereLines,
    guidance,
    signoff
  ].filter(Boolean).join("\n\n");
}
