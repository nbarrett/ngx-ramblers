import { DocumentConversionResponse } from "../../../projects/ngx-ramblers/src/app/models/committee.model";

const BOILERPLATE_PATTERNS: RegExp[] = [
  /registered charity/i,
  /1093577|SC039799|4458492/,
  /company limited by guarantee/i,
  /ramblers'?\s+(and\s+)?association/i,
  /registered office/i,
  /^-+\s*\d+\s*of\s*\d+\s*-+$/,
  /^page\s+\d+\s+of\s+\d+$/i
];

const SECTION_HEADING_MAX_LENGTH = 80;

export function dropDataUriImages(markdown: string): string {
  return markdown.replace(/!\[[^\]]*\]\(data:[^)]*\)/g, "");
}

export function rejoinBoldAcrossLineBreaks(markdown: string): string {
  return markdown.replace(/\*\*([^*\n]+?)[ \t]*\n[ \t]*\*\*(?=\s|$)/g, "**$1**");
}

export function normaliseEmphasisSpacing(markdown: string): string {
  return markdown.replace(/\*\*([ \t]*)([^*\n]*?)([ \t]*)\*\*/g, (match, lead, content, trail) =>
    content.trim().length > 0 ? `${lead}**${content}**${trail}` : `${lead}${trail}`);
}

