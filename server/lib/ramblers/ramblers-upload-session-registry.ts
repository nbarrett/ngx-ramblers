import WebSocket from "ws";
import { CurrentUploadSession } from "../../../projects/ngx-ramblers/src/app/models/ramblers-upload-audit.model";

const uploadSessions = new Map<string, CurrentUploadSession & { ws: WebSocket }>();
let activeUploadJobId: string | null = null;

export function registerRamblersUploadSession(jobId: string, fileName: string, ws: WebSocket): CurrentUploadSession {
  const session: CurrentUploadSession & { ws: WebSocket } = {
    jobId,
    fileName,
    record: 0,
    logStandardOut: true,
    ws
  };
  uploadSessions.set(jobId, session);
  if (!activeUploadJobId) {
    activeUploadJobId = jobId;
  }
  return session;
}

export function currentRamblersUploadSession(jobId?: string): (CurrentUploadSession & { ws: WebSocket }) | null {
  const selectedJobId = jobId || activeUploadJobId;
  return selectedJobId ? uploadSessions.get(selectedJobId) || null : null;
}

export function updateRamblersUploadSession(jobId: string, update: Partial<CurrentUploadSession>): (CurrentUploadSession & { ws: WebSocket }) | null {
  const current = uploadSessions.get(jobId);

  if (!current) {
    return null;
  }

  Object.assign(current, update);
  return current;
}

export function completeRamblersUploadSession(jobId: string): void {
  uploadSessions.delete(jobId);
  if (activeUploadJobId === jobId) {
    activeUploadJobId = null;
  }
}

export function activateRamblersUploadSession(jobId: string): void {
  if (uploadSessions.has(jobId)) {
    activeUploadJobId = jobId;
  }
}

export function activeRamblersUploadJobId(): string | null {
  return activeUploadJobId;
}
