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
  queued?: boolean;
  completed?: number;
  total?: number;
}

export interface RamblersUploadAuditProgressResponse {
  audits: RamblersUploadAudit[];
}

export enum EventType {
  BACKUP_EVENTS = "backup-events",
  BACKUP_RESTORE = "backup-restore",
  CONTENT_MIGRATION_CANCEL = "content-migration-cancel",
  CONTENT_MIGRATION_EXECUTE = "content-migration-execute",
  CONTENT_MIGRATION_SCAN = "content-migration-scan",
  CONTENT_MIGRATION_SCAN_HOSTS = "content-migration-scan-hosts",
  ENVIRONMENT_CREATE = "environment-create",
  ENVIRONMENT_SETUP = "environment-setup",
  ESRI_ROUTE_IMPORT = "esri-route-import",
  EXTERNAL_ALBUM_FETCH = "external-album-fetch",
  EXTERNAL_ALBUM_IMPORT = "external-album-import",
  EXTERNAL_ALBUM_SPLIT_PREVIEW = "external-album-split-preview",
  EXTERNAL_BULK_ALBUM_IMPORT = "external-bulk-album-import",
  EXTERNAL_USER_ALBUMS_FETCH = "external-user-albums-fetch",
  LEGACY_URL_SCRAPE = "legacy-url-scrape",
  PING = "ping",
  RAMBLERS_WALKS_UPLOAD = "ramblers-walks-upload",
  RAMBLERS_WALKS_UPLOAD_CANCEL = "ramblers-walks-upload-cancel",
  RESIZE_SAVED_IMAGES = "resize-saved-images",
  RESIZE_UNSAVED_IMAGES = "resize-unsaved-images",
  SCHEDULED_TASK_EVENTS = "scheduled-task-events",
  SITE_MIGRATION = "site-migration",
  SOCIAL_PUBLISH_ALBUM = "social-publish-album",
  WALKS_MANAGER_SYNC = "walks-manager-sync",
}

export enum MessageType {
  BACKUP_MANIFEST_CREATED = "backup-manifest-created",
  BACKUP_MANIFEST_DELETED = "backup-manifest-deleted",
  BACKUP_SESSION_UPDATED = "backup-session-updated",
  CANCELLED = "cancelled",
  COMPLETE = "complete",
  CONFIG_UPDATED = "config-updated",
  ERROR = "error",
  INBOX_NEW_MESSAGE = "inbox-new-message",
  INBOX_THREAD_UPDATED = "inbox-thread-updated",
  MEMBER_BULK_DELETE_PROGRESS = "member-bulk-delete-progress",
  MEMBER_SYNC_PROGRESS = "member-sync-progress",
  PROGRESS = "progress",
  SCHEDULED_TASK_UPDATED = "scheduled-task-updated",
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
