import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { htmlToMarkdown } from "./turndown-service-factory";
import { HtmlPastePreview, HtmlPasteRow } from "../../../projects/ngx-ramblers/src/app/models/html-paste.model";

const debugLog = debug(envConfig.logNamespace("html-paste-preview"));
debugLog.enabled = true;

export function buildHtmlPastePreview(html: string, baseUrl?: string): HtmlPastePreview {
  const markdown = htmlToMarkdown(html, baseUrl);
  const rows = splitMarkdownIntoRows(markdown);
  debugLog("buildHtmlPastePreview rows:", rows.map(row => ({
    textLength: row.text ? row.text.length : 0,
    imageSource: row.imageSource
  })));
  return {markdown, rows};
}

export function buildMarkdownPastePreview(markdown: string): HtmlPastePreview {
  const rows = splitMarkdownIntoRows(markdown);
  debugLog("buildMarkdownPastePreview rows:", rows.map(row => ({
    textLength: row.text ? row.text.length : 0,
    imageSource: row.imageSource
  })));
  return {markdown, rows};
}

function splitMarkdownIntoRows(markdown: string): HtmlPasteRow[] {
  if (!markdown) {
    return [];
  }

  const rows: HtmlPasteRow[] = [];
  let lastIndex = 0;
  let searchIndex = 0;

  const isShortCaption = (text: string): boolean => {
    const trimmed = text.trim();
    const paragraphs = trimmed.split(/\n\s*\n/);
    return paragraphs.length <= 1 && trimmed.length < 200;
  };

  while (searchIndex < markdown.length) {
    const imageStart = markdown.indexOf("![", searchIndex);
    if (imageStart === -1) {
      break;
    }

    const imageMatch = parseMarkdownImageAt(markdown, imageStart);
    if (!imageMatch) {
      searchIndex = imageStart + 2;
      continue;
    }

    const textBefore = markdown.substring(lastIndex, imageMatch.start).trim();
    const trimmedLink = imageMatch.url ? imageMatch.url.trim() : "";
    const alt = imageMatch.alt;

    if (trimmedLink.length > 0) {
      if (textBefore && textBefore.replace(/\s+/g, "").length > 0 && isShortCaption(textBefore)) {
        rows.push({
          text: textBefore,
          imageSource: trimmedLink,
          alt
        });
      } else {
        if (textBefore && textBefore.replace(/\s+/g, "").length > 0) {
          rows.push({text: textBefore});
        }
        rows.push({
          imageSource: trimmedLink,
          alt
        });
      }
    } else if (textBefore && textBefore.replace(/\s+/g, "").length > 0) {
      rows.push({text: textBefore});
    }

    lastIndex = imageMatch.end;
    searchIndex = imageMatch.end;
  }

  const remaining = markdown.substring(lastIndex).trim();
  if (remaining && remaining.replace(/\s+/g, "").length > 0) {
    if (rows.length > 0 && rows[rows.length - 1].imageSource && !rows[rows.length - 1].text && isShortCaption(remaining)) {
      rows[rows.length - 1].text = remaining;
    } else {
      rows.push({text: remaining});
    }
  }

  if (rows.length === 0 && markdown.trim().length > 0) {
    rows.push({text: markdown});
  }

  return rows;
}

function parseMarkdownImageAt(markdown: string, startIndex: number): { start: number; end: number; alt: string | null; url: string | null } | null {
  if (startIndex < 0 || startIndex >= markdown.length) {
    return null;
  }
  if (markdown[startIndex] !== "!" || markdown[startIndex + 1] !== "[") {
    return null;
  }

  let cursor = startIndex + 2;
  let alt = "";
  while (cursor < markdown.length) {
    const char = markdown[cursor];
    if (char === "\\" && cursor + 1 < markdown.length) {
      alt += markdown[cursor + 1];
      cursor += 2;
      continue;
    }
    if (char === "]") {
      break;
    }
    alt += char;
    cursor++;
  }

  if (cursor >= markdown.length || markdown[cursor] !== "]") {
    return null;
  }

  cursor++;

  while (cursor < markdown.length && /\s/.test(markdown[cursor])) {
    cursor++;
  }

  if (cursor >= markdown.length) {
    return null;
  }

  const nextChar = markdown[cursor];

  if (nextChar === "(") {
    return parseInlineImage(markdown, startIndex, cursor + 1, alt);
  }

  if (nextChar === "[") {
    return parseReferenceImage(markdown, startIndex, cursor, alt);
  }

  return null;
}