function midPhraseBoundary(first: string, second: string): boolean {
  return /[&,;:\-]$/.test(first.trim()) || /^[a-z0-9£$(]/.test(second.trim());
}

export function mergeAdjacentEmphasis(markdown: string): string {
  const merged = markdown
    .replace(/\*\*\*\*/g, "")
    .replace(/\*\*([^*\n]+)\*\*([ \t]+)\*\*([^*\n]+)\*\*/g, (match, first, spacing, second) =>
      midPhraseBoundary(first, second) ? `**${first}${spacing}${second}**` : match)
    .replace(/^[ \t]+(?=\*\*)/gm, "");
  if (merged === markdown) {
    return merged;
  } else {
    return mergeAdjacentEmphasis(merged);
  }
}

export function splitAdjacentBoldRunLines(markdown: string): string {
  return markdown
    .split("\n")
    .map(line => {
      const trimmed = line.trim();
      const boldRunsOnly = /^(\*\*[^*\n]+\*\*)([ \t]+\*\*[^*\n]+\*\*)+$/.test(trimmed);
      return boldRunsOnly ? trimmed.split(/(?<=\*\*)[ \t]+(?=\*\*)/).join("\n\n") : line;
    })
    .join("\n");
}

export function promoteLeadingBoldLineToHeading(markdown: string): string {
  const lines = markdown.split("\n");
  const firstContentIndex = lines.findIndex(line => line.trim().length > 0);
  const firstContent = firstContentIndex >= 0 ? lines[firstContentIndex].trim() : "";
  const boldOnly = firstContent.match(/^\*\*([^*\n]+)\*\*$/);
  if (boldOnly && !firstContent.startsWith("#")) {
    return [...lines.slice(0, firstContentIndex), `# ${boldOnly[1].trim()}`, ...lines.slice(firstContentIndex + 1)].join("\n");
  } else {
    return markdown;
  }
}

export function promoteSectionBoldLinesToHeadings(markdown: string): string {
  return markdown
    .split("\n")
    .map(line => {
      const trimmed = line.trim();
      const boldOnly = trimmed.match(/^\*\*([^*\n]+)\*\*$/);
      const content = boldOnly ? boldOnly[1].trim() : "";
      const headingCandidate = content.length > 0
        && content.length <= SECTION_HEADING_MAX_LENGTH
        && !content.includes(":");
      return headingCandidate ? `## ${content}` : line;
    })
    .join("\n");
}

function isTableRow(line: string): boolean {
  return line.startsWith("|") && line.split("|").length - 1 >= 3;
}

function isContactLine(line: string): boolean {
  return !isTableRow(line) && line.includes("|") && /(@|www\.|https?:|\.co\.uk|\.org\.uk|\.com\b)/i.test(line);
}

export function stripBoilerplate(markdown: string): string {
  return markdown
    .split("\n")
    .filter(line => {
      const trimmed = line.trim();
      const boilerplate = BOILERPLATE_PATTERNS.some(pattern => pattern.test(trimmed)) || isContactLine(trimmed);
      return !boilerplate;
    })
    .join("\n");
}

export function collapseBlankLines(markdown: string): string {
  return markdown.replace(/\n{3,}/g, "\n\n").trim();
}

export function suggestedTitleFrom(markdown: string): string {
  const lines = markdown.split("\n").map(line => line.trim()).filter(line => line.length > 0);
  const heading = lines.find(line => /^#{1,6}\s+/.test(line));
  const candidate = heading ? heading.replace(/^#{1,6}\s+/, "") : (lines[0] || "");
  return candidate.replace(/\*\*/g, "").replace(/[*_`]/g, "").trim().slice(0, 120);
}

export function stripRepeatedPageFurniture(text: string, pageCount: number): string {
  if (pageCount < 2) {
    return text;
  }
  const lines = text.split("\n");
  const occurrences = lines.reduce((counts, line) => {
    const trimmed = line.trim();
    if (trimmed.length > 0 && trimmed.length <= 60 && !/[.!?]$/.test(trimmed)) {
      counts.set(trimmed, (counts.get(trimmed) || 0) + 1);
    }
    return counts;
  }, new Map<string, number>());
  const threshold = Math.max(2, Math.ceil(pageCount * 0.6));
  return lines
    .filter(line => (occurrences.get(line.trim()) || 0) < threshold)
    .join("\n");
}

function startsNewBlock(line: string): boolean {
  return /^([-*•]\s|\d+[.)]\s|#{1,6}\s|>\s|\||!\[)/.test(line);
}

const WRAPPED_LINE_MIN_LENGTH = 60;

function shouldJoinToPrevious(previous: string, line: string): boolean {
  const previousComplete = /[.!?:;)]$/.test(previous) || /^#/.test(previous);
  const previousIsListItem = startsNewBlock(previous);
  const lowercaseContinuation = /^[a-z0-9£$(]/.test(line);
  const wrappedContinuation = lowercaseContinuation || previous.length >= WRAPPED_LINE_MIN_LENGTH;
  return !previousComplete && !startsNewBlock(line) && (previousIsListItem ? lowercaseContinuation : wrappedContinuation);
}

export function joinWrappedLines(text: string): string {
  const paragraphs = text.split("\n").reduce((accumulated: string[], rawLine) => {
    const line = rawLine.replace(/\t/g, " ").replace(/ {2,}/g, " ").trim().replace(/^[•▪◦‣·-]\s*/, "- ");
    const previous = accumulated.length > 0 ? accumulated[accumulated.length - 1] : "";
    if (line.length === 0) {
      return accumulated;
    } else if (previous !== "" && shouldJoinToPrevious(previous, line)) {
      return [...accumulated.slice(0, -1), `${previous} ${line}`];
    } else {
      return [...accumulated, line];
    }
  }, []);
  return paragraphs.join("\n\n");
}

export function promotePdfSectionHeadings(markdown: string): string {
  return markdown
    .split("\n")
    .map(line => {
      const trimmed = line.trim();
      const headingCandidate = trimmed.length > 0
        && trimmed.length <= SECTION_HEADING_MAX_LENGTH
        && /^[A-Z]/.test(trimmed)
        && /\s[—–]\s/.test(trimmed)
        && !/[.!?:;,)"']$/.test(trimmed)
        && !startsNewBlock(trimmed);
      return headingCandidate ? `## ${trimmed}` : line;
    })
    .join("\n");
}

const MINUTES_HEADINGS: string[] = [
  "agenda",
  "any other business",
  "aob",
  "apologies",
  "apologies for absence",
  "attendees",
  "chairman highlights",
  "draft minutes",
  "election of officers",
  "final minutes",
  "matters arising",
  "meeting notes",
  "membership",
  "open forum",
  "treasurer",
  "website"
];

const MINUTES_HEADING_PREFIXES: RegExp[] = [
  /^previous actions\b/i,
  /^next meeting\b/i
];

function isMinutesHeading(line: string): boolean {
  const normalised = line.toLowerCase();
  return line.length <= 40
    && (MINUTES_HEADINGS.includes(normalised) || MINUTES_HEADING_PREFIXES.some(pattern => pattern.test(normalised)));
}

export function promoteMinutesHeadings(markdown: string): string {
  return markdown
    .split("\n")
    .map(line => isMinutesHeading(line.trim()) ? `## ${line.trim()}` : line)
    .join("\n");
}

export function boldLabelLines(markdown: string): string {
  return markdown
    .split("\n")
    .map(line => {
      const label = line.trim().match(/^([A-Z][A-Za-z][A-Za-z' ]{0,18}):\s+(.+)$/);
      return label ? `**${label[1]}:** ${label[2]}` : line;
    })
    .join("\n");
}

export function promotePdfLeadingTitle(markdown: string): string {
  const lines = markdown.split("\n");
  const firstContentIndex = lines.findIndex(line => line.trim().length > 0);
  const firstContent = firstContentIndex >= 0 ? lines[firstContentIndex].trim() : "";
  const titleCandidate = firstContent.length > 0
    && firstContent.length <= SECTION_HEADING_MAX_LENGTH
    && !firstContent.startsWith("#")
    && !firstContent.includes(":")
    && !startsNewBlock(firstContent);
  if (titleCandidate) {
    return [...lines.slice(0, firstContentIndex), `# ${firstContent}`, ...lines.slice(firstContentIndex + 1)].join("\n");
  } else {
    return markdown;
  }
}

export function pdfTextToMarkdown(text: string, pageCount: number): string {
  return joinWrappedLines(
    boldLabelLines(
      promotePdfSectionHeadings(
        promoteMinutesHeadings(
          stripRepeatedPageFurniture(text || "", pageCount)))));
}

export function postProcessConvertedMarkdown(markdown: string): DocumentConversionResponse {
  const processed = collapseBlankLines(
    stripBoilerplate(
      promoteSectionBoldLinesToHeadings(
        promoteLeadingBoldLineToHeading(
          splitAdjacentBoldRunLines(
            mergeAdjacentEmphasis(
              normaliseEmphasisSpacing(
                rejoinBoldAcrossLineBreaks(
                  dropDataUriImages(markdown || "")))))))));
  return {markdown: processed, suggestedTitle: suggestedTitleFrom(processed)};
}
