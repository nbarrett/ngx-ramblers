export enum AppleBuildProcessingState {
  FAILED = "FAILED",
  INVALID = "INVALID",
  PROCESSING = "PROCESSING",
  VALID = "VALID"
}

export enum AppleAppStoreState {
  DEVELOPER_REJECTED = "DEVELOPER_REJECTED",
  IN_REVIEW = "IN_REVIEW",
  PREPARE_FOR_SUBMISSION = "PREPARE_FOR_SUBMISSION",
  READY_FOR_REVIEW = "READY_FOR_REVIEW",
  READY_FOR_SALE = "READY_FOR_SALE",
  REJECTED = "REJECTED",
  WAITING_FOR_REVIEW = "WAITING_FOR_REVIEW"
}

export enum ApplePlatform {
  IOS = "IOS"
}

export enum AppleReleaseType {
  AFTER_APPROVAL = "AFTER_APPROVAL"
}

export enum AppleRequestMethod {
  GET = "GET",
  PATCH = "PATCH",
  POST = "POST"
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

export interface AppleAppStoreVersion {
  id: string;
  attributes: {
    versionString: string;
    appStoreState: AppleAppStoreState;
  };
}

export interface AppleAppStoreVersionResponse {
  data: AppleAppStoreVersion[];
}

export interface AppleAppStoreVersionCreateResponse {
  data: AppleAppStoreVersion;
}

export interface AppleReviewSubmission {
  id: string;
  attributes: {
    state?: string;
    submitted?: boolean;
  };
}

export interface AppleReviewSubmissionResponse {
  data: AppleReviewSubmission;
}

export interface AppleStoreReleaseConfiguration {
  appId: string;
  buildNumber: string;
  versionString: string;
  keyId: string;
  issuerId: string;
  privateKey: string;
}
