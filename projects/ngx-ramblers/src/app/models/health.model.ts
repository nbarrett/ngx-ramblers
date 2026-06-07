import { MigrationFile } from "./mongo-migration-model";

export interface HealthMigrations {
  pending: number;
  applied: number;
  skipped: number;
  failed: boolean;
  files?: MigrationFile[];
}

export interface HealthEnvironment {
  env: string;
  nodeEnv?: string;
}

export interface HealthAws {
  region?: string;
  bucket?: string;
}

export interface HealthGroup {
  shortName?: string;
  groupCode?: string;
  href?: string;
}

export interface HealthWebAnalytics {
  enabled?: boolean;
  siteTag?: string;
}

export enum HealthStatus {
  OK = "OK",
  DEGRADED = "DEGRADED"
}

export interface HealthResponse {
  status: HealthStatus;
  environment: HealthEnvironment;
  aws: HealthAws;
  group: HealthGroup;
  webAnalytics?: HealthWebAnalytics;
  timestamp: string;
  migrations: HealthMigrations;
}

export enum EnvironmentHealthCheckStatus {
  HEALTHY = "HEALTHY",
  DEGRADED = "DEGRADED",
  PENDING = "PENDING",
  UNREACHABLE = "UNREACHABLE"
}

export interface EnvironmentHealthCheck {
  environment: string;
  appName: string;
  url: string;
  adminUrl: string;
  checkStatus: EnvironmentHealthCheckStatus;
  healthResponse?: Partial<HealthResponse>;
  error?: string;
  responseTimeMs: number;
}

export enum HealthSortColumn {
  STATUS = "checkStatus",
  ENVIRONMENT = "environment",
  GROUP = "healthResponse.group.shortName",
  APPLIED = "healthResponse.migrations.applied",
  PENDING = "healthResponse.migrations.pending",
  FAILED = "healthResponse.migrations.failed",
  RESPONSE = "responseTimeMs"
}

export interface CrossEnvironmentHealthSummary {
  total: number;
  healthy: number;
  degraded: number;
  unreachable: number;
  pending: number;
}

export interface CrossEnvironmentHealthResponse {
  timestamp: string;
  environments: EnvironmentHealthCheck[];
  summary: CrossEnvironmentHealthSummary;
}

export interface ProcessMemoryMb {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
}

export interface V8HeapMb {
  heapSizeLimit: number;
  totalHeapSize: number;
  usedHeapSize: number;
  mallocedMemory: number;
  externalMemory: number;
}

export interface MemoryUsageResponse {
  timestamp: string;
  environment: string;
  uptimeSeconds: number;
  nodeVersion: string;
  processMemoryMb: ProcessMemoryMb;
  v8HeapMb: V8HeapMb;
  nativeContexts: number;
  detachedContexts: number;
}

export interface HeapSnapshotResponse {
  bucket: string;
  key: string;
  capturedRssMb: number;
  message: string;
}

export enum HeapSnapshotStatus {
  IDLE = "idle",
  RUNNING = "running",
  DONE = "done",
  STOPPED = "stopped",
  FAILED = "failed"
}
