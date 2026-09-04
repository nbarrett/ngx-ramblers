import { AccessLevel } from "./member-resource.model";

export enum WalkDetailsImageStyle {
  CROPPED = "cropped",
  NATURAL = "natural"
}

export enum GridReferenceDigits {
  SIX = 6,
  EIGHT = 8,
  TEN = 10
}

export const GRID_REFERENCE_DIGIT_OPTIONS: {value: GridReferenceDigits; label: string}[] = [
  {value: GridReferenceDigits.SIX, label: "6 figures, to 100 metres (TR 086 170)"},
  {value: GridReferenceDigits.EIGHT, label: "8 figures, to 10 metres (TR 0862 1703)"},
  {value: GridReferenceDigits.TEN, label: "10 figures, to 1 metre, as Ramblers shares it (TR 08624 17039)"}
];
export const DEFAULT_GRID_REFERENCE_DIGITS = GridReferenceDigits.TEN;

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

export const RISK_ASSESSMENT_CONTENT_CATEGORY = "risk-assessments";
export const RISK_ASSESSMENT_HEADING_NAME = "risk-assessments-heading";

export interface WalkRiskAssessmentSection {
  key: string;
  title: string;
}

export const DEFAULT_WALK_RISK_ASSESSMENT_SECTIONS: WalkRiskAssessmentSection[] = [
  {key: "traffic", title: "Traffic"},
  {key: "path-surface-and-obstacles", title: "Path surface and obstacles"},
  {key: "animals", title: "Animals"},
  {key: "communications", title: "Communications"},
  {key: "other", title: "Other"}
];

export function riskAssessmentContentName(key: string): string {
  return `${RISK_ASSESSMENT_CONTENT_CATEGORY}-${key}`;
}

export interface WalksConfig {
  milesPerHour: number;
  mapZoomOutLevels?: number;
  requireRiskAssessment: boolean;
  riskAssessmentSections?: WalkRiskAssessmentSection[];
  requireFinishTime: boolean;
  requireWalkLeaderDisplayName: boolean;
  matchWalkLeadersOnWalksManagerSync?: boolean;
  rematchWalkLeadersOnMemberChange?: boolean;
  relatedLinkShowOnRamblers?: boolean;
  relatedLinkShowMeetup?: boolean;
  relatedLinkShowOsMaps?: boolean;
  relatedLinkShowWhat3words?: boolean;
  relatedLinkShowDirections?: boolean;
  relatedLinkShowVenue?: boolean;
  relatedLinkShowGpx?: boolean;
  relatedLinkShowCalendar?: boolean;
  regularWalkDay?: number;
  walkCreationAccessLevel?: AccessLevel;
  hideAwaitingLeaderFromPublic?: boolean;
  hideNonApprovedWalksFromPublic?: boolean;
  walkDetailsShowPostcode?: boolean;
  walkDetailsShowGridReference?: boolean;
  walkDetailsGridReferenceDigits?: GridReferenceDigits;
  walkDetailsGridReferenceSpaced?: boolean;
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
  RISK_ASSESSMENT = "Risk Assessment",
  MEETUP = "Meetup",
  WALK_VIEW = "Walk View",
}
