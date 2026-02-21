import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { htmlToMarkdown } from "./turndown-service-factory";
import { HtmlPastePreview, HtmlPasteRow } from "../../../projects/ngx-ramblers/src/app/models/html-paste.model";

const debugLog = debug(envConfig.logNamespace("html-paste-preview"));
debugLog.enabled = false;

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

  const isShortCaption = (text: string): boolean => {
    const trimmed = text.trim();
    const paragraphs = trimmed.split(/\n\s*\n/);
    return paragraphs.length <= 1 && trimmed.length < 200;
  };

  const scan = (searchIndex: number, lastIndex: number, rows: HtmlPasteRow[]): {rows: HtmlPasteRow[]; lastIndex: number} => {
    const imageStart = markdown.indexOf("![", searchIndex);
    if (imageStart === -1) {
      return {rows, lastIndex};
    }

    const imageMatch = parseMarkdownImageAt(markdown, imageStart);
    if (!imageMatch) {
      return scan(imageStart + 2, lastIndex, rows);
    }

    const textBefore = markdown.substring(lastIndex, imageMatch.start).trim();
    const trimmedLink = imageMatch.url ? imageMatch.url.trim() : "";
    const alt = imageMatch.alt;

    let newRows: HtmlPasteRow[];
    if (trimmedLink.length > 0) {
      if (textBefore && textBefore.replace(/\s+/g, "").length > 0 && isShortCaption(textBefore)) {
        newRows = [...rows, { text: textBefore, imageSource: trimmedLink, alt }];
      } else {
        const withText = textBefore && textBefore.replace(/\s+/g, "").length > 0
          ? [...rows, {text: textBefore}]
          : rows;
        newRows = [...withText, { imageSource: trimmedLink, alt }];
      }
    } else if (textBefore && textBefore.replace(/\s+/g, "").length > 0) {
      newRows = [...rows, {text: textBefore}];
    } else {
      newRows = rows;
    }

    return scan(imageMatch.end, imageMatch.end, newRows);
  };

  const {rows, lastIndex} = scan(0, 0, []);

  const remainingText = markdown.substring(lastIndex).trim();
  let finalRows = rows;
  if (remainingText && remainingText.replace(/\s+/g, "").length > 0) {
    if (finalRows.length > 0 && finalRows[finalRows.length - 1].imageSource && !finalRows[finalRows.length - 1].text && isShortCaption(remainingText)) {
      finalRows = [...finalRows.slice(0, -1), {...finalRows[finalRows.length - 1], text: remainingText}];
    } else {
      finalRows = [...finalRows, {text: remainingText}];
    }
  }

  if (finalRows.length === 0 && markdown.trim().length > 0) {
    return [{text: markdown}];
  }

  return finalRows;
}

function parseMarkdownImageAt(markdown: string, startIndex: number): { start: number; end: number; alt: string | null; url: string | null } | null {
  if (startIndex < 0 || startIndex >= markdown.length) {
    return null;
  }
  if (markdown[startIndex] !== "!" || markdown[startIndex + 1] !== "[") {
    return null;
  }

  const parseAlt = (cursor: number, alt: string): {cursor: number; alt: string} | null => {
    if (cursor >= markdown.length) return null;
    const char = markdown[cursor];
    if (char === "\\" && cursor + 1 < markdown.length) return parseAlt(cursor + 2, alt + markdown[cursor + 1]);
    if (char === "]") return {cursor, alt};
    return parseAlt(cursor + 1, alt + char);
  };

  const altResult = parseAlt(startIndex + 2, "");
  if (!altResult || altResult.cursor >= markdown.length || markdown[altResult.cursor] !== "]") {
    return null;
  }

  const skipWhitespace = (cursor: number): number => {
    if (cursor >= markdown.length || !/\s/.test(markdown[cursor])) return cursor;
    return skipWhitespace(cursor + 1);
  };

  const afterBracket = skipWhitespace(altResult.cursor + 1);

  if (afterBracket >= markdown.length) {
    return null;
  }

  const nextChar = markdown[afterBracket];

  if (nextChar === "(") {
    return parseInlineImage(markdown, startIndex, afterBracket + 1, altResult.alt);
  }

  if (nextChar === "[") {
    return parseReferenceImage(markdown, startIndex, afterBracket, altResult.alt);
  }

  return null;
}

