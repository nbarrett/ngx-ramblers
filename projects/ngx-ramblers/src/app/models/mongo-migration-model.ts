export enum MigrationFileStatus {
  PENDING = "pending",
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
  timestamp?: string;
  error?: string;
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
