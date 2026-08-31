import { toKebabCase } from "./strings";
import { CommitteeDocumentsPageChoice, PageContent, PageContentRow, PageContentType } from "../models/content-text.model";

export const COMMITTEE_DOCUMENTS_YEAR_PATH_PATTERN = "^committee/[^/]+$";

export function committeeDocumentSlug(title: string, eventDateLabel: string): string {
  return toKebabCase(title, eventDateLabel).replace(/(\d)-(st|nd|rd|th)(?=-|$)/g, "$1$2");
}

export function meetingMinutesDocumentSlug(room: string): string {
  return toKebabCase(room || "");
}

export function committeeDocumentsYearPath(year: string): string {
  return `committee/${year}`;
}

export function committeeDocumentsRow(page: PageContent | null): PageContentRow | null {
  return (page?.rows || []).find(row => row.type === PageContentType.COMMITTEE_DOCUMENTS) || null;
}

export function committeeDocumentsPageLabel(page: PageContent): string {
  const titled = committeeDocumentsRow(page)?.committeeDocuments?.pageTitle?.trim();
  if (titled) {
    return titled;
  } else {
    return (page.path || "").replace(/\//g, " / ") || "Committee documents";
  }
}

export function preferredCommitteeDocumentsPagePath(
  pages: CommitteeDocumentsPageChoice[],
  yearPath: string,
  currentPath: string | null
): string | null {
  const current = pages.find(page => page.path === currentPath);
  const yearMatch = pages.find(page => page.path === yearPath);
  if (current) {
    return current.path;
  } else if (yearMatch) {
    return yearMatch.path;
  } else {
    return pages[0]?.path || null;
  }
}

export function addCommitteeFileIdToPage(page: PageContent, fileId: string): boolean {
  const row = committeeDocumentsRow(page);
  if (!row?.committeeDocuments || !fileId) {
    return false;
  } else {
    const ids = row.committeeDocuments.fileIds || [];
    if (ids.includes(fileId)) {
      return false;
    } else {
      row.committeeDocuments.fileIds = [...ids, fileId];
      return true;
    }
  }
}
