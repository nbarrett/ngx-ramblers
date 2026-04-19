export interface WalksConfig {
  milesPerHour: number;
  requireRiskAssessment: boolean;
  requireFinishTime: boolean;
  requireWalkLeaderDisplayName: boolean;
  showRepeatedPagination?: boolean;
  relatedLinkShowOnRamblers?: boolean;
  relatedLinkShowThisWalk?: boolean;
  relatedLinkShowMeetup?: boolean;
  relatedLinkShowOsMaps?: boolean;
  relatedLinkShowWhat3words?: boolean;
  relatedLinkShowVenue?: boolean;
}

export enum WalkConfigTab {
  GENERAL = "General",
  MEETUP = "Meetup",
  PUBLISHING_DEFAULTS = "Publishing Defaults",
  WALK_VIEW = "Walk View",
}
