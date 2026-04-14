import { MessageType } from "./websocket.model";
import { RamblersUploadJob } from "./ramblers-upload-job.model";
import { RamblersUploadAudit } from "./ramblers-upload-audit.model";

export enum RamblersUploadWorkerEventType {
  STANDARD_OUT = "standard-out",
  TEST_STEP = "test-step",
  COMPLETE = "complete",
  ERROR = "error"
}

export interface RamblersUploadCredentials {
  userName: string;
  password: string;
}

export interface RamblersUploadWorkerAwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
}

export interface RamblersUploadWorkerReportUploadConfig {
  bucket: string;
  region: string;
  keyPrefix: string;
}

export interface RamblersUploadWorkerCallbackConfig {
  baseUrl: string;
  progressPath: string;
  resultPath: string;
}

export interface RamblersUploadWorkerJobRequest {
  job: RamblersUploadJob;
  encryptedCredentials: string;
  encryptedReportUploadCredentials?: string;
  reportUpload?: RamblersUploadWorkerReportUploadConfig;
  callback: RamblersUploadWorkerCallbackConfig;
}

export interface RamblersUploadWorkerJobResponse {
  jobId: string;
  queued: boolean;
  queuePosition: number;
  activeJobId: string | null;
}

export interface RamblersUploadWorkerProgressCallbackRequest {
  jobId: string;
  type: RamblersUploadWorkerEventType.STANDARD_OUT | RamblersUploadWorkerEventType.TEST_STEP;
  payload: string;
}

export interface RamblersUploadWorkerResultCallbackRequest {
  jobId: string;
  type: RamblersUploadWorkerEventType.COMPLETE | RamblersUploadWorkerEventType.ERROR;
  payload?: string;
  status?: string;
  reportKeyPrefix?: string;
  reportBucket?: string;
}

export interface RamblersUploadWorkerAuditEnvelope {
  messageType: MessageType;
  audits: RamblersUploadAudit[];
}
