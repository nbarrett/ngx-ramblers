import { Member } from "./member.model";

export enum WalkLeaderMatchConfidence {
  HIGH = "high",
  MEDIUM = "medium",
  LOW = "low"
}

export enum WalkLeaderMatchType {
  MEMBER_ID = "member-id",
  CONTACT_ID = "contact-id",
  EMAIL = "email",
  PHONE_AND_NAME = "phone-and-name",
  PHONE_ONLY = "phone-only",
  NAME_ONLY = "name-only",
  NAME_INITIAL_PATTERN = "name-initial-pattern",
  NONE = "none",
  PRIOR_CONFLICT = "prior-conflict",
  PRIOR_MISSING_MEMBER = "prior-missing-member",
  PRIOR_CURRENT_CONFLICT = "prior-current-conflict",
  PRIOR_STRONG = "prior-strong",
  PRIOR_SINGLE = "prior-single"
}

export interface LeaderMemberMatchResult {
  member: Member | null;
  confidence: WalkLeaderMatchConfidence;
  matchType: WalkLeaderMatchType;
}

export interface PriorContactMemberMatch {
  contactId: string;
  memberId: string;
  count: number;
}
