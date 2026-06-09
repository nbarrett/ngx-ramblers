import { EnvironmentConfig, EnvironmentsConfig } from "./environment-config.model";

export enum BackupRestoreTab {
  BACKUP = "Backup",
  RESTORE = "Restore",
  HISTORY = "History",
  SETTINGS = "Settings"
}

export enum BackupSessionType {
  BACKUP = "backup",
  RESTORE = "restore"
}

export enum BackupSessionStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  FAILED = "failed"
}

export enum BackupSessionTrigger {
  CLI = "cli",
  WEB = "web",
  SCHEDULED = "scheduled"
}

export enum BackupLocation {
  LOCAL = "local",
  S3 = "s3"
}

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

export interface BackupSessionHistoryRow extends BackupSession {
  startedMs: number;
  durationMs: number;
}

export interface BackupRequest {
  environment: string;
  database?: string;
  collections?: string[];
  scaleDown?: boolean;
  upload?: boolean;
  includeS3?: boolean;
  s3ObjectBackupConcurrency?: number;
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
  status?: BackupSessionStatus;
  outcome?: string;
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

export enum S3BackupAction {
  COPIED = "copied",
  SKIPPED = "skipped"
}

export interface S3BackupManifest {
  _id?: string;
  timestamp: string;
  site: string;
  sourceBucket: string;
  backupBucket: string;
  backupPrefix: string;
  mongoTimestamp?: string;
  entriesObjectKey?: string;
  entriesCount?: number;
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
  concurrency?: number;
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
  error?: string;
}

export interface S3ManifestBreakdown {
  label: string;
  count: number;
  bytes: number;
}

export type EnvironmentBackupConfig = EnvironmentConfig;

export type BackupConfig = EnvironmentsConfig;
