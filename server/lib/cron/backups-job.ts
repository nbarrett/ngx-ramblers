import debug from "debug";
import {
  BACKUPS_TASK_ID,
  BACKUPS_TASK_NAME,
  BackupsTaskSettings,
  DEFAULT_BACKUPS_TASK_SETTINGS
} from "../../../projects/ngx-ramblers/src/app/models/scheduled-task.model";
import { BackupSessionStatus, BackupSessionTrigger } from "../../../projects/ngx-ramblers/src/app/models/backup-session.model";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import { envConfig } from "../env-config/env-config";
import { booleanOf } from "../shared/string-utils";
import { BackupAndRestoreService } from "../backup/backup-and-restore-service";
import { createBackupAndRestoreService } from "../backup/backup-service-factory";
import { dateTimeNowAsValue } from "../shared/dates";
import { isNumber } from "es-toolkit/compat";
import { registerScheduledTask, scheduledTaskSettings } from "./scheduled-task-registry";

const debugLog = debug(envConfig.logNamespace("cron:backups"));
debugLog.enabled = true;

const scheduledBackupUser = "scheduled-task";
const pollIntervalMs = 5000;
const maximumMongoDumpConcurrency = 5;
const maximumS3ObjectBackupConcurrency = 5;
const maximumRetryCount = 5;
const maximumTimeoutMinutes = 180;

const delay = (ms: number): Promise<void> => new Promise<void>(resolve => setTimeout(resolve, ms));

function platformAdminEnabled(): boolean {
  return booleanOf(process.env[Environment.PLATFORM_ADMIN_ENABLED]);
}

function boundedInteger(value: unknown, fallback: number, maximum: number): number {
  const candidate = isNumber(value) && Number.isFinite(value) ? Math.floor(value) : fallback;
  return Math.max(1, Math.min(maximum, candidate));
}

function boundedNonNegativeInteger(value: unknown, fallback: number, maximum: number): number {
  const candidate = isNumber(value) && Number.isFinite(value) ? Math.floor(value) : fallback;
  return Math.max(0, Math.min(maximum, candidate));
}

async function settings(): Promise<BackupsTaskSettings> {
  const configured = await scheduledTaskSettings(BACKUPS_TASK_ID, DEFAULT_BACKUPS_TASK_SETTINGS);
  return {
    ...DEFAULT_BACKUPS_TASK_SETTINGS,
    ...configured,
    mongoDumpConcurrency: boundedInteger(configured.mongoDumpConcurrency, DEFAULT_BACKUPS_TASK_SETTINGS.mongoDumpConcurrency, maximumMongoDumpConcurrency),
    s3ObjectBackupConcurrency: boundedInteger(configured.s3ObjectBackupConcurrency, DEFAULT_BACKUPS_TASK_SETTINGS.s3ObjectBackupConcurrency, maximumS3ObjectBackupConcurrency),
    perEnvironmentTimeoutMinutes: boundedInteger(configured.perEnvironmentTimeoutMinutes, DEFAULT_BACKUPS_TASK_SETTINGS.perEnvironmentTimeoutMinutes, maximumTimeoutMinutes),
    maxRetries: boundedNonNegativeInteger(configured.maxRetries, DEFAULT_BACKUPS_TASK_SETTINGS.maxRetries, maximumRetryCount),
    retryDelaySeconds: boundedInteger(configured.retryDelaySeconds, DEFAULT_BACKUPS_TASK_SETTINGS.retryDelaySeconds, 3600)
  };
}

async function waitForBackupCompletion(service: BackupAndRestoreService, sessionId: string, deadline: number, timeoutMinutes: number): Promise<BackupSessionStatus> {
  const session = await service.session(sessionId);
  if (session?.status === BackupSessionStatus.COMPLETED || session?.status === BackupSessionStatus.FAILED) {
    return session.status;
  }
  if (dateTimeNowAsValue() >= deadline) {
    throw new Error(`Timed out after ${timeoutMinutes} minutes waiting for backup to finish`);
  }
  await delay(pollIntervalMs);
  return waitForBackupCompletion(service, sessionId, deadline, timeoutMinutes);
}

