export enum MigrationFileStatus {
  PENDING = "pending",
  RUNNING = "running",
  APPLIED = "applied",
  FAILED = "failed"
}

export enum MigrationSortColumn {
  STATUS = "status",
  FILE = "file",
  TIMESTAMP = "timestamp"
}

export interface MigrationFile {
  fileName: string;
  status: MigrationFileStatus;
  startedAt?: string;
  timestamp?: string;
  error?: string;
  manual?: boolean;
}

export interface MaintenanceMigrationFile {
  file: string;
  status: MigrationFileStatus;
  startedAt?: string;
  timestamp: string;
  error?: string;
  manual?: boolean;
}

export interface MigrationStatus {
  files: MigrationFile[];
  failed: boolean;
  error?: string;
}

export interface MigrationRetryResult {
  success: boolean;
  message?: string;
  error?: string;
  appliedFiles: string[];
}
