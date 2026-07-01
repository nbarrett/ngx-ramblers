import debug from "debug";
import { CloudflareConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { envConfig } from "../env-config/env-config";
import { decryptJsonConfig, encryptJsonConfig } from "../shared/config-crypto";

const debugLog = debug(envConfig.logNamespace("cloudflare-crypto"));

export function encryptCloudflareConfig(config: CloudflareConfig, encryptionKey: string): string {
  const encrypted = encryptJsonConfig(config, encryptionKey);
  debugLog("Encrypted cloudflare config (%d bytes encrypted base64)", encrypted.length);
  return encrypted;
}

export function decryptCloudflareConfig(encryptedBase64: string, encryptionKey: string): CloudflareConfig {
  const config = decryptJsonConfig<CloudflareConfig>(encryptedBase64, encryptionKey);
  debugLog("Decrypted cloudflare config for domain:", config.baseDomain);
  return config;
}
