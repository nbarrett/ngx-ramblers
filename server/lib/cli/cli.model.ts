import { ChildProcess } from "child_process";
import { CustomDomainEntry } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { ProgressCallback, ResumeOptions } from "../../../projects/ngx-ramblers/src/app/models/environment-setup.model";
import { OutputCallback } from "../fly/fly-commands";

export type DeployOutputCallback = OutputCallback;

export interface DestroyConfig {
  name: string;
  appName: string;
  apiKey?: string;
  mongoUri?: string;
  database?: string;
  skipFly?: boolean;
  skipS3?: boolean;
  skipDatabase?: boolean;
}

export interface DestroyResult {
  success: boolean;
  steps: { step: string; success: boolean; message: string }[];
}

export interface ResumeEnvironmentOptions extends ResumeOptions {
  onDeployOutput?: DeployOutputCallback;
}

export interface DeployToFlyioOptions {
  onProgress?: ProgressCallback;
  onDeployOutput?: DeployOutputCallback;
}

export interface SubdomainRemovalResult {
  hostname: string;
  logs: string[];
}

export interface CustomDomainOperationResult {
  hostname: string;
  zoneId?: string;
  appName: string;
  entry?: CustomDomainEntry;
  logs: string[];
}

export interface ApexRedirectOperationResult {
  primaryHostname: string;
  redirectFrom: string;
  zoneId?: string;
  redirectCreated: boolean;
  logs: string[];
}

export interface ApexRedirectRemovalResult {
  redirectFrom: string;
  zoneId?: string;
  redirectRemoved: boolean;
  placeholderRecordsRemoved: number;
  logs: string[];
}

export interface LocalRunConfig {
  environmentName: string;
  mode: "dev" | "prod";
  port: number;
  logDir: string | null;
  logTimestamp: boolean;
  logViewer: boolean;
  s3BucketOverride: string | false | null;
  dockerWorker?: boolean;
  headless?: boolean;
}

export interface RunningProcess {
  child: ChildProcess;
  label: string;
}

export interface ProcessState {
  hasError: boolean;
  isShuttingDown: boolean;
  stderrBuffer: string;
}

export interface LogViewerConfig {
  frontendLogPath: string;
  backendLogPath: string;
  workerLogPath?: string;
  refreshIntervalMs: number;
  maxLines: number;
}

export interface ShardInfo {
  host: string;
  ip: string;
  tcpMs: number;
}

export interface QueryBenchmark {
  label: string;
  avgMs: number;
  minMs: number;
  maxMs: number;
  docCount: number;
  indexes: number;
}
