import { IntegrationWorkerWalksManagerSyncProgressCallback, IntegrationWorkerWalksManagerSyncResultCallback } from "../../../projects/ngx-ramblers/src/app/models/integration-worker.model";

export interface WalksManagerSyncSession {
  jobId: string;
  onProgress: (body: IntegrationWorkerWalksManagerSyncProgressCallback) => void;
  onResult: (body: IntegrationWorkerWalksManagerSyncResultCallback) => void;
}

const sessions = new Map<string, WalksManagerSyncSession>();

export function registerWalksManagerSyncSession(session: WalksManagerSyncSession): void {
  sessions.set(session.jobId, session);
}

export function walksManagerSyncSession(jobId: string): WalksManagerSyncSession | null {
  return sessions.get(jobId) || null;
}

export function completeWalksManagerSyncSession(jobId: string): void {
  sessions.delete(jobId);
}
