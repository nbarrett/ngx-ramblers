export const MEETUP_API_AVAILABLE = false;

export interface MeetupConfig {
  defaultContent: string;
  publishStatus: string;
  guestLimit: number;
  announce: boolean;
}

export enum MeetupStatus {
  PAST = "past",
  UPCOMING = "upcoming",
  DRAFT = "draft",
  PUBLISHED = "published",
  PROPOSED = "proposed",
  SUGGESTED = "suggested"
}

