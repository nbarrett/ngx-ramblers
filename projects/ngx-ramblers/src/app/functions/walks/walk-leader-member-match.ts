import { isString } from "es-toolkit/compat";
import { ContactDetails, ExtendedGroupEvent } from "../../models/group-event.model";
import { Member } from "../../models/member.model";
import {
  LeaderMemberMatchResult,
  PriorContactMemberMatch,
  WalkLeaderMatchConfidence,
  WalkLeaderMatchType
} from "../../models/walk-leader-match.model";

function normaliseText(value: string): string {
  return isString(value) ? value.trim().toLowerCase() : "";
}

function normaliseName(value: string): string {
  return normaliseText(value)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalisePhone(value: string): string {
  return normaliseText(value).replace(/[^0-9]/g, "");
}

function normaliseId(value: string): string {
  return isString(value) ? value.trim().toLowerCase() : "";
}

function slugForLookup(value: string): string {
  return normaliseText(value)
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normaliseText(value));
}

function uniqueMatch(matches: Member[]): Member | null {
  return matches.length === 1 ? matches[0] : null;
}

function uniqueIntersection(left: Member[], right: Member[]): Member | null {
  const rightIds = new Set(right.map(member => member.id));
  const intersections = left.filter(member => rightIds.has(member.id));
  return uniqueMatch(intersections);
}

function nameTokens(value: string): string[] {
  const normalised = normaliseName(value);
  return normalised ? normalised.split(" ") : [];
}

function compatibleFirstName(contactFirst: string, memberFirst: string): boolean {
  if (!contactFirst || !memberFirst) {
    return false;
  }
  if (contactFirst.length < 2 || memberFirst.length < 2) {
    return false;
  }
  return memberFirst.startsWith(contactFirst) || contactFirst.startsWith(memberFirst);
}

function firstAndLastTokensFromMember(member: Member): { first: string; last: string } {
  const memberFirst = nameTokens(member?.firstName || member?.displayName || "")?.[0] || "";
  const memberLast = nameTokens(member?.lastName || member?.displayName || "")?.slice(-1)?.[0] || "";
  return { first: memberFirst, last: memberLast };
}

function firstAndLastTokensFromMemberEmail(member: Member): { first: string; last: string } {
  const memberEmail = normaliseText(member?.email);
  if (!validEmail(memberEmail)) {
    return { first: "", last: "" };
  }
  const localPart = memberEmail.split("@")[0];
  const tokens = normaliseName(localPart).split(" ").filter(token => !!token);
  const first = tokens[0] || "";
  const last = tokens.slice(-1)?.[0] || "";
  return { first, last };
}

function initialPatternNameMatches(contactName: string, member: Member): boolean {
  const contactTokens = nameTokens(contactName);
  if (contactTokens.length < 2) {
    return false;
  }
  const contactFirst = contactTokens[0];
  const contactLastInitial = contactTokens[contactTokens.length - 1]?.charAt(0) || "";
  const memberNameTokens = firstAndLastTokensFromMember(member);
  const memberEmailTokens = firstAndLastTokensFromMemberEmail(member);
  const nameMatch = compatibleFirstName(contactFirst, memberNameTokens.first) && !!contactLastInitial && memberNameTokens.last.startsWith(contactLastInitial);
  const emailMatch = compatibleFirstName(contactFirst, memberEmailTokens.first) && !!contactLastInitial && memberEmailTokens.last.startsWith(contactLastInitial);
  return nameMatch || emailMatch;
}

function firstNameAndSurnameInitial(name: string): boolean {
  const tokens = nameTokens(name);
  if (tokens.length !== 2) {
    return false;
  }
  const firstName = tokens[0] || "";
  const surnameToken = tokens[1] || "";
  return firstName.length >= 3 && surnameToken.length === 1;
}

function emailAndNameAreConsistent(contactName: string, member: Member): boolean {
  const normalisedContactName = normaliseName(contactName);
  if (!normalisedContactName) {
    return true;
  }
  const memberDisplayName = normaliseName(member?.displayName || "");
  if (memberDisplayName && memberDisplayName === normalisedContactName) {
    return true;
  }
  return initialPatternNameMatches(normalisedContactName, member);
}

