export enum PhotoAttemptOutcome {
  PHOTOGRAPHED = "photographed",
  NO_PAGE_TO_PHOTOGRAPH_YET = "noPageToPhotographYet"
}

export interface PhotoAttempt {
  outcome: PhotoAttemptOutcome;
  screenshot?: string;
  lastError?: string;
}
