import { Member } from "../models/member.model";

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

export function committeeChipQualifier(member: Member | null | undefined, nowMillis: number, includeExpired = false): string {
  if (!member) {
    return "committee";
  } else {
    return `committee · ${memberChipQualifier(member, nowMillis, includeExpired)}`;
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
