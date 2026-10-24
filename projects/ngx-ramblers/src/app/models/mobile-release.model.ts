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
  relationships?: {
    betaGroups?: {
      data: {id: string}[];
    };
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

export enum AppleExternalBuildState {
  READY_FOR_BETA_SUBMISSION = "READY_FOR_BETA_SUBMISSION",
  WAITING_FOR_BETA_REVIEW = "WAITING_FOR_BETA_REVIEW",
  IN_BETA_REVIEW = "IN_BETA_REVIEW",
  BETA_REJECTED = "BETA_REJECTED",
  BETA_APPROVED = "BETA_APPROVED",
  READY_FOR_BETA_TESTING = "READY_FOR_BETA_TESTING",
  IN_BETA_TESTING = "IN_BETA_TESTING",
  EXPIRED = "EXPIRED"
}

export enum ApplePilotRequestMethod {
  GET = "GET",
  PATCH = "PATCH",
  POST = "POST"
}

export interface AppleBuildBetaDetailResponse {
  data: {
    id: string;
    attributes: {
      autoNotifyEnabled: boolean;
      externalBuildState: AppleExternalBuildState;
    };
  };
}

export interface ApplePilotGroupResponse {
  data: {
    attributes: {isInternalGroup: boolean};
    relationships: {app: {data: {id: string}}};
  };
}
