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
const jitsiFallbackCache: { value?: FlyRuntimeConfig } = {};
const emptyFlyConfig: FlyRuntimeConfig = {apiToken: "", appName: "", machineId: "", organisation: ""};

export async function flyRuntimeConfig(
  target: FlyTargetApp = FlyTargetApp.ENVIRONMENT,
  environmentName: string | null = null
): Promise<FlyRuntimeConfig> {
  if (target === FlyTargetApp.WORKER) {
    return workerFallback();
  } else if (target === FlyTargetApp.JITSI) {
    return jitsiFallback();
  } else if (environmentName) {
    return namedEnvironmentFallback(environmentName);
  } else {
    return currentEnvironmentConfig();
  }
}

async function currentEnvironmentConfig(): Promise<FlyRuntimeConfig> {
  const fromEnv = envConfig.fly();
  if (fromEnv.apiToken && fromEnv.appName) {
    return fromEnv;
  } else {
    const fromBundle = encryptedBundleConfig();
    const withBundle: FlyRuntimeConfig = {
      ...fromEnv,
      apiToken: fromEnv.apiToken || fromBundle?.apiToken || "",
      appName: fromEnv.appName || fromBundle?.appName || ""
    };
    if (withBundle.apiToken && withBundle.appName) {
      return withBundle;
    } else {
      const fromDatabase = await databaseFallback();
      return {
        ...withBundle,
        apiToken: withBundle.apiToken || fromDatabase.apiToken,
        appName: withBundle.appName || fromDatabase.appName
      };
    }
  }
}

let integrationWorkerAvailableCache: boolean | undefined;
let jitsiAvailableCache: boolean | undefined;

export async function isIntegrationWorkerAvailable(): Promise<boolean> {
  if (integrationWorkerAvailableCache === undefined) {
    try {
      const config = await flyRuntimeConfig(FlyTargetApp.WORKER);
      integrationWorkerAvailableCache = !!(config.apiToken && config.appName);
    } catch {
      integrationWorkerAvailableCache = false;
    }
  }
  return integrationWorkerAvailableCache;
}

export async function isJitsiAvailable(): Promise<boolean> {
  if (jitsiAvailableCache === undefined) {
    try {
      const config = await flyRuntimeConfig(FlyTargetApp.JITSI);
      jitsiAvailableCache = !!(config.apiToken && config.appName);
    } catch {
      jitsiAvailableCache = false;
    }
  }
  return jitsiAvailableCache;
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

async function metricsToken(): Promise<string> {
  const current = await currentEnvironmentConfig();
  if (current.apiToken) {
    return current.apiToken;
  } else {
    const worker = await workerFallback();
    return worker.apiToken;
  }
}

async function databaseFallback(): Promise<FlyRuntimeConfig> {
  if (databaseFallbackCache.value) {
    return databaseFallbackCache.value;
  }
  const empty = emptyFlyConfig;
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
      appName: dbEnv.flyio.appName || ""
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
  try {
    const environmentsConfig = await configuredEnvironments();
    const uploadWorker = environmentsConfig.uploadWorker;
    workerFallbackCache.value = uploadWorker?.appName || uploadWorker?.apiKey ? {
      ...emptyFlyConfig,
      apiToken: uploadWorker.apiKey || "",
      appName: uploadWorker.appName || "ngx-ramblers-integration-worker"
    } : emptyFlyConfig;
    if (workerFallbackCache.value.appName && !workerFallbackCache.value.apiToken) {
      workerFallbackCache.value = {
        ...workerFallbackCache.value,
        apiToken: (await currentEnvironmentConfig()).apiToken
      };
    }
    debugLog(`Resolved integration worker fly config from environments config: appName ${workerFallbackCache.value.appName || "(none)"}`);
  } catch (error) {
    debugLog("Integration worker fly config resolution failed:", error);
    workerFallbackCache.value = emptyFlyConfig;
  }
  return workerFallbackCache.value;
}

async function jitsiFallback(): Promise<FlyRuntimeConfig> {
  if (jitsiFallbackCache.value) {
    return jitsiFallbackCache.value;
  } else {
    try {
      const environmentsConfig = await configuredEnvironments();
      const jitsi = environmentsConfig.jitsi;
      const appName = jitsi?.appName || "";
      jitsiFallbackCache.value = appName ? {
        ...emptyFlyConfig,
        apiToken: jitsi?.apiKey || "",
        appName
      } : emptyFlyConfig;
      if (jitsiFallbackCache.value.appName && !jitsiFallbackCache.value.apiToken) {
        jitsiFallbackCache.value = {
          ...jitsiFallbackCache.value,
          apiToken: await metricsToken()
        };
      }
      debugLog(`Resolved jitsi fly config from environments config: appName ${jitsiFallbackCache.value.appName || "(none)"}`);
    } catch (error) {
      debugLog("Jitsi fly config resolution failed:", error);
      jitsiFallbackCache.value = emptyFlyConfig;
    }
    return jitsiFallbackCache.value;
  }
}

async function namedEnvironmentFallback(environmentName: string): Promise<FlyRuntimeConfig> {
  try {
    const environmentsConfig = await configuredEnvironments();
    const named = (environmentsConfig.environments || []).find(environment => environment.environment === environmentName);
    const appName = named?.flyio?.appName || "";
    if (!appName) {
      debugLog(`No Fly app configured for environment ${environmentName}`);
      return emptyFlyConfig;
    } else {
      const apiToken = named.flyio?.apiKey || await metricsToken();
      debugLog(`Resolved fly config for named environment ${environmentName}: appName ${appName}`);
      return {...emptyFlyConfig, apiToken, appName};
    }
  } catch (error) {
    debugLog(`Named environment fly config resolution failed for ${environmentName}:`, error);
    return emptyFlyConfig;
  }
}
