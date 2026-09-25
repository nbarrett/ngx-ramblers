import { Member } from "../models/member.model";

export function memberChipQualifier(member: Member, nowMillis: number): string {
  if (!(member.email || "").trim()) {
    return "no email address";
  } else if (member.emailMarketingConsent === false) {
    return "without Head Office consent";
  } else if (member.membershipExpiryDate && member.membershipExpiryDate < nowMillis) {
    return "expired members";
  } else {
    return "with Head Office consent";
  }
}

export function recipientChipQualifier(email: string, members: Member[], nowMillis: number): string {
  const match = (members || []).find(member => (member.email || "").trim().toLowerCase() === (email || "").trim().toLowerCase());
  if (match) {
    return memberChipQualifier(match, nowMillis);
  } else {
    return "external";
  }
}