function parseInlineImage(markdown: string, startIndex: number, cursor: number, alt: string): { start: number; end: number; alt: string | null; url: string | null } | null {
  let index = cursor;
  while (index < markdown.length && /\s/.test(markdown[index])) {
    index++;
  }

  if (index >= markdown.length) {
    return null;
  }

  let url = "";

  if (markdown[index] === "<") {
    index++;
    while (index < markdown.length && markdown[index] !== ">") {
      const char = markdown[index];
      if (char === "\\" && index + 1 < markdown.length) {
        url += markdown[index + 1];
        index += 2;
        continue;
      }
      url += char;
      index++;
    }
    if (index >= markdown.length || markdown[index] !== ">") {
      return null;
    }
    index++;
  } else {
    let nestedParentheses = 0;
    while (index < markdown.length) {
      const char = markdown[index];
      if (char === "\\" && index + 1 < markdown.length) {
        url += markdown[index + 1];
        index += 2;
        continue;
      }
      if (char === "(") {
        nestedParentheses++;
        url += char;
        index++;
        continue;
      }
      if (char === ")") {
        if (nestedParentheses === 0) {
          break;
        }
        nestedParentheses--;
        url += char;
        index++;
        continue;
      }
      if (char === " " || char === "\t" || char === "\n") {
        break;
      }
      url += char;
      index++;
    }
  }

  url = url.trim();

  while (index < markdown.length && /\s/.test(markdown[index])) {
    index++;
  }

  if (index < markdown.length && (markdown[index] === "\"" || markdown[index] === "'" || markdown[index] === "(")) {
    const delimiter = markdown[index];
    index++;
    while (index < markdown.length) {
      const char = markdown[index];
      if (char === "\\" && index + 1 < markdown.length) {
        index += 2;
        continue;
      }
      if ((delimiter === "(" && char === ")") || (delimiter !== "(" && char === delimiter)) {
        index++;
        break;
      }
      index++;
    }
    while (index < markdown.length && /\s/.test(markdown[index])) {
      index++;
    }
  }

  if (index >= markdown.length || markdown[index] !== ")") {
    return null;
  }

  return {
    start: startIndex,
    end: index + 1,
    alt: alt.trim() || null,
    url: url || null
  };
}

function parseReferenceImage(markdown: string, startIndex: number, cursor: number, alt: string): { start: number; end: number; alt: string | null; url: string | null } | null {
  let index = cursor + 1;
  let reference = "";

  while (index < markdown.length) {
    const char = markdown[index];
    if (char === "\\" && index + 1 < markdown.length) {
      reference += markdown[index + 1];
      index += 2;
      continue;
    }
    if (char === "]") {
      break;
    }
    reference += char;
    index++;
  }

  if (index >= markdown.length || markdown[index] !== "]") {
    return null;
  }

  index++;

  const label = (reference.trim().length > 0 ? reference.trim() : alt).trim();
  const definitionRegex = label.length > 0
    ? new RegExp(`^\\s*\\[${escapeForRegExp(label)}\\]:\\s*(\\S+)`, "mi")
    : null;

  let url: string | null = null;

  if (definitionRegex) {
    const match = markdown.match(definitionRegex);
    if (match && match[1]) {
      url = match[1];
    }
  }

  return {
    start: startIndex,
    end: index,
    alt: alt.trim() || null,
    url
  };
}

function escapeForRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
