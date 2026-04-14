import { Status } from "./ramblers-upload-audit.model";
import { WalkCancellation, WalkUploadInfo, WalkUploadRow } from "./ramblers-walks-manager";

export enum RamblersUploadJobState {
  QUEUED = "queued",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled"
}

export interface RamblersUploadJobData {
  fileName: string;
  walkIdDeletionList: string[];
  walkIdUploadList: WalkUploadInfo[];
  walkCancellations: WalkCancellation[];
  walkUncancellations: string[];
  headings: string[];
  rows: WalkUploadRow[];
  ramblersUser: string;
  feature: string;
}

export interface RamblersUploadJob {
  jobId: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  queuePosition?: number;
  state: RamblersUploadJobState;
  data: RamblersUploadJobData;
}

export interface RamblersUploadQueueNotice {
  jobId: string;
  fileName: string;
  queuePosition: number;
  status: Status;
  message: string;
}
