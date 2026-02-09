import debug from "debug";
import { CloudflareConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { EmailRoutingRule } from "../../../projects/ngx-ramblers/src/app/models/cloudflare-email-routing.model";
import { CloudflareResponse } from "./cloudflare-dns";
import { envConfig } from "../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("cloudflare:email-routing"));
debugLog.enabled = true;
const errorDebugLog = debug("ERROR:" + envConfig.logNamespace("cloudflare:email-routing"));
errorDebugLog.enabled = true;

function baseUrl(zoneId: string): string {
  return `https://api.cloudflare.com/client/v4/zones/${zoneId}/email/routing/rules`;
}

function headers(apiToken: string): Record<string, string> {
  return {
    "Authorization": `Bearer ${apiToken}`,
    "Content-Type": "application/json"
  };
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
