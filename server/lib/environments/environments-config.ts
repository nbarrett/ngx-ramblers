import fs from "fs";
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
import { resolveClientPath } from "../shared/path-utils";

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

const LOCAL_ENVIRONMENTS_MANIFEST = "environments.local.json";

function loadFromLocalManifest(): EnvironmentsConfig | null {
  const manifestPath = resolveClientPath("non-vcs/secrets", LOCAL_ENVIRONMENTS_MANIFEST);
  if (!fs.existsSync(manifestPath)) {
    debugLog("No local environments manifest at %s", manifestPath);
    return null;
  } else {
    try {
      const parsed: EnvironmentsConfig = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      if (parsed?.environments?.length) {
        debugLog("Loaded environments config from local manifest %s: %d environments", manifestPath, parsed.environments.length);
        return parsed;
      } else {
        debugLog("Local environments manifest %s contains no environments", manifestPath);
        return null;
      }
    } catch (error) {
      debugLog("Failed to parse local environments manifest %s: %s", manifestPath, error.message);
      return null;
    }
  }
}

function sortEnvironments(config: EnvironmentsConfig): EnvironmentsConfig {
  if (config.environments) {
    return { ...config, environments: [...config.environments].sort((a, b) => a.environment.localeCompare(b.environment)) };
  } else {
    return config;
  }
}

export async function configuredEnvironments(): Promise<EnvironmentsConfig> {
  const dbConfig = await loadFromDatabase();
  if (dbConfig) {
    return sortEnvironments(dbConfig);
  } else {
    const localConfig = loadFromLocalManifest();
    if (localConfig) {
      return sortEnvironments(localConfig);
    } else {
      throw new Error("No environments configuration found in database or local manifest. Configure environments via /admin/environment-management, or add non-vcs/secrets/environments.local.json for offline development.");
    }
  }
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
