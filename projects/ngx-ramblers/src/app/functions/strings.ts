import { isBoolean, isString, kebabCase } from "es-toolkit/compat";

export function transliterated(value: any): any {
  return isString(value) ? value.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : value;
}

export function toKebabCase(...strings: any[]) {
  return strings
    .flat()
    .filter(item => item)
    .map(item => kebabCase(transliterated(item)))
    .join("-");
}

export function toDotCase(...strings: any[]) {
  return toKebabCase(...strings).replace(/-+/g, ".");
}

export function normaliseEmail(email: string): string {
  if (!email) {
    return null;
  } else {
    return email.trim().toLowerCase();
  }
}

export function emailDomain(email: string): string {
  const normalised = normaliseEmail(email) ?? "";
  const at = normalised.lastIndexOf("@");
  return at >= 0 ? normalised.slice(at + 1) : "";
}

export function emailIsOnDomain(email: string, domain: string): boolean {
  const host = (domain || "").trim().toLowerCase();
  return Boolean(host) && emailDomain(email) === host;
}

export function emailLocalPart(value: string): string {
  const typed = (value ?? "").trim().toLowerCase();
  const at = typed.indexOf("@");
  if (at >= 0) {
    return typed.slice(0, at).trim();
  } else {
    return typed;
  }
}

export const EMAIL_LOCAL_PART_MAX_LENGTH = 64;

export function validEmailLocalPart(value: string): boolean {
  const local = (value ?? "").trim().toLowerCase();
  return local.length <= EMAIL_LOCAL_PART_MAX_LENGTH && /^[a-z0-9](?:[a-z0-9._+-]*[a-z0-9])?$/.test(local);
}

export function emailLocalPartLengthMessage(value: string): string | null {
  const local = emailLocalPart(value);
  if (local.length > EMAIL_LOCAL_PART_MAX_LENGTH) {
    return `The part before @ can be at most ${EMAIL_LOCAL_PART_MAX_LENGTH} characters (this one is ${local.length}).`;
  } else {
    return null;
  }
}

export function fitEmailLocalPart(value: string): string {
  const local = (value || "").trim().toLowerCase();
  if (local.length <= EMAIL_LOCAL_PART_MAX_LENGTH) {
    return local;
  } else {
    const cut = local.slice(0, EMAIL_LOCAL_PART_MAX_LENGTH);
    const lastHyphen = cut.lastIndexOf("-");
    if (lastHyphen > 0) {
      return cut.slice(0, lastHyphen);
    } else {
      return cut;
    }
  }
}

export function addressOnDomain(value: string, domain: string): string | null {
  const local = (value ?? "").trim().toLowerCase();
  const host = (domain ?? "").trim().toLowerCase();
  if (!validEmailLocalPart(local) || !host) {
    return null;
  } else {
    return `${local}@${host}`;
  }
}

export function toSlug(input: string): string {
  if (!input) {
    return "";
  } else {
    return transliterated(input)
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  }
}

export function convertTitleToSlug(title: string): string {
  if (title) {
    const stopwords = new Set(["a", "an", "the", "to", "by", "via", "in", "of", "from"]);
    return toKebabCase(title).split("-").filter(item => !stopwords.has(item)).join("-");
  } else {
    return title;
  }
}

export function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function extractErrorMessage(err: any): string {
  if (err?.error?.error?.message) {
    return err.error.error.message;
  }
  if (isString(err?.error?.error)) {
    return err.error.error;
  }
  if (err?.error?.message) {
    return err.error.message;
  }
  if (err?.message) {
    return err.message;
  }
  if (isString(err?.error)) {
    return err.error;
  }
  if (isString(err)) {
    return err;
  }
  return "An unexpected error occurred";
}

export function isQuoted(value: string): boolean {
  const trimmed = (value || "").trim();
  return trimmed.length >= 2 && trimmed.startsWith("\"") && trimmed.endsWith("\"");
}

export function unquote(value: string): string {
  return isQuoted(value) ? value.trim().slice(1, -1).trim() : (value || "").trim();
}

export function plainText(text: string): string {
  return (text || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)]\([^)]*\)/g, "$1")
    .replace(/^\s*>+/gm, " ")
    .replace(/[#*_`~]/g, " ")
    .replace(/[|:\- ]*-{3,}[|:\- ]*/g, " ")
    .replace(/\s*\|+\s*/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#3[49];/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function unescapeMarkdownLinks(value: string): string {
  return isString(value) ? value.replace(/\\\[([^\]]*)\\\]\(([^)]*)\)/g, "[$1]($2)") : value;
}

export function firstLinkHref(text: string): string {
  const match = /(?<!!)\[[^\]]*]\(([^)\s]+)[^)]*\)/.exec(text || "");
  return match ? match[1] : null;
}

export function firstLinkText(text: string): string {
  const match = /(?<!!)\[([^\]]*)]\([^)]*\)/.exec(text || "");
  return match ? match[1].trim() : null;
}

export function booleanOf(value: any, fallback: boolean = false): boolean {
  const normalized = (value == null ? "" : value.toString()).trim().toLowerCase();
  if (isBoolean(value)) {
    return value;
  } else if (["true", "1", "yes"].includes(normalized)) {
    return true;
  } else if (["false", "0", "no"].includes(normalized)) {
    return false;
  } else {
    return fallback;
  }
}

const TRAILING_ELLIPSIS = /(…|\.\.\.)$/;

export function normalisedForComparison(value: string): string {
  return (value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function endsWithEllipsis(value: string): boolean {
  return TRAILING_ELLIPSIS.test((value || "").trim());
}

export function matchesAllowingTruncation(possiblyTruncated: string, full: string): boolean {
  const truncated = normalisedForComparison(possiblyTruncated);
  const complete = normalisedForComparison(full);
  if (truncated === complete) {
    return true;
  }
  const withoutEllipsis = truncated.replace(TRAILING_ELLIPSIS, "").trim();
  return endsWithEllipsis(truncated) && withoutEllipsis.length > 0 && complete.startsWith(withoutEllipsis);
}