function parseInlineImage(markdown: string, startIndex: number, cursor: number, alt: string): { start: number; end: number; alt: string | null; url: string | null } | null {
  const skipWhitespace = (i: number): number => {
    if (i >= markdown.length || !/\s/.test(markdown[i])) return i;
    return skipWhitespace(i + 1);
  };

  const parseAngleUrl = (i: number, url: string): {index: number; url: string} | null => {
    if (i >= markdown.length) return null;
    if (markdown[i] === ">") return {index: i + 1, url};
    const char = markdown[i];
    if (char === "\\" && i + 1 < markdown.length) return parseAngleUrl(i + 2, url + markdown[i + 1]);
    return parseAngleUrl(i + 1, url + char);
  };

  const parsePlainUrl = (i: number, url: string, nested: number): {index: number; url: string} => {
    if (i >= markdown.length) return {index: i, url};
    const char = markdown[i];
    if (char === "\\" && i + 1 < markdown.length) return parsePlainUrl(i + 2, url + markdown[i + 1], nested);
    if (char === "(") return parsePlainUrl(i + 1, url + char, nested + 1);
    if (char === ")") {
      if (nested === 0) return {index: i, url};
      return parsePlainUrl(i + 1, url + char, nested - 1);
    }
    if (char === " " || char === "\t" || char === "\n") return {index: i, url};
    return parsePlainUrl(i + 1, url + char, nested);
  };

  const skipTitle = (i: number, delimiter: string): number => {
    if (i >= markdown.length) return i;
    const char = markdown[i];
    if (char === "\\" && i + 1 < markdown.length) return skipTitle(i + 2, delimiter);
    if ((delimiter === "(" && char === ")") || (delimiter !== "(" && char === delimiter)) return i + 1;
    return skipTitle(i + 1, delimiter);
  };

  const start = skipWhitespace(cursor);

  if (start >= markdown.length) {
    return null;
  }

  let url: string;
  let afterUrl: number;

  if (markdown[start] === "<") {
    const angleResult = parseAngleUrl(start + 1, "");
    if (!angleResult) return null;
    url = angleResult.url;
    afterUrl = angleResult.index;
  } else {
    const plainResult = parsePlainUrl(start, "", 0);
    url = plainResult.url;
    afterUrl = plainResult.index;
  }

  url = url.trim();

  const afterUrlWs = skipWhitespace(afterUrl);

  let afterTitle = afterUrlWs;
  if (afterUrlWs < markdown.length && (markdown[afterUrlWs] === "\"" || markdown[afterUrlWs] === "'" || markdown[afterUrlWs] === "(")) {
    const delimiter = markdown[afterUrlWs];
    afterTitle = skipWhitespace(skipTitle(afterUrlWs + 1, delimiter));
  }

  if (afterTitle >= markdown.length || markdown[afterTitle] !== ")") {
    return null;
  }

  return {
    start: startIndex,
    end: afterTitle + 1,
    alt: alt.trim() || null,
    url: url || null
  };
}

function parseReferenceImage(markdown: string, startIndex: number, cursor: number, alt: string): { start: number; end: number; alt: string | null; url: string | null } | null {
  const parseRef = (i: number, reference: string): {index: number; reference: string} | null => {
    if (i >= markdown.length) return null;
    const char = markdown[i];
    if (char === "\\" && i + 1 < markdown.length) return parseRef(i + 2, reference + markdown[i + 1]);
    if (char === "]") return {index: i, reference};
    return parseRef(i + 1, reference + char);
  };

  const refResult = parseRef(cursor + 1, "");

  if (!refResult || refResult.index >= markdown.length || markdown[refResult.index] !== "]") {
    return null;
  }

  const label = (refResult.reference.trim().length > 0 ? refResult.reference.trim() : alt).trim();
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
    end: refResult.index + 1,
    alt: alt.trim() || null,
    url
  };
}

function escapeForRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
