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

export function abbreviatedWalksManagerContactName(contactName: string): boolean {
  const tokens = (contactName || "").trim().split(/\s+/).filter(token => !!token);
  if (tokens.length !== 2) {
    return false;
  }
  const firstName = tokens[0].replace(/[^A-Za-z]/g, "");
  const lastName = tokens[1].replace(/[^A-Za-z]/g, "");
  return firstName.length === 1 || lastName.length === 1;
}
