import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { parseMongoUri } from "../shared/mongodb-uri";
import { configuredEnvironments } from "../environments/environments-config";
import { FlyRuntimeConfig, FlySecureConfig } from "./fly.model";
import { decryptJsonConfig } from "../shared/config-crypto";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import { FlyTargetApp } from "../../../projects/ngx-ramblers/src/app/models/health.model";

const debugLog = debug(envConfig.logNamespace("fly:runtime-config"));
debugLog.enabled = true;

const databaseFallbackCache: { value?: FlyRuntimeConfig } = {};
const workerFallbackCache: { value?: FlyRuntimeConfig } = {};

export async function flyRuntimeConfig(target: FlyTargetApp = FlyTargetApp.ENVIRONMENT): Promise<FlyRuntimeConfig> {
  if (target === FlyTargetApp.WORKER) {
    return workerFallback();
  }
  const fromEnv = envConfig.fly();
  if (fromEnv.apiToken && fromEnv.appName && fromEnv.metricsToken) {
    return fromEnv;
  }
  const fromBundle = encryptedBundleConfig();
  const withBundle: FlyRuntimeConfig = {
    ...fromEnv,
    apiToken: fromEnv.apiToken || fromBundle?.apiToken || "",
    appName: fromEnv.appName || fromBundle?.appName || "",
    metricsToken: fromEnv.metricsToken || fromBundle?.metricsToken || ""
  };
  if (withBundle.apiToken && withBundle.appName && withBundle.metricsToken) {
    return withBundle;
  }
  const fromDatabase = await databaseFallback();
  return {
    ...withBundle,
    apiToken: withBundle.apiToken || fromDatabase.apiToken,
    appName: withBundle.appName || fromDatabase.appName,
    metricsToken: withBundle.metricsToken || fromDatabase.metricsToken
  };
}

function encryptedBundleConfig(): FlySecureConfig | null {
  const encrypted = envConfig.value(Environment.FLY_CONFIG);
  const encryptionKey = envConfig.value(Environment.ENVIRONMENT_SETUP_API_KEY);
  if (!encrypted || !encryptionKey) {
    return null;
  }
  try {
    debugLog("Decrypting fly config from FLY_CONFIG env var");
    return decryptJsonConfig<FlySecureConfig>(encrypted, encryptionKey);
  } catch (error) {
    debugLog("Failed to decrypt FLY_CONFIG:", error);
    return null;
  }
}

async function databaseFallback(): Promise<FlyRuntimeConfig> {
  if (databaseFallbackCache.value) {
    return databaseFallbackCache.value;
  }
  const empty: FlyRuntimeConfig = {apiToken: "", appName: "", machineId: "", organisation: "", metricsToken: ""};
  try {
    const parsedMongo = parseMongoUri(envConfig.mongo().uri);
    const databaseName = parsedMongo?.database || "";
    const environmentName = databaseName.replace(/^ngx-ramblers-?/, "") || "staging";
    const environmentsConfig = await configuredEnvironments();
    const dbEnv = environmentsConfig.environments?.find(environment => environment.mongo?.db === databaseName)
      || environmentsConfig.environments?.find(environment => environment.environment === environmentName);
    databaseFallbackCache.value = dbEnv?.flyio ? {
      ...empty,
      apiToken: dbEnv.flyio.apiKey || "",
      appName: dbEnv.flyio.appName || "",
      metricsToken: dbEnv.flyio.metricsToken || ""
    } : empty;
    debugLog(`Resolved fly config for database ${databaseName} (environment ${dbEnv?.environment || "(unmatched)"}) from environments config: appName ${databaseFallbackCache.value.appName || "(none)"}`);
  } catch (error) {
    debugLog("Fly config fallback from environments config failed:", error);
    databaseFallbackCache.value = empty;
  }
  return databaseFallbackCache.value;
}

async function workerFallback(): Promise<FlyRuntimeConfig> {
  if (workerFallbackCache.value) {
    return workerFallbackCache.value;
  }
  const empty: FlyRuntimeConfig = {apiToken: "", appName: "", machineId: "", organisation: "", metricsToken: ""};
  try {
    const environmentsConfig = await configuredEnvironments();
    const uploadWorker = environmentsConfig.uploadWorker;
    workerFallbackCache.value = uploadWorker?.apiKey ? {
      ...empty,
      apiToken: uploadWorker.apiKey,
      appName: uploadWorker.appName || "ngx-ramblers-integration-worker"
    } : empty;
    debugLog(`Resolved integration worker fly config from environments config: appName ${workerFallbackCache.value.appName || "(none)"}`);
  } catch (error) {
    debugLog("Integration worker fly config resolution failed:", error);
    workerFallbackCache.value = empty;
  }
  return workerFallbackCache.value;
}
