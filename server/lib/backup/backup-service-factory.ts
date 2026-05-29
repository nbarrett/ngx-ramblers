import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { BackupAndRestoreService } from "./backup-and-restore-service";
import { BackupNotificationService } from "./backup-notification-service";
import { configuredBackup } from "./backup-config";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import type { MailMessagingConfig } from "../../../projects/ngx-ramblers/src/app/models/mail.model";
import * as config from "../mongo/controllers/config";

const debugLog = debug(envConfig.logNamespace("backup-service-factory"));
debugLog.enabled = false;
let loggedNotificationsStatus = false;

export async function createBackupAndRestoreService(): Promise<BackupAndRestoreService> {
  const backupConfig = await configuredBackup();

  let notificationService: BackupNotificationService | undefined;
  let backupNotificationConfigId: string | undefined;
  try {
    const mailConfigDoc = await config.queryKey(ConfigKey.MAIL);
    const mailMessagingConfig: MailMessagingConfig | undefined = mailConfigDoc?.value as any;
    backupNotificationConfigId = mailMessagingConfig?.mailConfig?.backupNotificationConfigId;
  } catch {}

  if (backupNotificationConfigId) {
    if (!loggedNotificationsStatus) {
      debugLog("Backup notifications enabled via config:", backupNotificationConfigId);
      loggedNotificationsStatus = true;
    }
    notificationService = new BackupNotificationService({
      notificationConfigId: backupNotificationConfigId,
      recipients: []
    });
  } else if (!loggedNotificationsStatus) {
    debugLog("Backup notifications not configured");
    loggedNotificationsStatus = true;
  }

  return new BackupAndRestoreService([], backupConfig, undefined, notificationService);
}
