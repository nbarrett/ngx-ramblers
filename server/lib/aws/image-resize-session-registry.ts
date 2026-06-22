import WebSocket from "ws";
import { ContentMetadataResizeRequest } from "../../../projects/ngx-ramblers/src/app/models/content-metadata.model";
import { ResizeImageMode } from "../../../projects/ngx-ramblers/src/app/models/integration-worker.model";

export interface ImageResizeSession {
  jobId: string;
  ws: WebSocket;
  mode: ResizeImageMode;
  resizeRequest: ContentMetadataResizeRequest;
  startedAt: number;
}

const activeResizeSessions = new Map<string, ImageResizeSession>();

export function registerResizeSession(session: ImageResizeSession): void {
  activeResizeSessions.set(session.jobId, session);
}

export function currentResizeSession(jobId: string | undefined): ImageResizeSession | undefined {
  if (!jobId) {
    return undefined;
  }
  return activeResizeSessions.get(jobId);
}

export function completeResizeSession(jobId: string): void {
  activeResizeSessions.delete(jobId);
}