async function backupEnvironment(service: BackupAndRestoreService, environmentName: string, taskSettings: BackupsTaskSettings, attempt: number = 0): Promise<string | null> {
  try {
    const session = await service.startBackup({
      environment: environmentName,
      upload: taskSettings.uploadMongoDumpToS3ByDefault,
      includeS3: taskSettings.includeS3ObjectsByDefault,
      s3ObjectBackupConcurrency: taskSettings.s3ObjectBackupConcurrency,
      user: scheduledBackupUser,
      triggeredBy: BackupSessionTrigger.SCHEDULED
    });
    const deadline = dateTimeNowAsValue() + taskSettings.perEnvironmentTimeoutMinutes * 60 * 1000;
    const status = await waitForBackupCompletion(service, session._id!.toString(), deadline, taskSettings.perEnvironmentTimeoutMinutes);
    if (status === BackupSessionStatus.FAILED) {
      const failed = await service.session(session._id!.toString());
      return failed?.error || "unknown error";
    } else {
      return null;
    }
  } catch (error: any) {
    const reason = error?.message || `${error}`;
    if (attempt < taskSettings.maxRetries) {
      debugLog(`Backup errored for ${environmentName}: ${reason}. Retrying in ${taskSettings.retryDelaySeconds} seconds`);
      await delay(taskSettings.retryDelaySeconds * 1000);
      return backupEnvironment(service, environmentName, taskSettings, attempt + 1);
    } else {
      return reason;
    }
  }
}

async function runBackupPool(service: BackupAndRestoreService, environments: { name: string }[], taskSettings: BackupsTaskSettings): Promise<string[]> {
  const failures: string[] = [];
  const state = { nextIndex: 0 };
  const worker = async (): Promise<void> => {
    const index = state.nextIndex++;
    const environment = environments[index];
    if (!environment) {
      return;
    }
    const failure = await backupEnvironment(service, environment.name, taskSettings);
    if (failure) {
      failures.push(`${environment.name}: ${failure}`);
      debugLog(`Backup failed for ${environment.name}: ${failure}`);
    } else {
      debugLog(`Backup completed for ${environment.name}`);
    }
    return worker();
  };
  const workerCount = Math.min(taskSettings.mongoDumpConcurrency, environments.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return failures;
}

async function backupAllEnvironments(): Promise<void> {
  const service = await createBackupAndRestoreService();
  const taskSettings = await settings();
  const environments = (await service.listEnvironments()).filter(environment => environment.hasMongoConfig);
  if (environments.length === 0) {
    debugLog("No environments with a mongo config found - nothing to back up");
    return;
  }
  debugLog(`Starting scheduled backup for ${environments.length} environments with concurrency ${taskSettings.mongoDumpConcurrency}: ${environments.map(environment => environment.name).join(", ")}`);
  const failures = await runBackupPool(service, environments, taskSettings);
  debugLog(`Scheduled backup finished: ${environments.length - failures.length} of ${environments.length} environments succeeded`);
  if (failures.length > 0) {
    throw new Error(`Backup failed for ${failures.length} of ${environments.length} environments: ${failures.join("; ")}`);
  }
}

export async function scheduleBackups(): Promise<void> {
  const cronExpression = "0 3 * * *";
  await registerScheduledTask({
    id: BACKUPS_TASK_ID,
    name: BACKUPS_TASK_NAME,
    description: "Backs up every configured environment's MongoDB database and S3 objects to the shared backup bucket. Only runs on platform-admin environments.",
    cronExpression,
    enabled: false,
    settings: DEFAULT_BACKUPS_TASK_SETTINGS,
    run: async () => {
      if (!platformAdminEnabled()) {
        debugLog(`${Environment.PLATFORM_ADMIN_ENABLED} is not set - skipping run on this environment`);
        return;
      }
      debugLog("Starting scheduled all-environments backup");
      await backupAllEnvironments();
    }
  });
  debugLog(`All-environments backup cron job registered: ${cronExpression} (daily at 3am, disabled by default; ${platformAdminEnabled() ? "platform-admin enabled" : "platform-admin not enabled - registered for UI visibility only"})`);
}
