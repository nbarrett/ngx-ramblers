export enum BackupRestoreTab {
  BACKUP = "Backup",
  RESTORE = "Restore",
  BACKUPS = "Backups",
  HISTORY = "History",
  SETTINGS = "Settings"
}

export interface BackupSession {
  _id?: string;
  sessionId: string;
  type: "backup" | "restore";
  environment: string;
  database: string;
  collections?: string[];
  status: "pending" | "in_progress" | "completed" | "failed";
  startTime: Date | number;
  endTime?: Date | number;
  options: BackupSessionOptions;
  backupPath?: string;
  s3Location?: string;
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
  triggeredBy: "cli" | "web";
}

export interface BackupRequest {
  environment: string;
  database?: string;
  collections?: string[];
  scaleDown?: boolean;
  upload?: boolean;
}

export interface RestoreRequest {
  environment: string;
  from: string;
  database?: string;
  collections?: string[];
  drop?: boolean;
  dryRun?: boolean;
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
  location: "local" | "s3";
}

export interface EnvironmentBackupConfig {
  environment: string;
  aws?: {
    bucket?: string;
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
  };
  mongo?: {
    uri?: string;
    db?: string;
    username?: string;
    password?: string;
  };
  flyio?: {
    apiKey?: string;
    appName?: string;
    memory?: string;
    scaleCount?: number;
    organization?: string;
  };
}

export interface BackupConfig {
  environments?: EnvironmentBackupConfig[];
  aws?: {
    bucket?: string;
    region?: string;
  };
}
