import { MessageType } from "./websocket.model";
import { RamblersUploadJob } from "./ramblers-upload-job.model";
import { RamblersUploadAudit } from "./ramblers-upload-audit.model";
import { SiteMigrationConfig } from "./migration-config.model";
import { MigrationResult } from "./migration-scraping.model";

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

export interface IntegrationWorkerMigrationProgressCallback {
  jobId: string;
  level: "info" | "error";
  message: string;
}

export interface IntegrationWorkerMigrationResultCallback {
  jobId: string;
  status: "success" | "error";
  result?: MigrationResult;
  errorMessage?: string;
}
