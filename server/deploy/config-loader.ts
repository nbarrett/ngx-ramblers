import type { EnvironmentConfig, MongoConfig } from "./types.js";
import { FLYIO_DEFAULTS } from "./types.js";
import type { AwsConfig } from "../../projects/ngx-ramblers/src/app/models/environment-config.model";
import type { BackupConfig } from "../../projects/ngx-ramblers/src/app/models/backup-session.model";
import { configuredBackup } from "../lib/backup/backup-config.js";

async function loadBackupConfigFromDB(): Promise<BackupConfig | null> {
  try {
    return await configuredBackup();
  } catch {
    return null;
  }
}

function transformBackupConfigToEnvironmentConfigs(backupConfig: BackupConfig): EnvironmentConfig[] {
  return (backupConfig.environments || []).map(env => {
    const mongoConfig: MongoConfig | undefined = env.mongo ? {
      cluster: env.mongo.cluster || "",
      db: env.mongo.db || "",
      username: env.mongo.username || "",
      password: env.mongo.password || ""
    } : undefined;

    return {
      name: env.environment,
      apiKey: env.flyio?.apiKey || "",
      appName: env.flyio?.appName || "",
      memory: env.flyio?.memory || FLYIO_DEFAULTS.MEMORY,
      scaleCount: env.flyio?.scaleCount || FLYIO_DEFAULTS.SCALE_COUNT,
      organisation: env.flyio?.organisation,
      mongo: mongoConfig
    };
  });
}

export async function loadConfigs(): Promise<EnvironmentConfig[]> {
  const dbConfig = await loadBackupConfigFromDB();

  if (dbConfig && dbConfig.environments && dbConfig.environments.length > 0) {
    return transformBackupConfigToEnvironmentConfigs(dbConfig);
  }

  throw new Error("No environments configuration found in database. Configure environments via /admin/environment-management before running deployment commands.");
}

export async function getAwsConfigForEnvironment(envName: string): Promise<AwsConfig | undefined> {
  const dbConfig = await loadBackupConfigFromDB();
  if (!dbConfig?.environments) {
    return undefined;
  }
  const envConfig = dbConfig.environments.find(e => e.environment === envName);
  return envConfig?.aws;
}
