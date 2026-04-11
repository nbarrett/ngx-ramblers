import { EnvironmentConfig, EnvironmentsConfig } from "./environment-config.model";

export enum BackupRestoreTab {
  BACKUP = "Backup",
  RESTORE = "Restore",
  S3_BACKUP = "S3 Backup",
  BACKUPS = "Backups",
  HISTORY = "History",
  SETTINGS = "Settings"
}

export const BackupSessionType = {
  BACKUP: "backup",
  RESTORE: "restore"
} as const;

export type BackupSessionType = typeof BackupSessionType[keyof typeof BackupSessionType];

export const BackupSessionStatus = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  FAILED: "failed"
} as const;

export type BackupSessionStatus = typeof BackupSessionStatus[keyof typeof BackupSessionStatus];

export const BackupSessionTrigger = {
  CLI: "cli",
  WEB: "web"
} as const;

export type BackupSessionTrigger = typeof BackupSessionTrigger[keyof typeof BackupSessionTrigger];

export const BackupLocation = {
  LOCAL: "local",
  S3: "s3"
} as const;

export type BackupLocation = typeof BackupLocation[keyof typeof BackupLocation];

export interface BackupSession {
  _id?: string;
  sessionId: string;
  type: BackupSessionType;
  environment: string;
  database: string;
  collections?: string[];
  status: BackupSessionStatus;
  startTime: Date | number;
  endTime?: Date | number;
  options: BackupSessionOptions;
  backupPath?: string;
  s3Location?: string;
  s3Backups?: S3BackupSummary[];
  s3Restores?: S3BackupSummary[];
  logs: string[];
  error?: string;
  metadata?: BackupSessionMetadata;
}

export interface BackupSessionOptions {
  scaleDown?: boolean;
  upload?: boolean;
  s3Bucket?: string;
  s3Region?: string;
  s3Prefix?: string;
  drop?: boolean;
  dryRun?: boolean;
  from?: string;
}

export interface BackupSessionMetadata {
  user?: string;
  triggeredBy: BackupSessionTrigger;
}

export interface BackupRequest {
  environment: string;
  database?: string;
  collections?: string[];
  scaleDown?: boolean;
  upload?: boolean;
  includeS3?: boolean;
}

export interface RestoreRequest {
  environment: string;
  from: string;
  database?: string;
  collections?: string[];
  drop?: boolean;
  dryRun?: boolean;
  includeS3?: boolean;
}

export interface EnvironmentInfo {
  name: string;
  appName: string;
  hasMongoConfig: boolean;
  database?: string;
}

export interface BackupListItem {
  name: string;
  path: string;
  timestamp: Date | number;
  size?: number;
  environment?: string;
  database?: string;
  location: BackupLocation;
}

export interface SecretEntry {
  key: string;
  value: string;
}

export interface S3BackupManifestEntry {
  key: string;
  eTag: string;
  size: number;
  lastModified: string;
  action: S3BackupAction;
}

export const S3BackupAction = {
  COPIED: "copied",
  SKIPPED: "skipped"
} as const;

export type S3BackupAction = typeof S3BackupAction[keyof typeof S3BackupAction];

export interface S3BackupManifest {
  _id?: string;
  timestamp: string;
  site: string;
  sourceBucket: string;
  backupBucket: string;
  backupPrefix: string;
  mongoTimestamp?: string;
  entries: S3BackupManifestEntry[];
  totalObjects: number;
  copiedObjects: number;
  skippedObjects: number;
  totalSizeBytes: number;
  copiedSizeBytes: number;
  durationMs: number;
  status: BackupSessionStatus;
  error?: string;
  createdAt?: Date | number;
  deletable?: boolean;
  blockReason?: string;
}

export interface S3BackupRequest {
  site?: string;
  all?: boolean;
  mongoTimestamp?: string;
  dryRun?: boolean;
}

export interface S3RestoreRequest {
  site?: string;
  all?: boolean;
  timestamp: string;
  targetSite?: string;
  dryRun?: boolean;
}

export interface S3BackupSummary {
  site: string;
  timestamp: string;
  totalObjects: number;
  copiedObjects: number;
  skippedObjects: number;
  totalSizeBytes: number;
  copiedSizeBytes: number;
  durationMs: number;
  status: BackupSessionStatus;
}

export type EnvironmentBackupConfig = EnvironmentConfig;

export type BackupConfig = EnvironmentsConfig;
