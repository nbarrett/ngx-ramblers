import { MongoConfig } from "./environment-config.model";
import { BackupLocation, S3BackupSummary } from "./backup-session.model";

export enum EnvironmentMigrationTab {
  PLAN = "Plan & Restore",
  RESULT = "Latest Result",
  HISTORY = "History"
}

export enum EnvironmentMigrationMode {
  MONGO_ONLY = "mongo-only",
  MONGO_AND_S3 = "mongo-and-s3"
}

export enum EnvironmentMigrationStatus {
  PENDING = "pending",
  VALIDATING = "validating",
  DUMPING = "dumping",
  RESTORING = "restoring",
  VERIFYING = "verifying",
  VALIDATED = "validated",
  READY_FOR_CUTOVER = "ready-for-cutover",
  ROTATED = "rotated",
  ORPHANED = "orphaned",
  FAILED = "failed"
}

export enum EnvironmentMigrationPhase {
  PLAN = "plan",
  VALIDATE_SOURCE = "validate-source",
  VALIDATE_TARGET = "validate-target",
  DUMP_SOURCE = "dump-source",
  RESTORE_TARGET = "restore-target",
  VERIFY_TARGET = "verify-target",
  ROTATE_CREDENTIALS = "rotate-credentials"
}

export interface EnvironmentMigrationMongoTarget {
  cluster: string;
  db: string;
  username: string;
  password: string;
}

export interface EnvironmentMigrationRequest {
  environment: string;
  mode?: EnvironmentMigrationMode;
  dryRun?: boolean;
  backupPath?: string;
  backupName?: string;
  backupLocation?: BackupLocation;
  targetMongo: EnvironmentMigrationMongoTarget;
  confirmEnvironment?: string;
  rotateCredentials?: boolean;
  rotateS3Credentials?: boolean;
  user?: string;
}

export interface EnvironmentMigrationMongoSummary {
  cluster: string;
  db: string;
  username: string;
  uriSummary: string;
}

export interface EnvironmentMigrationCollectionCount {
  collection: string;
  count: number;
}

export interface EnvironmentMigrationVerification {
  systemGroupIdentity?: {
    shortName?: string;
    groupCode?: string;
    longName?: string;
  };
  collections: string[];
  totalDocumentCount: number;
  keyCollectionCounts: EnvironmentMigrationCollectionCount[];
  stagingEnvironments?: {
    present: boolean;
    count: number;
    expected: string[];
    missing: string[];
    targetMongoMatches: boolean;
    stagingMongo?: EnvironmentMigrationMongoSummary;
  };
}

export interface EnvironmentMigrationRollbackInfo {
  oldMongo: EnvironmentMigrationMongoSummary;
  targetMongo: EnvironmentMigrationMongoSummary;
  timestamp: Date | number;
  backupUsed?: string;
}

export interface EnvironmentMigrationAudit {
  _id?: string;
  migrationId: string;
  environment: string;
  mode: EnvironmentMigrationMode;
  status: EnvironmentMigrationStatus;
  phase: EnvironmentMigrationPhase;
  dryRun: boolean;
  startTime: Date | number;
  endTime?: Date | number;
  backupPath?: string;
  sourceMongo: EnvironmentMigrationMongoSummary;
  targetMongo: EnvironmentMigrationMongoSummary;
  executionId?: string;
  executionStartedAt?: Date | number;
  heartbeatAt?: Date | number;
  backupName?: string;
  backupLocation?: BackupLocation;
  verification?: EnvironmentMigrationVerification;
  s3Backups?: S3BackupSummary[];
  s3Restores?: S3BackupSummary[];
  rollbackInfo?: EnvironmentMigrationRollbackInfo;
  rotatedAt?: Date | number;
  error?: string;
  requestedBy?: string;
}

export interface EnvironmentMigrationRotationRequest {
  migrationId: string;
  confirmEnvironment: string;
  targetMongo: EnvironmentMigrationMongoTarget;
  rotateS3Credentials?: boolean;
  user?: string;
}
