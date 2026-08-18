import TurndownService from "turndown";
import { isString } from "es-toolkit/compat";
import { unescapeMarkdownLinks } from "./strings";

const turndownService = new TurndownService();
const FLATTENED_LINK = /:\s+(?:\[(https?:\/\/[^\s\]]+)]\(\1\)|(https?:\/\/[^\s)]+))/g;
const FLATTENED_POSTCODE_LABEL = /([A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2})$/;
const FLATTENED_WORD_LABEL = /([A-Za-z0-9][A-Za-z0-9'-]*(?:\s+[A-Za-z0-9][A-Za-z0-9'-]*){0,4})$/;

export function normaliseMarkdownText(value: string | null): string | null {
  if (!isString(value)) {
    return value;
  } else {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    } else {
      const markdown = /<\s*[a-z][^>]*>/i.test(trimmed) ? turndownService.turndown(trimmed).trim() : trimmed;
      return restoreFlattenedMarkdownLinks(unescapeMarkdownLinks(markdown));
    }
  }
}

const FLATTENED_LEAD_INS = new Set(["a", "an", "and", "at", "by", "for", "from", "in", "meet", "of", "on", "the", "to", "via", "we"]);

function flattenedLinkUrl(markdownUrl: string, bareUrl: string): {url: string; suffix: string} {
  const raw = markdownUrl || bareUrl || "";
  const punct = /[.,;:]+$/.exec(raw);
  return {url: raw.replace(/[.,;:]+$/, ""), suffix: punct ? punct[0] : ""};
}

function flattenedLinkLabel(before: string): string | null {
  const ended = before.trimEnd();
  const postcode = FLATTENED_POSTCODE_LABEL.exec(ended);
  const words = FLATTENED_WORD_LABEL.exec(ended);
  if (postcode) {
    return postcode[1];
  } else if (!words || /^https?:\/\//i.test(words[1])) {
    return null;
  } else {
    const tokens = words[1].split(/\s+/);
    const start = {at: 0};
    tokens.forEach((token, index) => {
      if (index === start.at && FLATTENED_LEAD_INS.has(token.toLowerCase())) {
        start.at = index + 1;
      }
    });
    const kept = tokens.slice(start.at);
    return kept.length > 0 ? kept.join(" ") : words[1];
  }
}

function restoreFlattenedMarkdownLinks(value: string): string {
  const pieces: string[] = [];
  const cursor = {at: 0};
  Array.from(value.matchAll(FLATTENED_LINK)).forEach(match => {
    const colonAt = match.index || 0;
    const before = value.slice(cursor.at, colonAt);
    const label = flattenedLinkLabel(before);
    const parsed = flattenedLinkUrl(match[1], match[2]);
    if (!label || !parsed.url) {
      pieces.push(value.slice(cursor.at, colonAt + match[0].length));
    } else {
      pieces.push(before.slice(0, before.trimEnd().length - label.length));
      pieces.push(`[${label}](${parsed.url})${parsed.suffix}`);
    }
    cursor.at = colonAt + match[0].length;
  });
  pieces.push(value.slice(cursor.at));
  return pieces.join("");
}
