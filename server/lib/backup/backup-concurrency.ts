import debug from "debug";
import { envConfig } from "../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("backup-concurrency"));
debugLog.enabled = true;

const DEFAULT_LIMIT = 3;

function resolveLimit(): number {
  const configured = Number.parseInt(process.env.BACKUP_MAX_CONCURRENT_ENVIRONMENTS || "", 10);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_LIMIT;
}

const limit = resolveLimit();
const waiters: Array<() => void> = [];
let active = 0;

function acquire(): Promise<void> {
  return new Promise<void>(resolve => {
    if (active < limit) {
      active++;
      resolve();
    } else {
      waiters.push(resolve);
    }
  });
}

function release(): void {
  const next = waiters.shift();
  if (next) {
    next();
  } else {
    active = Math.max(0, active - 1);
  }
}

export function backupConcurrencyLimit(): number {
  return limit;
}

export async function withBackupSlot<T>(label: string, task: () => Promise<T>): Promise<T> {
  if (active >= limit) {
    debugLog(`${label} queued: ${active} running, ${waiters.length + 1} waiting (limit ${limit})`);
  }
  await acquire();
  try {
    return await task();
  } finally {
    release();
  }
}