function contactIdAliasMatches(inputContactId: string, memberContactId: string): boolean {
  const inputKey = normaliseText(inputContactId);
  const memberKey = normaliseText(memberContactId);
  if (!inputKey || !memberKey) {
    return false;
  }
  if (inputKey === memberKey) {
    return true;
  }
  const inputSlug = slugForLookup(inputContactId);
  const memberSlug = slugForLookup(memberContactId);
  if (!inputSlug || !memberSlug) {
    return false;
  }
  return memberSlug === inputSlug || memberSlug.endsWith(`-${inputSlug}`);
}

function currentSignalMatch(members: Member[], contactDetails: ContactDetails): LeaderMemberMatchResult {
  const memberId = normaliseId(contactDetails?.memberId);
  const contactId = normaliseText(contactDetails?.contactId);
  const normalisedEmail = normaliseText(contactDetails?.email);
  const email = validEmail(normalisedEmail) ? normalisedEmail : "";
  const phone = normalisePhone(contactDetails?.phone);
  const name = normaliseName(contactDetails?.displayName);

  const uniqueByMemberId = uniqueMatch(members.filter(member => normaliseId(member?.id) === memberId && !!memberId));
  if (uniqueByMemberId) {
    return { member: uniqueByMemberId, confidence: WalkLeaderMatchConfidence.HIGH, matchType: WalkLeaderMatchType.MEMBER_ID };
  }

  const uniqueByContactId = uniqueMatch(members.filter(member => contactIdAliasMatches(contactId, member?.contactId)));
  if (uniqueByContactId) {
    return { member: uniqueByContactId, confidence: WalkLeaderMatchConfidence.MEDIUM, matchType: WalkLeaderMatchType.CONTACT_ID };
  }

  const uniqueByEmail = uniqueMatch(members.filter(member => normaliseText(member?.email) === email && !!email));
  if (uniqueByEmail) {
    if (!emailAndNameAreConsistent(name, uniqueByEmail)) {
      return { member: uniqueByEmail, confidence: WalkLeaderMatchConfidence.LOW, matchType: WalkLeaderMatchType.EMAIL };
    }
    return { member: uniqueByEmail, confidence: WalkLeaderMatchConfidence.MEDIUM, matchType: WalkLeaderMatchType.EMAIL };
  }

  const phoneMatches = members.filter(member => normalisePhone(member?.mobileNumber) === phone && !!phone);
  const nameMatches = members.filter(member => normaliseName(member?.displayName) === name && !!name);

  if (phone && name) {
    const uniqueByPhoneAndName = uniqueIntersection(phoneMatches, nameMatches);
    if (uniqueByPhoneAndName) {
      return { member: uniqueByPhoneAndName, confidence: WalkLeaderMatchConfidence.MEDIUM, matchType: WalkLeaderMatchType.PHONE_AND_NAME };
    }
  }

  const uniqueByPhone = uniqueMatch(phoneMatches);
  if (uniqueByPhone && !name) {
    return { member: uniqueByPhone, confidence: WalkLeaderMatchConfidence.MEDIUM, matchType: WalkLeaderMatchType.PHONE_ONLY };
  }

  const uniqueByName = uniqueMatch(nameMatches);
  if (uniqueByName && !email && !phone) {
    if (firstNameAndSurnameInitial(name)) {
      return { member: uniqueByName, confidence: WalkLeaderMatchConfidence.MEDIUM, matchType: WalkLeaderMatchType.NAME_INITIAL_PATTERN };
    }
    return { member: uniqueByName, confidence: WalkLeaderMatchConfidence.LOW, matchType: WalkLeaderMatchType.NAME_ONLY };
  }

  const initialPatternMatches = members.filter(member => initialPatternNameMatches(name, member) && !!name);
  const uniqueByInitialPattern = uniqueMatch(initialPatternMatches);
  if (uniqueByInitialPattern) {
    const firstToken = nameTokens(name)?.[0] || "";
    const confidence = firstToken.length >= 3 ? WalkLeaderMatchConfidence.MEDIUM : WalkLeaderMatchConfidence.LOW;
    return {
      member: uniqueByInitialPattern,
      confidence,
      matchType: WalkLeaderMatchType.NAME_INITIAL_PATTERN
    };
  }

  return { member: null, confidence: WalkLeaderMatchConfidence.LOW, matchType: WalkLeaderMatchType.NONE };
}

