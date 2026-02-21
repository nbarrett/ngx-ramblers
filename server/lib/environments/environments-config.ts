import debug from "debug";
import { ConfigDocument, ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import {
  EnvironmentsConfig,
  FLYIO_DEFAULTS
} from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { EnvironmentSummary } from "../../../projects/ngx-ramblers/src/app/models/environment-setup.model";
import { envConfig } from "../env-config/env-config";
import * as config from "../mongo/controllers/config";
import { connect as connectToDatabase } from "../mongo/mongoose-client";
import { initializeBackupConfig } from "../backup/config-initializer";
import { confirm, handleQuit, isQuit } from "../cli/cli-prompt";
import type { EnvironmentConfig as DeployEnvironmentConfig } from "../../deploy/types";
import { cliLogger } from "../cli/cli-logger";

const debugLog = debug(envConfig.logNamespace("environments-config"));
debugLog.enabled = true;

async function loadFromDatabase(): Promise<EnvironmentsConfig | null> {
  try {
    debugLog("Connecting to database...");
    await connectToDatabase(debugLog);
    debugLog("Database connection established, querying environments config...");

    const configDocument: ConfigDocument = await config.queryKey(ConfigKey.ENVIRONMENTS);
    if (configDocument?.value?.environments?.length) {
      debugLog("Loaded environments config from ENVIRONMENTS:", configDocument.value.environments.length, "environments");
      return configDocument.value;
    }

    return null;
  } catch (error) {
    debugLog("Database query failed:", error.message);
    return null;
  }
}

async function loadFromFiles(): Promise<EnvironmentsConfig> {
  debugLog("Loading environments from file-based initialization");
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

export async function configuredEnvironments(): Promise<EnvironmentsConfig> {
  const dbConfig = await loadFromDatabase();
  if (dbConfig) {
    return dbConfig;
  }

  debugLog("WARNING: No environments found in database - this is unusual and may indicate a problem");
  cliLogger.log("\n⚠️  WARNING: Could not load environments from database.");
  cliLogger.log("   This is unusual and may indicate a configuration or connection problem.");

  if (!process.stdin.isTTY) {
    cliLogger.log("   Non-interactive mode detected. Exiting without fallback.");
    cliLogger.log("   Please check your database connection and configuration.\n");
    process.exit(1);
  }

  cliLogger.log("   Would you like to fall back to the file-based configs.json?\n");

  const result = await confirm("Fall back to file-based configuration?", false);

  if (isQuit(result)) {
    handleQuit();
  }

  if (result === true) {
    debugLog("User approved fallback to file-based initialization");
    return loadFromFiles();
  }

  cliLogger.log("\nExiting. Please check your database connection and configuration.");
  process.exit(1);
}

export async function findEnvironmentFromDatabase(environmentName: string): Promise<DeployEnvironmentConfig | null> {
  const environmentsConfig = await configuredEnvironments();
  const dbEnv = environmentsConfig.environments?.find(e => e.environment === environmentName);

  if (!dbEnv) {
    debugLog("Environment not found in database:", environmentName);
    return null;
  }

  debugLog("Found environment in database:", environmentName);
  return {
    name: dbEnv.environment,
    appName: dbEnv.flyio?.appName || `ngx-ramblers-${dbEnv.environment}`,
    apiKey: dbEnv.flyio?.apiKey || "",
    memory: dbEnv.flyio?.memory || FLYIO_DEFAULTS.MEMORY,
    scaleCount: dbEnv.flyio?.scaleCount || FLYIO_DEFAULTS.SCALE_COUNT,
    organisation: dbEnv.flyio?.organisation || FLYIO_DEFAULTS.ORGANISATION,
    mongo: dbEnv.mongo ? {
      cluster: dbEnv.mongo.cluster || "",
      db: dbEnv.mongo.db || "",
      username: dbEnv.mongo.username || "",
      password: dbEnv.mongo.password || ""
    } : undefined
  };
}

export async function listEnvironmentSummariesFromDatabase(): Promise<EnvironmentSummary[]> {
  const environmentsConfig = await configuredEnvironments();
  debugLog("Listing environment summaries from database:", environmentsConfig.environments?.length || 0, "environments");

  return (environmentsConfig.environments || []).map(env => ({
    name: env.environment,
    appName: env.flyio?.appName || `ngx-ramblers-${env.environment}`,
    memory: env.flyio?.memory || FLYIO_DEFAULTS.MEMORY,
    scaleCount: env.flyio?.scaleCount || FLYIO_DEFAULTS.SCALE_COUNT,
    organisation: env.flyio?.organisation || FLYIO_DEFAULTS.ORGANISATION,
    hasApiKey: Boolean(env.flyio?.apiKey)
  }));
}

export async function environmentsConfigFromDatabase(): Promise<EnvironmentsConfig | null> {
  return loadFromDatabase();
}
