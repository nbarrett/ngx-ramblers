import TurndownService from "turndown";
import { isString } from "es-toolkit/compat";
import { unescapeMarkdownLinks } from "./strings";

const turndownService = new TurndownService();

export function normaliseMarkdownText(value: string | null): string | null {
  if (!isString(value)) {
    return value;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const hasHtmlTags = /<\s*[a-z][^>]*>/i.test(trimmed);
  if (!hasHtmlTags) {
    return unescapeMarkdownLinks(trimmed);
  }
  return unescapeMarkdownLinks(turndownService.turndown(trimmed).trim());
}
