import debug from "debug";
import { Request, Response } from "express";
import { envConfig } from "../env-config/env-config";
import { BackupAndRestoreService } from "./backup-and-restore-service";
import { BackupNotificationService } from "./backup-notification-service";
import { configuredBackup } from "./backup-config";
import { initializeAndMergeBackupConfig } from "./config-initializer";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import type { MailMessagingConfig } from "../../../projects/ngx-ramblers/src/app/models/mail.model";
import * as config from "../mongo/controllers/config";
import { asNumber } from "../../../projects/ngx-ramblers/src/app/functions/numbers";
import { isArray } from "es-toolkit/compat";

const debugLog = debug(envConfig.logNamespace("backup"));
debugLog.enabled = true;
let loggedNotificationsStatus = false;

async function service(): Promise<BackupAndRestoreService> {
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

export async function listEnvironments(req: Request, res: Response) {
  try {
    const svc = await service();
    const environments = await svc.listEnvironments();
    debugLog("listEnvironments:response:", environments.length, "environments");
    res.status(200).json(environments);
  } catch (error) {
    debugLog("listEnvironments:error:", error);
    res.status(500).json({ error: error.message });
  }
}

export async function listBackups(req: Request, res: Response) {
  try {
    const svc = await service();
    const backups = await svc.listBackups();
    debugLog("listBackups:response:", backups.length, "backups");
    res.status(200).json(backups);
  } catch (error) {
    debugLog("listBackups:error:", error);
    res.status(500).json({ error: error.message });
  }
}

export async function listSessions(req: Request, res: Response) {
  try {
    const svc = await service();
    const limit = asNumber(req.query.limit || 50);
    const sessions = await svc.sessions(limit);
    res.status(200).json(sessions);
  } catch (error) {
    debugLog("listSessions:error:", error);
    res.status(500).json({ error: error.message });
  }
}

export async function session(req: Request, res: Response) {
  try {
    const svc = await service();
    const sessionData = await svc.session(req.params.sessionId);
    if (!sessionData) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    debugLog("session:response:", sessionData.sessionId);
    res.status(200).json(sessionData);
  } catch (error) {
    debugLog("session:error:", error);
    res.status(500).json({ error: error.message });
  }
}

export async function startBackup(req: Request, res: Response) {
  try {
    const svc = await service();
    const user = (req as any).user?.username || "unknown";
    const options = {
      ...req.body,
      user
    };

    debugLog("startBackup:request:", options);
    const session = await svc.startBackup(options);
    debugLog("startBackup:response:", session.sessionId);
    res.status(200).json(session);
  } catch (error) {
    debugLog("startBackup:error:", error);
    res.status(400).json({ error: error.message });
  }
}

export async function startRestore(req: Request, res: Response) {
  try {
    const svc = await service();
    const user = (req as any).user?.username || "unknown";
    const options = {
      ...req.body,
      user
    };

    debugLog("startRestore:request:", options);
    const session = await svc.startRestore(options);
    debugLog("startRestore:response:", session.sessionId);
    res.status(200).json(session);
  } catch (error) {
    debugLog("startRestore:error:", error);
    res.status(400).json({ error: error.message });
  }
}

export async function initializeConfig(req: Request, res: Response) {
  try {
    debugLog("initializeConfig:request - using smart merge");
    const backupConfig = await initializeAndMergeBackupConfig();
    debugLog("initializeConfig:response:", {
      environmentCount: backupConfig.environments?.length || 0
    });
    res.status(200).json(backupConfig);
  } catch (error) {
    debugLog("initializeConfig:error:", error);
    res.status(500).json({ error: error.message });
  }
}

export async function listCollections(req: Request, res: Response) {
  try {
    const environmentName = req.params.environment;
    if (!environmentName) {
      res.status(400).json({ error: "Environment name is required" });
      return;
    }

    const svc = await service();
    const collections = await svc.listCollections(environmentName);
    debugLog("listCollections:response:", collections.length, "collections for", environmentName);
    res.status(200).json(collections);
  } catch (error) {
    debugLog("listCollections:error:", error);
    res.status(500).json({ error: error.message });
  }
}

export async function listS3Backups(req: Request, res: Response) {
  try {
    const svc = await service();
    const backups = await svc.listS3Backups().catch(error => {
      debugLog("listS3Backups:error:", error);
      if (error?.Code === "NoSuchBucket" || error?.$metadata?.httpStatusCode === 404) {
        return [] as any[];
      }
      throw error;
    });
    debugLog("listS3Backups:response:", backups.length, "backups");
    res.status(200).json(backups);
  } catch (error) {
    debugLog("listS3Backups:error:", error);
    res.status(200).json([]);
  }
}

export async function deleteS3Backups(req: Request, res: Response) {
  try {
    const names = isArray(req.body?.names) ? req.body.names as string[] : [];
    if (names.length === 0) {
      res.status(400).json({ error: "names array is required" });
      return;
    }
    const svc = await service();
    const result = await svc.deleteS3Backups(names);
    debugLog("deleteS3Backups:response:", { deleted: result.deleted.length, errors: result.errors.length });
    res.status(200).json(result);
  } catch (error) {
    debugLog("deleteS3Backups:error:", error);
    res.status(500).json({ error: error.message });
  }
}

export async function deleteBackups(req: Request, res: Response) {
  try {
    const names = isArray(req.body?.names) ? req.body.names as string[] : [];
    if (names.length === 0) {
      res.status(400).json({ error: "names array is required" });
      return;
    }

    const svc = await service();
    const result = await svc.deleteBackups(names);
    debugLog("deleteBackups:response:", { deleted: result.deleted.length, errors: result.errors.length });
    res.status(200).json(result);
  } catch (error) {
    debugLog("deleteBackups:error:", error);
    res.status(500).json({ error: error.message });
  }
}
