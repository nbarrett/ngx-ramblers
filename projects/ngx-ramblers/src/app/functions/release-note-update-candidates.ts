import { DateTime } from "luxon";
import { UIDateFormat } from "../models/date-format.model";
import { ReleaseNoteUpdateCandidate } from "../models/ai.model";

const DATED_SLUG = /^(\d{4}-\d{2}-\d{2})/;

export function lastPathSegment(path: string): string {
  const parts = (path || "").replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] || "";
}

export function releaseNoteDateFromPath(path: string): number | null {
  const match = lastPathSegment(path).match(DATED_SLUG);
  const parsed = match ? DateTime.fromFormat(match[1], UIDateFormat.YEAR_MONTH_DAY_WITH_DASHES) : null;
  return parsed?.isValid ? parsed.startOf("day").toMillis() : null;
}

export function releaseNoteInWindow(dateMillis: number | null, fromMillis: number, toMillis: number): boolean {
  return dateMillis !== null && dateMillis >= fromMillis && dateMillis <= toMillis;
}

export function selectReleaseNoteUpdateCandidates(candidates: ReleaseNoteUpdateCandidate[],
                                               fromMillis: number,
                                               toMillis: number,
                                               previouslyIncludedPaths: string[] | null): ReleaseNoteUpdateCandidate[] {
  const excluded = new Set(previouslyIncludedPaths ?? []);
  return (candidates ?? []).filter(candidate => {
    const alreadyIncluded = excluded.has(candidate.path);
    const inWindow = releaseNoteInWindow(candidate.dateMillis, fromMillis, toMillis);
    return !alreadyIncluded && inWindow;
  });
}

export function isUnassignedCommitDump(path: string): boolean {
  return /(?:^|-)other$/.test(lastPathSegment(path));
}

export function isIssueReleaseNote(path: string): boolean {
  return /-issue-\d+/.test(lastPathSegment(path));
}

export function hasWhatsNewHeading(markdown: string): boolean {
  return /##\s*What['’]s new\b/i.test(markdown || "");
}

export function isCuratedReleaseNote(path: string, markdown: string, hasImages: boolean): boolean {
  if (isUnassignedCommitDump(path)) {
    return false;
  } else if (hasImages || isIssueReleaseNote(path) || hasWhatsNewHeading(markdown)) {
    return true;
  } else {
    return false;
  }
}
