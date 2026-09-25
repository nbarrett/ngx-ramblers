import { toDotCase, toKebabCase } from "./strings";

export function viewAsLooksLikeMemberId(value: string): boolean {
  return /^[a-f0-9]{24}$/i.test(value);
}

export function viewAsSlug(member: {userName?: string; firstName?: string; lastName?: string}): string | null {
  const userName = (member.userName || "").trim();
  if (userName) {
    return toKebabCase(userName) || null;
  } else {
    return toKebabCase(member.firstName, member.lastName) || null;
  }
}

export function viewAsSlugCandidates(slug: string): string[] {
  const kebab = toKebabCase(slug);
  const dotted = toDotCase(slug);
  const firstHyphen = kebab.indexOf("-");
  const asEmail = firstHyphen > 0 ? `${kebab.slice(0, firstHyphen)}@${toDotCase(kebab.slice(firstHyphen + 1))}` : null;
  return [slug.trim().toLowerCase(), kebab, dotted, asEmail].filter((value, index, all) => !!value && all.indexOf(value) === index);
}
