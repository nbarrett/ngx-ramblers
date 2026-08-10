import { isString } from "es-toolkit/compat";

export type MemberNameParts = {
  firstName?: string | null;
  title?: string | null;
  lastName?: string | null;
  displayName?: string | null;
};

export function trimmedNamePart(value: unknown): string {
  return isString(value) ? value.trim() : "";
}

export function memberFullName(member: MemberNameParts | null, defaultValue = ""): string {
  if (!member) {
    return defaultValue;
  }
  const firstName = trimmedNamePart(member.firstName || member.title);
  const lastName = trimmedNamePart(member.lastName);
  const displayName = trimmedNamePart(member.displayName);
  const fullName = `${firstName} ${firstName === lastName ? "" : lastName}`.trim();
  return fullName || displayName || defaultValue;
}

export interface MemberDisambiguationParts extends MemberNameParts {
  nameAlias?: string | null;
  email?: string | null;
}

export function memberNameCounts(members: MemberDisambiguationParts[]): Map<string, number> {
  return members.reduce((counts: Map<string, number>, member) => {
    const key = memberFullName(member).toLowerCase();
    return counts.set(key, (counts.get(key) ?? 0) + 1);
  }, new Map<string, number>());
}

export function meaningfulAlias(nameAlias: string): boolean {
  const alias = trimmedNamePart(nameAlias);
  return !!alias && !/^\d+$/.test(alias);
}

export function memberDisambiguatedLabel(member: MemberDisambiguationParts): string {
  const fullName = memberFullName(member);
  return meaningfulAlias(member.nameAlias) ? `${fullName} (${trimmedNamePart(member.nameAlias)})` : fullName;
}

export function abbreviatedWalksManagerContactName(contactName: string): boolean {
  const tokens = (contactName || "").trim().split(/\s+/).filter(token => !!token);
  if (tokens.length !== 2) {
    return false;
  }
  const firstName = tokens[0].replace(/[^A-Za-z]/g, "");
  const lastName = tokens[1].replace(/[^A-Za-z]/g, "");
  return firstName.length === 1 || lastName.length === 1;
}
