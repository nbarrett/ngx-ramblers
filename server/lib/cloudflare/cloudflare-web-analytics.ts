import debug from "debug";
import { createErrorDebugLog } from "../shared/error-debug-log";
import { CloudflareConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { CloudflareRumSite } from "../../../projects/ngx-ramblers/src/app/models/cloudflare-web-analytics.model";
import { cloudflareApi, CloudflareResponse } from "./cloudflare.model";
import { envConfig } from "../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("cloudflare:web-analytics:sites"));
debugLog.enabled = true;
const errorDebugLog = createErrorDebugLog("cloudflare:web-analytics:sites");

function headers(apiToken: string): Record<string, string> {
  return {
    "Authorization": `Bearer ${apiToken}`,
    "Content-Type": "application/json"
  };
}

function failure(action: string, data: CloudflareResponse<unknown>): never {
  const errorMsg = data.errors?.map(error => error.message).join(", ") || "unknown error";
  errorDebugLog("Failed to %s: %s", action, errorMsg);
  throw new Error(`Failed to ${action}: ${errorMsg}`);
}

export async function createRumSite(cloudflareConfig: CloudflareConfig, host: string, autoInstall: boolean): Promise<CloudflareRumSite> {
  const url = cloudflareApi.accountRumSites(cloudflareConfig.accountId);
  debugLog("Creating RUM site for host: %s autoInstall=%s", host, autoInstall);
  const response = await fetch(url, {
    method: "POST",
    headers: headers(cloudflareConfig.apiToken),
    body: JSON.stringify({host, auto_install: autoInstall})
  });
  const data: CloudflareResponse<CloudflareRumSite> = await response.json();
  if (!data.success) {
    failure(`create Web Analytics site for ${host}`, data);
  }
  debugLog("RUM site created: site_tag=%s", data.result.site_tag);
  return data.result;
}
