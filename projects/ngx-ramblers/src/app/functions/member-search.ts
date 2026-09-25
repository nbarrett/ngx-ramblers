import { Member } from "../models/member.model";
import { memberDisambiguatedLabel, memberFullName } from "./member-names";

export const MEMBER_TYPEAHEAD_LIMIT = 40;

export function memberSearchHaystack(member: Member): string {
  return [
    memberFullName(member),
    memberDisambiguatedLabel(member),
    member.email,
    member.membershipNumber,
    member.nameAlias
  ].filter(Boolean).join(" ").toLowerCase();
}

export function memberMatchesSearch(member: Member, term: string): boolean {
  const query = (term || "").trim().toLowerCase();
  if (!query) {
    return true;
  } else {
    return memberSearchHaystack(member).includes(query);
  }
}

export function limitedMemberMatches<T extends {id?: string}>(
  members: T[],
  term: string,
  selectedIds: string[],
  matches: (item: T) => boolean,
  limit: number = MEMBER_TYPEAHEAD_LIMIT
): T[] {
  const selected = new Set(selectedIds);
  const chosen = members.filter(item => item.id && selected.has(item.id));
  const hits = members.filter(item => (!item.id || !selected.has(item.id)) && matches(item)).slice(0, limit);
  return [...chosen, ...hits];
}

export function mongoMemberSearchCriteria(term: string, extras: Record<string, unknown> = {}): Record<string, unknown> {
  const query = (term || "").trim();
  if (!query) {
    return extras;
  } else {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matcher = {$regex: escaped, $options: "i"};
    return {
      ...extras,
      $or: [
        {firstName: matcher},
        {lastName: matcher},
        {displayName: matcher},
        {nameAlias: matcher},
        {email: matcher},
        {membershipNumber: matcher}
      ]
    };
  }
}
