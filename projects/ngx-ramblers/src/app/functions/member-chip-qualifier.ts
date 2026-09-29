import { Member } from "../models/member.model";
import { MemberSelection } from "../models/mail.model";

export function memberChipQualifier(member: Member, nowMillis: number, includeExpired = false): string {
  if (!(member.email || "").trim()) {
    return "no email address";
  } else if (member.emailMarketingConsent === false) {
    return "without Head Office consent";
  } else if (includeExpired && member.membershipExpiryDate && member.membershipExpiryDate < nowMillis) {
    return "expired members";
  } else {
    return "with Head Office consent";
  }
}

export function memberAudienceQualifier(
  member: Member,
  preFilterKey: MemberSelection | null,
  nowMillis: number,
  displayDate: (millis: number) => string,
  bulkLoadDate: number | null
): string | null {
  if (preFilterKey === MemberSelection.RECENTLY_ADDED) {
    return member.createdDate ? `created ${displayDate(member.createdDate)}` : null;
  } else if (preFilterKey === MemberSelection.EXPIRED_MEMBERS) {
    if (!member.membershipExpiryDate) {
      return null;
    } else if (member.membershipExpiryDate < nowMillis) {
      return `expired ${displayDate(member.membershipExpiryDate)}`;
    } else {
      return `expires ${displayDate(member.membershipExpiryDate)}`;
    }
  } else if (preFilterKey === MemberSelection.MISSING_FROM_BULK_LOAD_MEMBERS) {
    return bulkLoadDate ? `last bulk load ${displayDate(bulkLoadDate)}` : null;
  } else if (preFilterKey === MemberSelection.ADDED_IN_LAST_BULK_LOAD_MEMBERS) {
    return bulkLoadDate ? `added in bulk load ${displayDate(bulkLoadDate)}` : null;
  } else {
    return null;
  }
}

export function combinedMemberChipQualifier(
  member: Member,
  nowMillis: number,
  displayDate: (millis: number) => string,
  preFilterKey: MemberSelection | null = null,
  bulkLoadDate: number | null = null
): string {
  const includeExpired = preFilterKey === MemberSelection.EXPIRED_MEMBERS;
  const status = memberChipQualifier(member, nowMillis, includeExpired);
  const audience = memberAudienceQualifier(member, preFilterKey, nowMillis, displayDate, bulkLoadDate);
  if (!audience) {
    return status;
  } else if (status === "expired members") {
    return audience;
  } else {
    return `${status}, ${audience}`;
  }
}

export function committeeChipQualifier(member: Member | null | undefined, nowMillis: number, includeExpired = false): string {
  if (!member) {
    return "committee";
  } else {
    return `committee · ${memberChipQualifier(member, nowMillis, includeExpired)}`;
  }
}

export function committeeAudienceChipQualifier(
  member: Member | null | undefined,
  nowMillis: number,
  displayDate: (millis: number) => string,
  preFilterKey: MemberSelection | null = null,
  bulkLoadDate: number | null = null
): string {
  if (!member) {
    return "committee";
  } else {
    return `committee · ${combinedMemberChipQualifier(member, nowMillis, displayDate, preFilterKey, bulkLoadDate)}`;
  }
}

export function recipientChipQualifier(
  email: string,
  members: Member[],
  nowMillis: number,
  committeeEmails: string[] = []
): string {
  const normalised = (email || "").trim().toLowerCase();
  const match = (members || []).find(member => (member.email || "").trim().toLowerCase() === normalised);
  if (committeeEmails.some(item => item.toLowerCase() === normalised)) {
    return committeeChipQualifier(match, nowMillis);
  } else if (match) {
    return memberChipQualifier(match, nowMillis);
  } else {
    return "external";
  }
}
