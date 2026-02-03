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
  SITE_MIGRATION = "site-migration",
  RESIZE_SAVED_IMAGES = "resize-saved-images",
  RESIZE_UNSAVED_IMAGES = "resize-unsaved-images",
  TEST_STEP_REPORTER = "test-step-reporter",
  BACKUP_RESTORE = "backup-restore",
  ESRI_ROUTE_IMPORT = "esri-route-import",
  WALKS_MANAGER_SYNC = "walks-manager-sync",
  IMAGE_MIGRATION_SCAN_HOSTS = "image-migration-scan-hosts",
  IMAGE_MIGRATION_SCAN = "image-migration-scan",
  IMAGE_MIGRATION_EXECUTE = "image-migration-execute",
  IMAGE_MIGRATION_CANCEL = "image-migration-cancel",
  ENVIRONMENT_SETUP = "environment-setup",
  ENVIRONMENT_CREATE = "environment-create",
  EXTERNAL_ALBUM_FETCH = "external-album-fetch",
  EXTERNAL_ALBUM_IMPORT = "external-album-import",
  EXTERNAL_ALBUM_SPLIT_PREVIEW = "external-album-split-preview",
  EXTERNAL_USER_ALBUMS_FETCH = "external-user-albums-fetch",
  EXTERNAL_BULK_ALBUM_IMPORT = "external-bulk-album-import",
  PING = "ping",
}

export enum MessageType {
  COMPLETE = "complete",
  PROGRESS = "progress",
  ERROR = "error",
  CANCELLED = "cancelled",
}

export const allowableStatusCodes: number[] = [1000, 1005];

export interface MappedCloseMessage {
  message: string;
  code: number;
  success: boolean;
  transient?: boolean;
}

export interface WebSocketInstance {
  instance: WebSocket;
}
