import { ParsedEmailPaste } from "../models/email-composer.model";
import {keys} from "es-toolkit/compat";
import {parseEmailAddressList} from "./email-addresses";
import { escapeHtml, plainText } from "./strings";

export type IntroTitledPastePlan =
  | { apply: false }
  | { apply: true; subject: string | null; body: string };

const DOCUMENT_TITLE_HEADING_LEVELS = [1, 2];

type DocumentHeading = {
  level: number;
  title: string;
  lineIndex: number | null;
};

function markdownHeadings(content: string): DocumentHeading[] {
  const fence = {open: false};
  return content.split(/\r?\n/).reduce<DocumentHeading[]>((headings, line, index) => {
    if (/^\s*```/.test(line)) {
      fence.open = !fence.open;
      return headings;
    } else if (fence.open) {
      return headings;
    } else {
      const match = line.trim().match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
      return match
        ? headings.concat({level: match[1].length, title: plainText(match[2]), lineIndex: index})
        : headings;
    }
  }, []);
}

function htmlHeadings(html: string): DocumentHeading[] {
  const parsed = {headings: [] as DocumentHeading[]};
  if (html) {
    try {
      const doc = new DOMParser().parseFromString(html, "text/html");
      parsed.headings = Array.from(doc.body.querySelectorAll("h1, h2, h3, h4, h5, h6"))
        .map(element => ({
          level: Number(element.tagName.slice(1)),
          title: plainText(element.textContent ?? ""),
          lineIndex: null
        }))
        .filter(heading => heading.title.length > 0);
    } catch {
      parsed.headings = [];
    }
  }
  return parsed.headings;
}

function uniqueTopDocumentHeading(headings: DocumentHeading[]): DocumentHeading | null {
  const topLevel = headings.reduce<number | null>((min, heading) =>
    min == null || heading.level < min ? heading.level : min, null);
  const topHeadings = topLevel != null && DOCUMENT_TITLE_HEADING_LEVELS.includes(topLevel)
    ? headings.filter(heading => heading.level === topLevel)
    : [];
  return topHeadings.length === 1 ? topHeadings[0] : null;
}

function stripHeadingAtLine(content: string, lineIndex: number): string {
  const lines = content.split(/\r?\n/);
  return [...lines.slice(0, lineIndex), ...lines.slice(lineIndex + 1)].join("\n").replace(/^\n+/, "");
}

function headingIsAtStart(content: string, lineIndex: number): boolean {
  return content.split(/\r?\n/).slice(0, lineIndex).every(line => line.trim() === "");
}

function bodyWithoutLeadingTitle(content: string, title: string): string {
  const lines = content.split(/\r?\n/);
  const firstNonBlankIdx = lines.findIndex(line => line.trim() !== "");
  if (firstNonBlankIdx === -1) {
    return content;
  } else {
    const firstLine = lines[firstNonBlankIdx].trim();
    const headingMatch = firstLine.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
    const firstLineTitle = headingMatch ? plainText(headingMatch[1]) : plainText(firstLine);
    return firstLineTitle === title
      ? lines.slice(firstNonBlankIdx + 1).join("\n").replace(/^\n+/, "")
      : content;
  }
}

export function extractLeadingTitle(content: string, html?: string): { title: string; body: string } | null {
  const heading = uniqueTopDocumentHeading(markdownHeadings(content))
    ?? (html ? uniqueTopDocumentHeading(htmlHeadings(html)) : null);
  if (!heading?.title) {
    return null;
  } else if (heading.lineIndex != null && headingIsAtStart(content, heading.lineIndex)) {
    return {title: heading.title, body: stripHeadingAtLine(content, heading.lineIndex)};
  } else {
    return {title: heading.title, body: bodyWithoutLeadingTitle(content, heading.title)};
  }
}

export function subjectTextFromPaste(text: string, html?: string): string {
  return extractLeadingTitle(text, html)?.title || plainText(text || html || "");
}

export function shouldRunIntroSmartPaste(brandingIsUnbranded: boolean, isInboxReply: boolean): boolean {
  return brandingIsUnbranded && !isInboxReply;
}

export function subjectStillDefault(existingSubject: string, defaultConfigSubject: string, generatedSubjects: string[] = []): boolean {
  const existing = existingSubject?.trim();
  const automaticSubjects = [defaultConfigSubject, ...generatedSubjects].map(subject => (subject ?? "").trim()).filter(Boolean);
  return !existing || automaticSubjects.includes(existing);
}

export function subjectNeedsPersonalising(
  existingSubject: string,
  templateSubject: string,
  placeholder: boolean,
  preparedSubjects: string[] = []
): boolean {
  if (!placeholder) {
    return false;
  } else {
    const current = (existingSubject ?? "").trim();
    return !current || preparedSubjects.some(subject => (subject ?? "").trim() === current)
      ? false
      : subjectStillDefault(existingSubject, templateSubject);
  }
}

export function planTitledIntroPaste(
  pasteText: string,
  titled: { title: string; body: string },
  existingSubject: string,
  defaultConfigSubject: string,
  hasExistingIntro: boolean
): IntroTitledPastePlan {
  let plan: IntroTitledPastePlan = { apply: false };
  if (!hasExistingIntro) {
    const replaceSubject = subjectStillDefault(existingSubject, defaultConfigSubject);
    plan = {
      apply: true,
      subject: replaceSubject ? titled.title : null,
      body: replaceSubject ? titled.body : pasteText
    };
  }
  return plan;
}

export function placeForwardedIntroMarkdown(
  existingIntro: string,
  forwardedMarkdown: string,
  preferAboveExisting: boolean
): string {
  const existing = existingIntro ?? "";
  const hasExisting = existing.trim().length > 0;
  let result = forwardedMarkdown;
  if (hasExisting) {
    result = preferAboveExisting
      ? `${forwardedMarkdown}${existing.startsWith("\n") ? "" : "\n"}${existing}`
      : `${existing}${forwardedMarkdown}`;
  }
  return result;
}

export function emailHeadersNearTop(text: string): boolean {
  const lines = (text ?? "").split(/\r?\n/);
  const addressingHeader = /^(To|From|Cc|Bcc|Subject):\s*\S/i;
  const firstHeaderIdx = lines.findIndex(line => addressingHeader.test(stripMarkdownDecorations(line)));
  const parsed = firstHeaderIdx >= 0 && firstHeaderIdx < 40 ? parseEmailHeadersFromMarkdown(text) : null;
  const explicitEnvelope = !!parsed?.subject && parsed.forwardedHeaderLines.some(line => /^(To|Cc):\s*\S/i.test(line));
  return explicitEnvelope || firstHeaderIdx >= 0 && lines.slice(0, firstHeaderIdx).every(line => {
    const stripped = stripMarkdownDecorations(line);
    return stripped === "" || /^\s*#{1,6}\s/.test(line) || /^[A-Za-z][A-Za-z -]*:\s/.test(stripped);
  });
}

export function buildForwardedIntroMarkdown(headerLines: string[], body: string): string {
  const headerBlock = headerLines.join("  \n");
  const trimmedBody = body?.trim() ?? "";
  return `\n\n---\n\n${headerBlock}\n\n---\n\n${trimmedBody}`;
}

export function parseEmailHeadersFromMarkdown(content: string): ParsedEmailPaste | null {
  const lines = content.split(/\r?\n/);
  const HEADER_REGEX = /^(To|From|Cc|Bcc|Subject|Date|Sent|Reply-To):\s*(.+)$/i;
  const firstHeaderIdx = lines.findIndex(line => {
    const stripped = stripMarkdownDecorations(line);
    return stripped !== "" && HEADER_REGEX.test(stripped);
  });
  if (firstHeaderIdx === -1) {
    return null;
  } else {
    const parsed = collectHeaderLines(lines, firstHeaderIdx, HEADER_REGEX, {}, -1);
    const {headers, bodyStartLine} = parsed;
    if (keys(headers).length === 0 || (!headers.to && !headers.subject && !headers.from)) {
      return null;
    } else {
      const body = bodyStartLine >= 0 ? lines.slice(bodyStartLine).join("\n").replace(/^\n+/, "").replace(/^---[ \t]*\n+/, "") : "";
      const headerEndIdx = bodyStartLine >= 0 ? bodyStartLine : lines.length;
      const forwardedHeaderLines = lines.slice(firstHeaderIdx, headerEndIdx)
        .map(line => stripMarkdownDecorations(line))
        .filter(line => line !== "");
      const toList = parseEmailAddressList(headers.to ?? "");
      return {
        to: toList,
        cc: parseEmailAddressList(headers.cc ?? ""),
        subject: headers.subject ?? null,
        body,
        forwardedHeaderLines
      };
    }
  }
}

function collectHeaderLines(lines: string[], index: number, headerRegex: RegExp, headers: Record<string, string>, bodyStartLine: number): {
  headers: Record<string, string>;
  bodyStartLine: number;
} {
  if (index >= lines.length) {
    return {headers, bodyStartLine};
  } else {
    const stripped = stripMarkdownDecorations(lines[index]);
    if (stripped === "") {
      const nextNonBlank = findNextNonBlankLine(lines, index + 1);
      if (nextNonBlank === -1) {
        return {headers, bodyStartLine: lines.length};
      } else if (headerRegex.test(stripMarkdownDecorations(lines[nextNonBlank]))) {
        return collectHeaderLines(lines, index + 1, headerRegex, headers, bodyStartLine);
      } else {
        return {headers, bodyStartLine: nextNonBlank};
      }
    }
    const headerMatch = stripped.match(headerRegex);
    if (headerMatch) {
      const key = headerMatch[1].toLowerCase();
      const merged = {
        ...headers,
        [key]: headers[key] ? `${headers[key]}, ${headerMatch[2].trim()}` : headerMatch[2].trim()
      };
      return collectHeaderLines(lines, index + 1, headerRegex, merged, bodyStartLine);
    } else if (/^[A-Za-z][A-Za-z -]*:\s/.test(stripped)) {
      return collectHeaderLines(lines, index + 1, headerRegex, headers, bodyStartLine);
    } else {
      return {headers, bodyStartLine: index};
    }
  }
}

function findNextNonBlankLine(lines: string[], from: number): number {
  const offset = lines.slice(from).findIndex(line => stripMarkdownDecorations(line) !== "");
  return offset === -1 ? -1 : from + offset;
}

function stripMarkdownDecorations(line: string): string {
  return line
    .replace(/^[\s>*_`#-]+/, "")
    .replace(/[*_`]+$/g, "")
    .replace(/\*\*|__/g, "")
    .trim();
}

export function escapeMarkdownBlockStarts(markdown: string): string {
  return markdown
    .replace(/^(#{1,6})(?=\s)/gm, "\\$1")
    .replace(/^([-+])(?=\s)/gm, "\\$1")
    .replace(/^(-{3,})(?=\s*$)/gm, "\\$1")
    .replace(/^(\d+)([.)])(?=\s)/gm, "$1\\$2")
    .replace(/^[ \t]+/gm, whitespace => whitespace.replace(/ /g, "&#32;").replace(/\t/g, "&#9;"));
}

export function plainTextAsMarkdown(text: string): string {
  return escapeMarkdownBlockStarts(escapeHtml(text ?? "")
    .replace(/([\\`*_[\]{}#+!|~-])/g, "\\$1")
    .replace(/\r\n?/g, "\n"))
    .split("\n")
    .map((line, index, lines) => line + (index < lines.length - 1 ? (line && lines[index + 1] ? "  \n" : "\n") : ""))
    .join("");
}

export function looksLikeDiagnosticPaste(text: string): boolean {
  return /<\/?[a-z][a-z0-9-]*(?:\s[^>]*|\/?)>/i.test(text) || /^(?:%\s|diff\s|--- |\+\+\+ |@@ )/m.test(text);
}

export function formattedPasteMarkdown(text: string): string {
  return looksLikeDiagnosticPaste(text) ? plainTextAsMarkdown(text) : text;
}
