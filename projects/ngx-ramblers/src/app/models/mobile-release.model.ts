export enum AppleBuildProcessingState {
  FAILED = "FAILED",
  INVALID = "INVALID",
  PROCESSING = "PROCESSING",
  VALID = "VALID"
}

export interface AppleReleaseBuild {
  id: string;
  attributes: {
    version: string;
    processingState: AppleBuildProcessingState;
  };
}

export interface AppleReleaseBuildResponse {
  data: AppleReleaseBuild[];
}

export interface ApplePilotReleaseConfiguration {
  appId: string;
  groupId: string;
  buildNumber: string;
  keyId: string;
  issuerId: string;
  privateKey: string;
}
