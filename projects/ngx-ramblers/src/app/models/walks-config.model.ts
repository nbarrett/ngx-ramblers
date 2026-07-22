import { AccessLevel } from "./member-resource.model";

export enum WalkDetailsImageStyle {
  CROPPED = "cropped",
  NATURAL = "natural"
}

export enum WalkDetailsMapProvider {
  OS_MAPS = "os-maps",
  GOOGLE_MAPS = "google-maps"
}

export interface WalkViewPreviewGhost {
  label: string;
  height: number;
}

export interface WalksConfig {
  milesPerHour: number;
  mapZoomOutLevels?: number;
  requireRiskAssessment: boolean;
  requireFinishTime: boolean;
  requireWalkLeaderDisplayName: boolean;
  matchWalkLeadersOnWalksManagerSync?: boolean;
  rematchWalkLeadersOnMemberChange?: boolean;
  showRepeatedPagination?: boolean;
  relatedLinkShowOnRamblers?: boolean;
  relatedLinkShowThisWalk?: boolean;
  relatedLinkShowMeetup?: boolean;
  relatedLinkShowOsMaps?: boolean;
  relatedLinkShowWhat3words?: boolean;
  relatedLinkShowVenue?: boolean;
  relatedLinkShowGpx?: boolean;
  regularWalkDay?: number;
  walkCreationAccessLevel?: AccessLevel;
  hideAwaitingLeaderFromPublic?: boolean;
  hideNonApprovedWalksFromPublic?: boolean;
  walkDetailsImageStyle?: WalkDetailsImageStyle;
  walkDetailsImageHeight?: number;
  walkDetailsMapHeight?: number;
  walkDetailsMapProvider?: WalkDetailsMapProvider;
}

export enum WalkConfigTab {
  GENERAL = "General",
  MEETUP = "Meetup",
  WALK_VIEW = "Walk View",
}
