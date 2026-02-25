import debug from "debug";
import { ConfigDocument, ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { CloudflareConfig, EnvironmentsConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { envConfig } from "../env-config/env-config";
import { Environment } from "../env-config/environment-model";
import { NonSensitiveCloudflareConfig } from "./cloudflare.model";
import { decryptCloudflareConfig } from "./cloudflare-crypto";
import { systemConfig } from "../config/system-config";
import * as config from "../mongo/controllers/config";

const debugLog = debug(envConfig.logNamespace("cloudflare-config"));
debugLog.enabled = true;


function fromEncryptedEnvVar(): CloudflareConfig | null {
  const encrypted = envConfig.value(Environment.CLOUDFLARE_CONFIG);
  const encryptionKey = envConfig.value(Environment.ENVIRONMENT_SETUP_API_KEY);
  if (encrypted && encryptionKey) {
    debugLog("Decrypting cloudflare config from CLOUDFLARE_CONFIG env var");
    return decryptCloudflareConfig(encrypted, encryptionKey);
  }
  return null;
}

async function fromDatabase(): Promise<CloudflareConfig | null> {
  const configDocument: ConfigDocument = await config.queryKey(ConfigKey.ENVIRONMENTS);
  const environmentsConfig: EnvironmentsConfig = configDocument?.value;
  if (environmentsConfig?.cloudflare) {
    debugLog("cloudflare config from database:", environmentsConfig.cloudflare);
    return environmentsConfig.cloudflare;
  }
  return null;
}

export async function configuredCloudflare(): Promise<CloudflareConfig> {
  const envVarConfig = fromEncryptedEnvVar();
  if (envVarConfig) {
    return envVarConfig;
  }
  const dbConfig = await fromDatabase();
  if (dbConfig) {
    return dbConfig;
  }
  throw new Error("No Cloudflare configuration found in env var or database");
}

async function baseDomainFromSystemConfig(): Promise<string> {
  try {
    const sysConfig = await systemConfig();
    if (sysConfig?.group?.href) {
      const hostname = new URL(sysConfig.group.href).hostname;
      return hostname.replace(/^www\./, "");
    }
  } catch (err) {
    debugLog("Could not derive baseDomain from system config:", err.message);
  }
  return "";
}

export async function nonSensitiveCloudflareConfig(): Promise<NonSensitiveCloudflareConfig> {
  try {
    const cloudflareConfig = await configuredCloudflare();
    const baseDomain = await baseDomainFromSystemConfig() || cloudflareConfig.baseDomain;
    return {
      configured: true,
      accountId: cloudflareConfig.accountId,
      zoneId: cloudflareConfig.zoneId,
      baseDomain
    };
  } catch (err) {
    debugLog("Cloudflare not configured:", err.message);
    return {configured: false};
  }
}
