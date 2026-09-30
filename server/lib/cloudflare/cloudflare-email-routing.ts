import debug from "debug";
import { CloudflareConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { EmailRoutingRule } from "../../../projects/ngx-ramblers/src/app/models/cloudflare-email-routing.model";
import { cloudflareApi, CloudflareResponse } from "./cloudflare.model";
import { envConfig } from "../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("cloudflare:email-routing"));
debugLog.enabled = true;

function baseUrl(zoneId: string): string {
  return cloudflareApi.zoneEmailRoutingRules(zoneId);
}

function headers(apiToken: string): Record<string, string> {
  return {
    "Authorization": `Bearer ${apiToken}`,
    "Content-Type": "application/json"
  };
}

export interface EmailRoutingSettings {
  enabled: boolean;
  name?: string;
  status?: string;
}

function cloudflareErrorMessage(data: {errors?: {code?: number; message?: string}[]}): string {
  return (data.errors || [])
    .map(item => item.code ? `${item.message} (${item.code})` : item.message)
    .filter(Boolean)
    .join(", ") || "Cloudflare request failed";
}

function authenticationHint(message: string): string {
  if (/authentication error/i.test(message)) {
    return `${message}. In Global Settings, give the Cloudflare API token Zone Settings Edit and Email Routing Rules Edit for all zones in the account, then try Enable incoming mail again.`;
  } else {
    return message;
  }
}

async function postEmailRouting(url: string, apiToken: string, body: object): Promise<CloudflareResponse<EmailRoutingSettings>> {
  const response = await fetch(url, {
    method: "POST",
    headers: headers(apiToken),
    body: JSON.stringify(body)
  });
  return response.json();
}

export async function getEmailRoutingSettings(cloudflareConfig: CloudflareConfig): Promise<EmailRoutingSettings> {
  const url = cloudflareApi.zoneEmailRouting(cloudflareConfig.zoneId);
  debugLog("Reading email routing settings for zone:", cloudflareConfig.zoneId);
  const response = await fetch(url, {headers: headers(cloudflareConfig.apiToken)});
  const data: CloudflareResponse<EmailRoutingSettings> = await response.json();
  if (!data.success || !data.result) {
    throw new Error(`Failed to read email routing settings: ${cloudflareErrorMessage(data)}`);
  } else {
    return data.result;
  }
}

export async function enableEmailRouting(cloudflareConfig: CloudflareConfig, zoneName?: string): Promise<EmailRoutingSettings> {
  debugLog("Enabling email routing for zone:", cloudflareConfig.zoneId);
  const dnsBody = zoneName ? {name: zoneName} : {};
  const dnsAttempt = await postEmailRouting(cloudflareApi.zoneEmailRoutingDns(cloudflareConfig.zoneId), cloudflareConfig.apiToken, dnsBody);
  if (dnsAttempt.success && dnsAttempt.result) {
    return dnsAttempt.result;
  } else if (/already enabled/i.test(cloudflareErrorMessage(dnsAttempt))) {
    return getEmailRoutingSettings(cloudflareConfig);
  } else {
    debugLog("Email Routing DNS enable failed, trying deprecated enable endpoint:", cloudflareErrorMessage(dnsAttempt));
    const enableAttempt = await postEmailRouting(cloudflareApi.zoneEmailRoutingEnable(cloudflareConfig.zoneId), cloudflareConfig.apiToken, {});
    if (enableAttempt.success && enableAttempt.result) {
      return enableAttempt.result;
    } else if (/already enabled/i.test(cloudflareErrorMessage(enableAttempt))) {
      return getEmailRoutingSettings(cloudflareConfig);
    } else {
      throw new Error(`Failed to enable email routing: ${authenticationHint(cloudflareErrorMessage(enableAttempt) || cloudflareErrorMessage(dnsAttempt))}`);
    }
  }
}

export async function listEmailRoutingRules(cloudflareConfig: CloudflareConfig): Promise<EmailRoutingRule[]> {
  const url = baseUrl(cloudflareConfig.zoneId);
  debugLog("Listing email routing rules for zone:", cloudflareConfig.zoneId);

  const response = await fetch(url, {
    headers: headers(cloudflareConfig.apiToken)
  });

  const data: CloudflareResponse<EmailRoutingRule[]> = await response.json();

  if (!data.success) {
    const errorMsg = data.errors.map(e => e.message).join(", ");
    throw new Error(`Failed to list email routing rules: ${errorMsg}`);
  }

  debugLog("Found %d email routing rules", data.result.length);
  return data.result;
}

export async function createEmailRoutingRule(cloudflareConfig: CloudflareConfig, rule: EmailRoutingRule): Promise<EmailRoutingRule> {
  const url = baseUrl(cloudflareConfig.zoneId);
  debugLog("Creating email routing rule: %s", rule.name);

  const response = await fetch(url, {
    method: "POST",
    headers: headers(cloudflareConfig.apiToken),
    body: JSON.stringify(rule)
  });

  const data: CloudflareResponse<EmailRoutingRule> = await response.json();

  if (!data.success) {
    const errorMsg = data.errors.map(e => e.message).join(", ");
    throw new Error(`Failed to create email routing rule: ${errorMsg}`);
  }

  debugLog("Email routing rule created: %s", data.result.id);
  return data.result;
}

export async function updateEmailRoutingRule(cloudflareConfig: CloudflareConfig, ruleId: string, rule: EmailRoutingRule): Promise<EmailRoutingRule> {
  const url = `${baseUrl(cloudflareConfig.zoneId)}/${ruleId}`;
  debugLog("Updating email routing rule: %s", ruleId);

  const response = await fetch(url, {
    method: "PUT",
    headers: headers(cloudflareConfig.apiToken),
    body: JSON.stringify(rule)
  });

  const data: CloudflareResponse<EmailRoutingRule> = await response.json();

  if (!data.success) {
    const errorMsg = data.errors.map(e => e.message).join(", ");
    throw new Error(`Failed to update email routing rule: ${errorMsg}`);
  }

  debugLog("Email routing rule updated: %s", data.result.id);
  return data.result;
}

export async function catchAllRule(cloudflareConfig: CloudflareConfig): Promise<EmailRoutingRule> {
  const url = `${baseUrl(cloudflareConfig.zoneId)}/catch_all`;
  debugLog("Fetching catch-all rule for zone:", cloudflareConfig.zoneId);

  const response = await fetch(url, {
    headers: headers(cloudflareConfig.apiToken)
  });

  const data: CloudflareResponse<EmailRoutingRule> = await response.json();

  if (!data.success) {
    const errorMsg = data.errors.map(e => e.message).join(", ");
    throw new Error(`Failed to fetch catch-all rule: ${errorMsg}`);
  }

  debugLog("Catch-all rule:", data.result);
  return data.result;
}

export async function updateCatchAllRule(cloudflareConfig: CloudflareConfig, rule: EmailRoutingRule): Promise<EmailRoutingRule> {
  const url = `${baseUrl(cloudflareConfig.zoneId)}/catch_all`;
  debugLog("Updating catch-all rule for zone:", cloudflareConfig.zoneId);

  const response = await fetch(url, {
    method: "PUT",
    headers: headers(cloudflareConfig.apiToken),
    body: JSON.stringify(rule)
  });

  const data: CloudflareResponse<EmailRoutingRule> = await response.json();

  if (!data.success) {
    const errorMsg = data.errors.map(e => e.message).join(", ");
    throw new Error(`Failed to update catch-all rule: ${errorMsg}`);
  }

  debugLog("Catch-all rule updated");
  return data.result;
}

export async function deleteEmailRoutingRule(cloudflareConfig: CloudflareConfig, ruleId: string): Promise<void> {
  const url = `${baseUrl(cloudflareConfig.zoneId)}/${ruleId}`;
  debugLog("Deleting email routing rule: %s", ruleId);

  const response = await fetch(url, {
    method: "DELETE",
    headers: headers(cloudflareConfig.apiToken)
  });

  const data: CloudflareResponse<{ id: string }> = await response.json();

  if (!data.success) {
    const errorMsg = data.errors.map(e => e.message).join(", ");
    throw new Error(`Failed to delete email routing rule: ${errorMsg}`);
  }

  debugLog("Email routing rule deleted");
}
