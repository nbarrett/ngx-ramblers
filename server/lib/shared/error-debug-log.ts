import debug from "debug";
import { envConfig } from "../env-config/env-config";

const errorDebugLogs = new Map<string, debug.Debugger>();

export function createErrorDebugLog(namespace: string): debug.Debugger {
  const existing = errorDebugLogs.get(namespace);
  if (existing) {
    return existing;
  }
  const errorDebugLog = debug("ERROR:" + envConfig.logNamespace(namespace));
  errorDebugLog.enabled = true;
  errorDebugLogs.set(namespace, errorDebugLog);
  return errorDebugLog;
}
