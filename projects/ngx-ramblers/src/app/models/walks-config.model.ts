import { AccessLevel } from "./member-resource.model";

export enum WalkDetailsImageStyle {
  CROPPED = "cropped",
  NATURAL = "natural"
}

export enum WalkDetailsMapProvider {
  OS_MAPS = "os-maps",
  GOOGLE_MAPS = "google-maps"
}

export enum WalkAlbumPanelStyle {
  CARD = "card",
  MATCH_WALK_IMAGES = "match-walk-images"
}

export interface WalkViewPreviewGhost {
  label: string;
  height: number;
}

export const NO_REGULAR_WALK_DAY = 0;
export const DEFAULT_REGULAR_WALK_DAY = 7;

export interface WalksConfig {
  milesPerHour: number;
  mapZoomOutLevels?: number;
  requireRiskAssessment: boolean;
  requireFinishTime: boolean;
  requireWalkLeaderDisplayName: boolean;
  matchWalkLeadersOnWalksManagerSync?: boolean;
  rematchWalkLeadersOnMemberChange?: boolean;
  relatedLinkShowOnRamblers?: boolean;
  relatedLinkShowMeetup?: boolean;
  relatedLinkShowOsMaps?: boolean;
  relatedLinkShowWhat3words?: boolean;
  relatedLinkShowVenue?: boolean;
  relatedLinkShowGpx?: boolean;
  relatedLinkShowCalendar?: boolean;
  regularWalkDay?: number;
  walkCreationAccessLevel?: AccessLevel;
  hideAwaitingLeaderFromPublic?: boolean;
  hideNonApprovedWalksFromPublic?: boolean;
  walkDetailsImageStyle?: WalkDetailsImageStyle;
  walkDetailsImageHeight?: number;
  walkDetailsMapHeight?: number;
  walkDetailsMapProvider?: WalkDetailsMapProvider;
  walkAlbumPanelStyle?: WalkAlbumPanelStyle;
  walkAlbumPanelHeight?: number;
  allowCalendarDragToReschedule?: boolean;
  programmeOverviewDefaultWeeks?: number;
  calendarDefaultColourBy?: CalendarColourBy;
}

export enum CalendarColourBy {
  STATUS = "status",
  GRADE = "grade",
  LEADER = "leader"
}

export enum WalkConfigTab {
  GENERAL = "General",
  MEETUP = "Meetup",
  WALK_VIEW = "Walk View",
}
