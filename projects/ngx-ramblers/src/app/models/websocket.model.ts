import WebSocket from "ws";
import { RamblersUploadAudit } from "./ramblers-upload-audit.model";

export interface WebSocketRequest {
  type: EventType;
  data: any;
}

export type MessageHandlers = { [key in EventType]: (ws: WebSocket, data: any) => void };

export interface ProgressResponse {
  message: string;
  percent?: number;
}

export interface RamblersUploadAuditProgressResponse {
  audits: RamblersUploadAudit[];
}

export enum EventType {
  RAMBLERS_WALKS_UPLOAD = "ramblers-walks-upload",
  RESIZE_SAVED_IMAGES = "resize-saved-images",
  RESIZE_UNSAVED_IMAGES = "resize-unsaved-images",
  TEST_STEP_REPORTER = "test-step-reporter",
}

export enum MessageType {
  COMPLETE = "complete",
  PROGRESS = "progress",
  ERROR = "error",
}

export const allowableStatusCodes: number[] = [1000, 1005];

export interface MappedCloseMessage {
  message: string;
  code: number;
  success: boolean;
}

export interface WebSocketInstance {
  instance: WebSocket;
}
