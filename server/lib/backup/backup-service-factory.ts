import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { BackupAndRestoreService } from "./backup-and-restore-service";
import { BackupNotificationService } from "./backup-notification-service";
import { configuredBackup } from "./backup-config";

const debugLog = debug(envConfig.logNamespace("backup-service-factory"));
debugLog.enabled = false;
const loggedNotificationsStatus = {done: false};

export async function createBackupAndRestoreService(): Promise<BackupAndRestoreService> {
  const backupConfig = await configuredBackup();
  if (!loggedNotificationsStatus.done) {
    debugLog("Backup notifications use shared admin alert emails (failures only by default)");
    loggedNotificationsStatus.done = true;
  }
  const notificationService = new BackupNotificationService({
    notifyOnStart: false,
    notifyOnComplete: false,
    notifyOnError: true
  });
  return new BackupAndRestoreService([], backupConfig, undefined, notificationService);
}
