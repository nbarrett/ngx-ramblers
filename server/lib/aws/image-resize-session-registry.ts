import WebSocket from "ws";
import { ContentMetadataResizeRequest } from "../../../projects/ngx-ramblers/src/app/models/content-metadata.model";
import { ResizeImageMode } from "../../../projects/ngx-ramblers/src/app/models/integration-worker.model";
import { ProgressResponse } from "../../../projects/ngx-ramblers/src/app/models/websocket.model";

export interface ImageResizeSession {
  jobId: string;
  ws: WebSocket;
  mode: ResizeImageMode;
  resizeRequest: ContentMetadataResizeRequest;
  startedAt: number;
}

const activeResizeSessions = new Map<string, ImageResizeSession>();
const resizeQueueStates = new Map<string, ProgressResponse>();

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

export function resizeQueueState(contentMetadataId: string): ProgressResponse | undefined {
  return resizeQueueStates.get(contentMetadataId);
}

export function setResizeQueueState(contentMetadataId: string, state: ProgressResponse): void {
  resizeQueueStates.set(contentMetadataId, state);
}

export function clearResizeQueueState(contentMetadataId: string): void {
  resizeQueueStates.delete(contentMetadataId);
}