function priorLookup(priorMatches: PriorContactMemberMatch[]): Map<string, PriorContactMemberMatch[]> {
  const lookup = new Map<string, PriorContactMemberMatch[]>();
  for (const match of priorMatches || []) {
    const key = normaliseText(match?.contactId);
    if (!key) {
      continue;
    }
    const existing = lookup.get(key) || [];
    lookup.set(key, [...existing, match]);
  }
  return lookup;
}

function memberLookup(members: Member[]): Map<string, Member> {
  const lookup = new Map<string, Member>();
  for (const existingMember of members || []) {
    const key = normaliseId(existingMember?.id);
    if (!key) {
      continue;
    }
    lookup.set(key, existingMember);
  }
  return lookup;
}

function priorMatchesForContactId(priorByContactId: Map<string, PriorContactMemberMatch[]>, contactId: string): PriorContactMemberMatch[] {
  const contactKey = normaliseText(contactId);
  if (!contactKey) {
    return [];
  }
  const exact = priorByContactId.get(contactKey) || [];
  if (exact.length > 0) {
    return exact;
  }
  const slug = slugForLookup(contactId);
  if (!slug) {
    return [];
  }
  const slugExact = priorByContactId.get(slug) || [];
  if (slugExact.length > 0) {
    return slugExact;
  }
  const suffixCandidates = Array.from(priorByContactId.entries())
    .filter(([key]) => key.endsWith(`-${slug}`) || key === slug);
  if (suffixCandidates.length === 1) {
    return suffixCandidates[0][1];
  }
  return [];
}

export function leaderMatchResult(members: Member[], contactDetails: ContactDetails, priorMatches: PriorContactMemberMatch[] = []): LeaderMemberMatchResult {
  const currentMatch = currentSignalMatch(members, contactDetails);
  const contactId = normaliseText(contactDetails?.contactId);
  const priorByContactId = priorLookup(priorMatches);
  const priorMatchesForContact = priorMatchesForContactId(priorByContactId, contactId);

  if (contactId && priorMatchesForContact.length > 0) {
    const distinctMemberIds = new Set(priorMatchesForContact.map(match => normaliseId(match?.memberId)).filter(item => !!item));
    if (distinctMemberIds.size > 1) {
      return { member: null, confidence: WalkLeaderMatchConfidence.LOW, matchType: WalkLeaderMatchType.PRIOR_CONFLICT };
    }
    const priorMatch = priorMatchesForContact[0];
    const priorMember = memberLookup(members).get(normaliseId(priorMatch?.memberId)) || null;
    if (!priorMember) {
      return { member: null, confidence: WalkLeaderMatchConfidence.LOW, matchType: WalkLeaderMatchType.PRIOR_MISSING_MEMBER };
    }
    if (currentMatch.member && normaliseId(currentMatch.member.id) !== normaliseId(priorMember.id)) {
      return { member: null, confidence: WalkLeaderMatchConfidence.LOW, matchType: WalkLeaderMatchType.PRIOR_CURRENT_CONFLICT };
    }
    return {
      member: priorMember,
      confidence: priorMatch.count > 1 ? WalkLeaderMatchConfidence.HIGH : WalkLeaderMatchConfidence.MEDIUM,
      matchType: priorMatch.count > 1 ? WalkLeaderMatchType.PRIOR_STRONG : WalkLeaderMatchType.PRIOR_SINGLE
    };
  }

  return currentMatch;
}

export function shouldAutoLinkLeaderMatch(result: LeaderMemberMatchResult): boolean {
  return !!result?.member && (result.confidence === WalkLeaderMatchConfidence.HIGH || result.confidence === WalkLeaderMatchConfidence.MEDIUM);
}

export function priorMatchesFromWalks(walks: ExtendedGroupEvent[]): PriorContactMemberMatch[] {
  const counts = new Map<string, number>();
  const values = new Map<string, PriorContactMemberMatch>();
  for (const walk of walks || []) {
    const contactId = normaliseText(walk?.fields?.contactDetails?.contactId);
    const memberId = walk?.fields?.contactDetails?.memberId;
    if (!contactId || !memberId) {
      continue;
    }
    const pairKey = `${contactId}|${memberId}`;
    const count = (counts.get(pairKey) || 0) + 1;
    counts.set(pairKey, count);
    values.set(pairKey, { contactId, memberId, count });
  }
  return Array.from(values.values());
}

export function matchedMemberForWalkLeader(members: Member[], contactDetails: ContactDetails): Member | null {
  return currentSignalMatch(members, contactDetails).member;
}
