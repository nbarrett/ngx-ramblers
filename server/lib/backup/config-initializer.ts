import debug from "debug";
import * as fs from "fs/promises";
import * as path from "path";
import { envConfig } from "../env-config/env-config";
import type {
  BackupConfig,
  EnvironmentBackupConfig
} from "../../../projects/ngx-ramblers/src/app/models/backup-session.model";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import * as config from "../mongo/controllers/config";

const debugLog = debug(envConfig.logNamespace("config-initializer"));
debugLog.enabled = false;

interface ParsedSecrets {
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  AWS_BUCKET?: string;
  AWS_REGION?: string;
  MONGODB_URI?: string;
  AUTH_SECRET?: string;
}

async function parseEnvFile(filePath: string): Promise<ParsedSecrets> {
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

function extractMongoConfig(mongoUri: string): { cluster: string; db: string; username: string; password: string } | null {
  try {
    const match = mongoUri.match(/^mongodb(?:\+srv)?:\/\/([^:]+):([^@]+)@([^\/]+)\/([^?]+)/);
    if (!match) {
      debugLog("Could not parse MongoDB URI");
      return null;
    }

    const [, username, password, host, db] = match;
    const cluster = host.replace(".mongodb.net", "");

    return {
      cluster,
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
  const secretsBasePath = path.resolve(__dirname, "../../../non-vcs/secrets");

  try {
    const envsConfigDoc = await config.queryKey(ConfigKey.ENVIRONMENTS);
    const seedEnvironments: EnvironmentBackupConfig[] = envsConfigDoc?.value?.environments || [];

    if (seedEnvironments.length === 0) {
      debugLog("No environments found in database to enrich with secrets files");
      return { environments: [] };
    }

    const environmentBackupConfigs: EnvironmentBackupConfig[] = [];

    for (const env of seedEnvironments) {
      const appName = env.flyio?.appName || `ngx-ramblers-${env.environment}`;
      const secretFileName = env.environment === "staging"
        ? "secrets.ngx-ramblers.env"
        : `secrets.${appName}.env`;
      const secretFilePath = path.join(secretsBasePath, secretFileName);

      const secrets = await parseEnvFile(secretFilePath);

      const envBackupConfig: EnvironmentBackupConfig = {
        environment: env.environment,
        flyio: env.flyio
      };

      if (secrets.AWS_BUCKET && secrets.AWS_REGION) {
        envBackupConfig.aws = {
          bucket: secrets.AWS_BUCKET,
          region: secrets.AWS_REGION,
          accessKeyId: secrets.AWS_ACCESS_KEY_ID,
          secretAccessKey: secrets.AWS_SECRET_ACCESS_KEY
        };
      } else if (env.aws) {
        envBackupConfig.aws = env.aws;
      }

      if (secrets.MONGODB_URI) {
        const mongoConfig = extractMongoConfig(secrets.MONGODB_URI);
        if (mongoConfig) {
          envBackupConfig.mongo = mongoConfig;
        }
      } else if (env.mongo) {
        envBackupConfig.mongo = env.mongo;
      }

      environmentBackupConfigs.push(envBackupConfig);
      debugLog(`Initialized config for environment: ${env.environment}`);
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

export async function initializeAndMergeBackupConfig(): Promise<BackupConfig> {
  const fromFiles = await initializeBackupConfig();
  const fileEnvironments = fromFiles.environments || [];

  let existingEnvironments: EnvironmentBackupConfig[] = [];
  try {
    const envsConfigDoc = await config.queryKey(ConfigKey.ENVIRONMENTS);
    existingEnvironments = envsConfigDoc?.value?.environments || [];
    debugLog("Found ENVIRONMENTS config with", existingEnvironments.length, "environments");
  } catch {
    debugLog("No ENVIRONMENTS config found");
  }

  const fileEnvNames = new Set(fileEnvironments.map(e => e.environment));
  const existingEnvNames = new Set(existingEnvironments.map(e => e.environment));

  const mergedEnvironments: EnvironmentBackupConfig[] = [];
  const addedFromFiles: string[] = [];
  const updatedFromFiles: string[] = [];
  const keptFromDatabase: string[] = [];

  fileEnvironments.forEach(fileEnv => {
    if (existingEnvNames.has(fileEnv.environment)) {
      mergedEnvironments.push(fileEnv);
      updatedFromFiles.push(fileEnv.environment);
    } else {
      mergedEnvironments.push(fileEnv);
      addedFromFiles.push(fileEnv.environment);
    }
  });

  existingEnvironments.forEach(existingEnv => {
    if (!fileEnvNames.has(existingEnv.environment)) {
      mergedEnvironments.push(existingEnv);
      keptFromDatabase.push(existingEnv.environment);
    }
  });

  debugLog("Merge result:", {
    total: mergedEnvironments.length,
    addedFromFiles,
    updatedFromFiles,
    keptFromDatabase
  });

  return {
    environments: mergedEnvironments,
    aws: fromFiles.aws,
    secrets: fromFiles.secrets
  };
}
