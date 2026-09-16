export enum OsDataHubApiKeyJobStatus {
  QUEUED = "queued",
  COMPLETED = "completed",
  FAILED = "failed"
}

export interface OsDataHubApiKey {
  projectName: string;
  apiKey: string;
}

export interface OsDataHubApiKeyJobResult {
  jobId: string;
  projectName: string;
  status: OsDataHubApiKeyJobStatus;
  apiKey: string;
  error: string;
  createdAt: number;
  completedAt: number;
}

export const OS_DATA_HUB_API_KEY_MAX_WAIT_MS = 10 * 60 * 1000;
export const OS_DATA_HUB_API_KEY_POLL_MS = 5000;
