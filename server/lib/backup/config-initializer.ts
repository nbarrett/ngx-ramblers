import debug from "debug";
import * as fs from "fs/promises";
import * as path from "path";
import { envConfig } from "../env-config/env-config";
import type { EnvironmentConfig } from "../../deploy/types";
import type { EnvironmentBackupConfig, BackupConfig } from "../../../projects/ngx-ramblers/src/app/models/backup-session.model";

const debugLog = debug(envConfig.logNamespace("config-initializer"));
debugLog.enabled = true;

interface ParsedSecrets {
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  AWS_BUCKET?: string;
  AWS_REGION?: string;
  MONGODB_URI?: string;
  AUTH_SECRET?: string;
}

export async function parseEnvFile(filePath: string): Promise<ParsedSecrets> {
  try {
    const content = await fs.readFile(filePath, "utf8");
    const secrets: ParsedSecrets = {};

    const lines = content.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();

        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }

        if (key === "AWS_ACCESS_KEY_ID" || key === "AWS_SECRET_ACCESS_KEY" ||
            key === "AWS_BUCKET" || key === "AWS_REGION" ||
            key === "MONGODB_URI" || key === "AUTH_SECRET") {
          secrets[key] = value;
        }
      }
    }

    return secrets;
  } catch (error) {
    debugLog(`Error reading env file ${filePath}:`, error.message);
    return {};
  }
}

export function extractMongoConfig(mongoUri: string): { uri: string; db: string; username: string; password: string } | null {
  try {
    const match = mongoUri.match(/^mongodb(?:\+srv)?:\/\/([^:]+):([^@]+)@([^\/]+)\/([^?]+)/);
    if (!match) {
      debugLog("Could not parse MongoDB URI");
      return null;
    }

    const [, username, password, , db] = match;

    return {
      uri: mongoUri,
      db: db.split("?")[0],
      username,
      password
    };
  } catch (error) {
    debugLog("Error parsing MongoDB URI:", error.message);
    return null;
  }
}

export async function initializeBackupConfig(): Promise<BackupConfig> {
  const configsPath = path.join(process.cwd(), "../non-vcs/fly-io/configs.json");
  const secretsBasePath = path.join(process.cwd(), "../non-vcs/secrets");

  try {
    const configsRaw = await fs.readFile(configsPath, "utf8");
    const configsData = JSON.parse(configsRaw);
    const environments: EnvironmentConfig[] = configsData.environments;

    const environmentBackupConfigs: EnvironmentBackupConfig[] = [];

    for (const env of environments) {
      const secretFileName = env.name === "staging"
        ? "secrets.ngx-ramblers.env"
        : `secrets.ngx-ramblers-${env.name}.env`;
      const secretFilePath = path.join(secretsBasePath, secretFileName);

      const secrets = await parseEnvFile(secretFilePath);

      const envBackupConfig: EnvironmentBackupConfig = {
        environment: env.name,
        flyio: {
          apiKey: env.apiKey,
          appName: env.appName,
          memory: env.memory,
          scaleCount: env.scaleCount,
          organisation: env.organisation
        }
      };

      if (secrets.AWS_BUCKET && secrets.AWS_REGION) {
        envBackupConfig.aws = {
          bucket: secrets.AWS_BUCKET,
          region: secrets.AWS_REGION,
          accessKeyId: secrets.AWS_ACCESS_KEY_ID,
          secretAccessKey: secrets.AWS_SECRET_ACCESS_KEY
        };
      }

      if (secrets.MONGODB_URI) {
        const mongoConfig = extractMongoConfig(secrets.MONGODB_URI);
        if (mongoConfig) {
          envBackupConfig.mongo = mongoConfig;
        }
      }

      environmentBackupConfigs.push(envBackupConfig);
      debugLog(`Initialized config for environment: ${env.name}`);
    }

    const backupConfig: BackupConfig = {
      environments: environmentBackupConfigs
    };

    debugLog(`Initialized backup config for ${environmentBackupConfigs.length} environments`);
    return backupConfig;

  } catch (error) {
    debugLog("Error initializing backup config:", error.message);
    throw new Error(`Failed to initialize backup config: ${error.message}`);
  }
}
