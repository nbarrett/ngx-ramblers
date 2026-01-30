import debug from "debug";
import { ConfigDocument, ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import {
  BackupConfig,
  EnvironmentBackupConfig
} from "../../../projects/ngx-ramblers/src/app/models/backup-session.model";
import { envConfig } from "../env-config/env-config";
import * as config from "../mongo/controllers/config";
import { initializeBackupConfig } from "./config-initializer";

const debugLog = debug(envConfig.logNamespace("backup-config"));
debugLog.enabled = true;

export async function configuredBackup(): Promise<BackupConfig> {
  try {
    const configDocument: ConfigDocument = await config.queryKey(ConfigKey.BACKUP);
    const backupConfig: BackupConfig = configDocument.value;
    debugLog("Loaded backup config from database");
    return backupConfig;
  } catch (error) {
    debugLog("No backup config found in database, using initialization from files");
    const initializedConfig = await initializeBackupConfig();
    return {
      environments: initializedConfig.environments
    };
  }
}

export function getEnvironmentConfig(backupConfig: BackupConfig, environmentName: string): EnvironmentBackupConfig | undefined {
  return backupConfig.environments?.find(env => env.environment === environmentName);
}
