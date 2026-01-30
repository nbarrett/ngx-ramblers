import debug from "debug";
import { ConfigDocument, ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { EnvironmentsConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { envConfig } from "../env-config/env-config";
import * as config from "../mongo/controllers/config";
import { initializeBackupConfig } from "../backup/config-initializer";

const debugLog = debug(envConfig.logNamespace("environments-config"));
debugLog.enabled = true;

export async function configuredEnvironments(): Promise<EnvironmentsConfig> {
  const configDocument: ConfigDocument = await config.queryKey(ConfigKey.ENVIRONMENTS);
  if (configDocument?.value?.environments?.length) {
    debugLog("Loaded environments config from ENVIRONMENTS:", configDocument.value.environments.length, "environments");
    return configDocument.value;
  }

  debugLog("No environments in ENVIRONMENTS config, trying BACKUP fallback");
  const backupConfigDoc: ConfigDocument = await config.queryKey(ConfigKey.BACKUP);
  if (backupConfigDoc?.value?.environments?.length) {
    const backupConfig = backupConfigDoc.value;
    const environmentsConfig: EnvironmentsConfig = {
      environments: backupConfig.environments,
      aws: backupConfig.aws,
      secrets: backupConfig.secrets
    };
    debugLog("Using BACKUP config as fallback:", environmentsConfig.environments?.length, "environments");
    return environmentsConfig;
  }

  debugLog("No environments in database, using file-based initialization as last resort");
  const initializedConfig = await initializeBackupConfig();
  return {
    environments: initializedConfig.environments?.map(env => ({
      environment: env.environment,
      aws: env.aws,
      mongo: env.mongo,
      flyio: env.flyio,
      secrets: env.secrets
    })) || [],
    aws: initializedConfig.aws,
    secrets: initializedConfig.secrets
  };
}
