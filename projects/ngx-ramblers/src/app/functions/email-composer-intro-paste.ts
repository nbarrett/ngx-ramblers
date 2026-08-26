import { plainText } from "./strings";

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

export function subjectStillDefault(existingSubject: string, defaultConfigSubject: string): boolean {
  return !existingSubject?.trim() || existingSubject.trim() === (defaultConfigSubject ?? "").trim();
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
