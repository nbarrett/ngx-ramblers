import { ChildProcess } from "child_process";

export interface ChromeValidationResult {
  valid: boolean;
  chromeBinPath: string | null;
  chromedriverPath: string | null;
  chromeVersion: string | null;
  error: string | null;
}

export interface LocalRunConfig {
  environmentName: string;
  mode: "dev" | "prod";
  port: number;
  logDir: string | null;
  logTimestamp: boolean;
  logViewer: boolean;
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
  refreshIntervalMs: number;
  maxLines: number;
}
