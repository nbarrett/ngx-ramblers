import { MigrationFile } from "./mongo-migration-model";

export interface HealthMigrations {
  pending: number;
  applied: number;
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
  timestamp: string;
  migrations: HealthMigrations;
}
