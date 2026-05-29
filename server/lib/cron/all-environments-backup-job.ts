import debug from "debug";
import { ALL_ENVIRONMENTS_BACKUP_TASK_ID, ALL_ENVIRONMENTS_BACKUP_TASK_NAME } from "../../../projects/ngx-ramblers/src/app/models/scheduled-task.model";
import { BackupSessionStatus, BackupSessionTrigger } from "../../../projects/ngx-ramblers/src/app/models/backup-session.model";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import { envConfig } from "../env-config/env-config";
import { booleanOf } from "../shared/string-utils";
import { BackupAndRestoreService } from "../backup/backup-and-restore-service";
import { createBackupAndRestoreService } from "../backup/backup-service-factory";
import { registerScheduledTask } from "./scheduled-task-registry";

const debugLog = debug(envConfig.logNamespace("cron:all-environments-backup"));
debugLog.enabled = true;

const scheduledBackupUser = "scheduled-task";
const pollIntervalMs = 5000;
const perEnvironmentTimeoutMs = 45 * 60 * 1000;

const delay = (ms: number): Promise<void> => new Promise<void>(resolve => setTimeout(resolve, ms));

function platformAdminEnabled(): boolean {
  return booleanOf(process.env[Environment.PLATFORM_ADMIN_ENABLED]);
}

async function waitForBackupCompletion(service: BackupAndRestoreService, sessionId: string, deadline: number): Promise<BackupSessionStatus> {
  const session = await service.session(sessionId);
  if (session?.status === BackupSessionStatus.COMPLETED || session?.status === BackupSessionStatus.FAILED) {
    return session.status;
  }
  if (Date.now() >= deadline) {
    throw new Error(`Timed out after ${Math.round(perEnvironmentTimeoutMs / 60000)} minutes waiting for backup to finish`);
  }
  await delay(pollIntervalMs);
  return waitForBackupCompletion(service, sessionId, deadline);
}

async function backupAllEnvironments(): Promise<void> {
  const service = await createBackupAndRestoreService();
  const environments = (await service.listEnvironments()).filter(environment => environment.hasMongoConfig);
  if (environments.length === 0) {
    debugLog("No environments with a mongo config found - nothing to back up");
    return;
  }
  debugLog(`Starting scheduled backup for ${environments.length} environments: ${environments.map(environment => environment.name).join(", ")}`);
  const failures: string[] = [];
  for (const environment of environments) {
    try {
      const session = await service.startBackup({
        environment: environment.name,
        upload: true,
        includeS3: true,
        user: scheduledBackupUser,
        triggeredBy: BackupSessionTrigger.SCHEDULED
      });
      const status = await waitForBackupCompletion(service, session._id!.toString(), Date.now() + perEnvironmentTimeoutMs);
      if (status === BackupSessionStatus.FAILED) {
        const failed = await service.session(session._id!.toString());
        const reason = failed?.error || "unknown error";
        failures.push(`${environment.name}: ${reason}`);
        debugLog(`Backup failed for ${environment.name}: ${reason}`);
      } else {
        debugLog(`Backup completed for ${environment.name}`);
      }
    } catch (error: any) {
      const reason = error?.message || `${error}`;
      failures.push(`${environment.name}: ${reason}`);
      debugLog(`Backup errored for ${environment.name}: ${reason}`);
    }
  }
  debugLog(`Scheduled backup finished: ${environments.length - failures.length} of ${environments.length} environments succeeded`);
  if (failures.length > 0) {
    throw new Error(`Backup failed for ${failures.length} of ${environments.length} environments: ${failures.join("; ")}`);
  }
}

export async function scheduleAllEnvironmentsBackup(): Promise<void> {
  const cronExpression = "0 3 * * *";
  await registerScheduledTask({
    id: ALL_ENVIRONMENTS_BACKUP_TASK_ID,
    name: ALL_ENVIRONMENTS_BACKUP_TASK_NAME,
    description: "Backs up every configured environment's MongoDB database and S3 objects to the shared backup bucket. Only runs on platform-admin environments.",
    cronExpression,
    enabled: false,
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
