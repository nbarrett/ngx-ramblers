import { isQuoted, plainText, unquote } from "../../../../projects/ngx-ramblers/src/app/functions/strings";

const EXCERPT_BEFORE = 60;
const EXCERPT_AFTER = 100;

export function matches(text: string, rawQuery: string): boolean {
  const lower = (text || "").toLowerCase();
  if (isQuoted(rawQuery)) {
    const phrase = unquote(rawQuery).toLowerCase();
    return phrase.length > 0 && lower.includes(phrase);
  }
  const query = rawQuery.trim().toLowerCase();
  if (lower.includes(query)) {
    return true;
  }
  const terms = query.split(/\s+/).filter(term => term.length > 0);
  return terms.length > 1 && terms.some(term => lower.includes(term));
}

export function termOverlap(text: string, rawQuery: string): number {
  if (isQuoted(rawQuery)) {
    return matches(text, rawQuery) ? 1 : 0;
  }
  const lower = (text || "").toLowerCase();
  const terms = rawQuery.trim().toLowerCase().split(/\s+/).filter(term => term.length > 0);
  return terms.filter(term => lower.includes(term)).length;
}

export function excerptAround(text: string, rawQuery: string): string {
  const plain = plainText(text);
  const phrase = unquote(rawQuery);
  const index = plain.toLowerCase().indexOf(phrase.toLowerCase());
  if (index < 0) {
    return plain.length > EXCERPT_AFTER ? `${plain.slice(0, EXCERPT_AFTER).trim()}…` : plain;
  }
  const start = Math.max(0, index - EXCERPT_BEFORE);
  const end = Math.min(plain.length, index + phrase.length + EXCERPT_AFTER);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < plain.length ? "…" : "";
  return `${prefix}${plain.slice(start, end).trim()}${suffix}`;
}
