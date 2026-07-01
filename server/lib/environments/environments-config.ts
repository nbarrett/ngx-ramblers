import fs from "fs";
import debug from "debug";
import { ConfigDocument, ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import {
  EnvironmentConfig as DbEnvironmentConfig,
  EnvironmentsConfig,
  FLYIO_DEFAULTS
} from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { EnvironmentSummary } from "../../../projects/ngx-ramblers/src/app/models/environment-setup.model";
import { MongoClient } from "mongodb";
import { envConfig } from "../env-config/env-config";
import * as config from "../mongo/controllers/config";
import { connect as connectToDatabase } from "../mongo/mongoose-client";
import type { EnvironmentConfig as DeployEnvironmentConfig } from "../../deploy/types";
import { resolveClientPath } from "../shared/path-utils";
import { parseMongoUri } from "../shared/mongodb-uri";

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

function readServerEnvMongoUri(): string | null {
  try {
    const envPath = resolveClientPath("server", ".env");
    if (!fs.existsSync(envPath)) {
      return null;
    }
    const line = fs.readFileSync(envPath, "utf-8").split(/\r?\n/).find(entry => entry.startsWith("MONGODB_URI="));
    return line ? line.substring("MONGODB_URI=".length).trim().replace(/^["']|["']$/g, "") : null;
  } catch (error) {
    debugLog("Failed to read server/.env MONGODB_URI:", error.message);
    return null;
  }
}

async function loadFromStagingEnvFile(): Promise<EnvironmentsConfig | null> {
  const stagingUri = readServerEnvMongoUri();
  if (!stagingUri) {
    return null;
  }
  const client = await MongoClient.connect(stagingUri).catch(error => {
    debugLog("Staging env-file connection failed:", error.message);
    return null;
  });
  if (!client) {
    return null;
  }
  try {
    const doc = await client.db(parseMongoUri(stagingUri)?.database).collection("config").findOne({ key: ConfigKey.ENVIRONMENTS });
    const value = doc?.value as EnvironmentsConfig | undefined;
    if (value?.environments?.length) {
      debugLog("Loaded environments config from server/.env staging connection: %d environments", value.environments.length);
      return value;
    }
    return null;
  } catch (error) {
    debugLog("Staging env-file environments query failed:", error.message);
    return null;
  } finally {
    await client.close();
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
  }
  const stagingConfig = await loadFromStagingEnvFile();
  if (stagingConfig) {
    return sortEnvironments(stagingConfig);
  }
  const localConfig = loadFromLocalManifest();
  if (localConfig) {
    return sortEnvironments(localConfig);
  }
  throw new Error("No environments configuration found in database or local manifest. Configure environments via /admin/environment-management, or add non-vcs/secrets/environments.local.json for offline development.");
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

export async function persistEnvironmentSecret(environmentName: string, key: string, value: string): Promise<void> {
  await connectToDatabase(debugLog);
  const existingDoc = await config.queryKey(ConfigKey.ENVIRONMENTS);
  const existing: EnvironmentsConfig = existingDoc?.value || { environments: [] };
  const environments = existing.environments || [];
  const idx = environments.findIndex(e => e.environment === environmentName);
  if (idx < 0) {
    throw new Error(`Cannot persist secret ${key}: environment ${environmentName} not found in ENVIRONMENTS config`);
  }
  environments[idx] = {
    ...environments[idx],
    secrets: { ...(environments[idx].secrets || {}), [key]: value }
  };
  await config.createOrUpdateKey(ConfigKey.ENVIRONMENTS, { ...existing, environments });
  debugLog("Persisted secret %s for environment: %s", key, environmentName);
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
