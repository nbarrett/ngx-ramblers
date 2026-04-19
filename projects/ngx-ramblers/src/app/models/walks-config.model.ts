export interface WalksConfig {
  milesPerHour: number;
  requireRiskAssessment: boolean;
  requireFinishTime: boolean;
  requireWalkLeaderDisplayName: boolean;
  showRepeatedPagination?: boolean;
}

export enum WalkConfigTab {
  GENERAL = "General",
  MEETUP = "Meetup",
  PUBLISHING_DEFAULTS = "Publishing Defaults",
}
