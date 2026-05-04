import debug from "debug";
import { ConfigDocument, ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import {
  EnvironmentConfig as DbEnvironmentConfig,
  EnvironmentsConfig,
  FLYIO_DEFAULTS
} from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { EnvironmentSummary } from "../../../projects/ngx-ramblers/src/app/models/environment-setup.model";
import { envConfig } from "../env-config/env-config";
import * as config from "../mongo/controllers/config";
import { connect as connectToDatabase } from "../mongo/mongoose-client";
import type { EnvironmentConfig as DeployEnvironmentConfig } from "../../deploy/types";

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

export async function configuredEnvironments(): Promise<EnvironmentsConfig> {
  const dbConfig = await loadFromDatabase();
  if (dbConfig) {
    return dbConfig;
  }
  throw new Error("No environments configuration found in database. Configure environments via /admin/environment-management before running deployment commands.");
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

export async function upsertEnvironmentInDatabase(envUpdate: DbEnvironmentConfig): Promise<void> {
  await connectToDatabase(debugLog);
  const existingDoc = await config.queryKey(ConfigKey.ENVIRONMENTS);
  const existing: EnvironmentsConfig = existingDoc?.value || { environments: [] };
  const environments = existing.environments || [];
  const idx = environments.findIndex(e => e.environment === envUpdate.environment);
  if (idx >= 0) {
    environments[idx] = { ...environments[idx], ...envUpdate, flyio: { ...(environments[idx].flyio || {}), ...(envUpdate.flyio || {}) } };
  } else {
    environments.push(envUpdate);
  }
  await config.createOrUpdateKey(ConfigKey.ENVIRONMENTS, { ...existing, environments });
  debugLog("Upserted environment in database:", envUpdate.environment);
}

export async function removeEnvironmentFromDatabase(environmentName: string): Promise<boolean> {
  await connectToDatabase(debugLog);
  const existingDoc = await config.queryKey(ConfigKey.ENVIRONMENTS);
  const existing: EnvironmentsConfig = existingDoc?.value || { environments: [] };
  const environments = (existing.environments || []).filter(e => e.environment !== environmentName);
  if (environments.length === (existing.environments || []).length) {
    debugLog("Environment not found for removal:", environmentName);
    return false;
  }
  await config.createOrUpdateKey(ConfigKey.ENVIRONMENTS, { ...existing, environments });
  debugLog("Removed environment from database:", environmentName);
  return true;
}
