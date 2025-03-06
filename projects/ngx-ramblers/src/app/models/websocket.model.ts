import WebSocket from "ws";

export interface WebSocketRequest {
  type: EventType;
  data: any;
}

export type MessageHandlers = { [key in EventType]: (ws: WebSocket, data: any) => void };

export interface ProgressResponse {
  message: string;
  percent?: number;
}

export enum EventType {
  RESIZE_SAVED_IMAGES = "resize-saved-images",
  RESIZE_UNSAVED_IMAGES = "resize-unsaved-images",
}

export enum MessageType {
  COMPLETE = "complete",
  PROGRESS = "progress",
  ERROR = "error",
}

