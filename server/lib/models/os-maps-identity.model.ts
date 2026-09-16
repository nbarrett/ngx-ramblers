export enum OsMapsLoginSubmitOutcome {
  LEFT_IDENTITY = "left-identity",
  SUBMITTED = "submitted",
  IGNORED = "ignored"
}

export interface OsMapsSweepSelectors {
  cookieAccept: string;
  marketingDismissPattern: string;
  overlayIds: string[];
  overlaySelectors: string;
  suppressionStyleId: string;
  suppressionStyle: string;
}

export enum OsServiceHost {
  OS_MAPS = "explore.osmaps.com",
  OS_DATA_HUB = "osdatahub.os.uk"
}
