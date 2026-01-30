import * as fs from "fs/promises";
import * as path from "path";
import type { EnvironmentConfig, MongoConfig } from "./types.js";
import { FLYIO_DEFAULTS } from "./types.js";
import type { BackupConfig } from "../../projects/ngx-ramblers/src/app/models/backup-session.model";
import { configuredBackup } from "../lib/backup/backup-config.js";

async function loadBackupConfigFromDB(): Promise<BackupConfig | null> {
  try {
    return await configuredBackup();
  } catch {
    return null;
  }
}

async function loadConfigsFromFiles(): Promise<EnvironmentConfig[]> {
  const configsPath = path.join(process.cwd(), "../non-vcs/fly-io/configs.json");
  const configsRaw = await fs.readFile(configsPath, "utf8");
  return JSON.parse(configsRaw).environments;
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

  return await loadConfigsFromFiles();
}

export async function getAwsConfigForEnvironment(envName: string): Promise<{ bucket?: string; region?: string; accessKeyId?: string; secretAccessKey?: string } | undefined> {
  const dbConfig = await loadBackupConfigFromDB();

  if (dbConfig && dbConfig.environments) {
    const envConfig = dbConfig.environments.find(e => e.environment === envName);
    return envConfig?.aws;
  }

  return undefined;
}
