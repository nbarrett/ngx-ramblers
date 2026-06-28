import { MessageType } from "./websocket.model";
import { RamblersUploadJob } from "./ramblers-upload-job.model";
import { RamblersUploadAudit } from "./ramblers-upload-audit.model";
import { SiteMigrationConfig } from "./migration-config.model";
import { MigrationResult } from "./migration-scraping.model";
import { ContentMetadata, ContentMetadataItem, ContentMetadataResizeRequest } from "./content-metadata.model";
import { ApiAction } from "./api-response.model";

export enum IntegrationWorkerEventType {
  STANDARD_OUT = "standard-out",
  TEST_STEP = "test-step",
  LIFECYCLE = "lifecycle",
  COMPLETE = "complete",
  ERROR = "error"
}

export interface RamblersUploadCredentials {
  userName: string;
  password: string;
}

export interface IntegrationWorkerAwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
}

export interface IntegrationWorkerReportUploadConfig {
  bucket: string;
  region: string;
  keyPrefix: string;
}

export interface IntegrationWorkerCallbackConfig {
  baseUrl: string;
  progressPath: string;
  resultPath: string;
}

export interface IntegrationWorkerJobRequest {
  job: RamblersUploadJob;
  encryptedCredentials: string;
  encryptedReportUploadCredentials?: string;
  reportUpload?: IntegrationWorkerReportUploadConfig;
  callback: IntegrationWorkerCallbackConfig;
}

export interface IntegrationWorkerJobResponse {
  jobId: string;
  queued: boolean;
  queuePosition: number;
  activeJobId: string | null;
}

export interface IntegrationWorkerProgressCallbackRequest {
  jobId: string;
  type: IntegrationWorkerEventType.STANDARD_OUT | IntegrationWorkerEventType.TEST_STEP | IntegrationWorkerEventType.LIFECYCLE;
  payload: string;
}

export interface IntegrationWorkerResultCallbackRequest {
  jobId: string;
  type: IntegrationWorkerEventType.COMPLETE | IntegrationWorkerEventType.ERROR;
  payload?: string;
  status?: string;
  reportKeyPrefix?: string;
  reportBucket?: string;
}

export interface IntegrationWorkerAuditEnvelope {
  messageType: MessageType;
  audits: RamblersUploadAudit[];
}

export interface IntegrationWorkerMigrationJobRequest {
  jobId: string;
  siteConfig: SiteMigrationConfig;
  persistData: boolean;
  uploadTos3: boolean;
  callback: IntegrationWorkerCallbackConfig;
}

export enum IntegrationWorkerLogLevel {
  Info = "info",
  Error = "error",
}

export enum IntegrationWorkerResultStatus {
  Success = "success",
  Error = "error",
}

export interface IntegrationWorkerMigrationProgressCallback {
  jobId: string;
  level: IntegrationWorkerLogLevel;
  message: string;
}

export interface IntegrationWorkerMigrationResultCallback {
  jobId: string;
  status: IntegrationWorkerResultStatus;
  result?: MigrationResult;
  errorMessage?: string;
}

export enum PlaywrightWaitUntil {
  Load = "load",
  DomContentLoaded = "domcontentloaded",
  NetworkIdle = "networkidle",
  Commit = "commit",
}

export interface HtmlFetchResult {
  html: string;
  finalUrl: string;
  baseHref: string | null;
}

export interface DocumentConversionWorkerRequest {
  fileName: string;
  fileBase64: string;
}

export interface ConvertedDocumentImage {
  name: string;
  base64: string;
}

export interface DocumentConversionWorkerResponse {
  markdown: string;
  suggestedTitle: string;
  images: ConvertedDocumentImage[];
}

export enum ResizeImageMode {
  SAVED = "saved",
  UNSAVED = "unsaved"
}

export interface IntegrationWorkerResizeAwsConfig {
  bucket: string;
  region: string;
}

export interface IntegrationWorkerResizeJobRequest {
  jobId: string;
  mode: ResizeImageMode;
  resizeRequest: ContentMetadataResizeRequest;
  sourceContentMetadata?: ContentMetadata;
  awsConfig?: IntegrationWorkerResizeAwsConfig;
  encryptedAwsCredentials?: string;
  callback: IntegrationWorkerCallbackConfig;
}

export interface IntegrationWorkerResizeProgressCallback {
  jobId: string;
  level: IntegrationWorkerLogLevel;
  message: string;
  percent: number;
  queued?: boolean;
}

export interface IntegrationWorkerResizeResultCallback {
  jobId: string;
  status: IntegrationWorkerResultStatus;
  action?: ApiAction;
  contentMetadata?: ContentMetadata;
  outputItems?: ContentMetadataItem[];
  errorMessage?: string;
}
