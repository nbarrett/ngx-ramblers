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
