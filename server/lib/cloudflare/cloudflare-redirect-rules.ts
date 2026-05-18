import debug from "debug";
import { envConfig } from "../env-config/env-config";
import {
  cloudflareApi,
  CloudflareDnsConfig,
  CloudflareResponse,
  DynamicRedirectRule,
  RulesetResult
} from "./cloudflare.model";

const debugLog = debug(envConfig.logNamespace("cloudflare:redirect-rules"));

export const DYNAMIC_REDIRECT_PHASE = "http_request_dynamic_redirect";
const REDIRECT_RULE_PREFIX = "ngx-ramblers apex redirect";

export enum RedirectRuleAction {
  CREATED = "created",
  UPDATED = "updated"
}

function headers(apiToken: string): Record<string, string> {
  return {
    "Authorization": `Bearer ${apiToken}`,
    "Content-Type": "application/json"
  };
}

export function redirectRuleDescription(fromHost: string): string {
  return `${REDIRECT_RULE_PREFIX}: ${fromHost}`;
}

function writableRule(rule: DynamicRedirectRule): DynamicRedirectRule {
  return {
    action: rule.action,
    action_parameters: rule.action_parameters,
    expression: rule.expression,
    description: rule.description,
    enabled: rule.enabled ?? true
  };
}

function hostRedirectRule(fromHost: string, toHost: string, statusCode: number): DynamicRedirectRule {
  return {
    action: "redirect",
    action_parameters: {
      from_value: {
        status_code: statusCode,
        target_url: { expression: `concat("https://${toHost}", http.request.uri.path)` },
        preserve_query_string: true
      }
    },
    expression: `(http.host eq "${fromHost}")`,
    description: redirectRuleDescription(fromHost),
    enabled: true
  };
}

export async function getDynamicRedirectRules(config: CloudflareDnsConfig): Promise<DynamicRedirectRule[]> {
  const url = cloudflareApi.zoneRulesetPhaseEntrypoint(config.zoneId, DYNAMIC_REDIRECT_PHASE);
  const response = await fetch(url, { headers: headers(config.apiToken) });
  const data: CloudflareResponse<RulesetResult> = await response.json();
  if (!data.success) {
    debugLog("No dynamic redirect ruleset retrieved for zone %s: %o", config.zoneId, data.errors);
    return [];
  }
  return data.result?.rules || [];
}

async function putDynamicRedirectRules(config: CloudflareDnsConfig, rules: DynamicRedirectRule[]): Promise<void> {
  const url = cloudflareApi.zoneRulesetPhaseEntrypoint(config.zoneId, DYNAMIC_REDIRECT_PHASE);
  const response = await fetch(url, {
    method: "PUT",
    headers: headers(config.apiToken),
    body: JSON.stringify({ rules })
  });
  const data: CloudflareResponse<RulesetResult> = await response.json();
  if (!data.success) {
    const errorMsg = (data.errors || []).map(error => error.message).join(", ") || "unknown error";
    throw new Error(`Failed to update dynamic redirect rules: ${errorMsg}`);
  }
}

export async function ensureHostRedirectRule(
  config: CloudflareDnsConfig,
  options: { fromHost: string; toHost: string; statusCode?: number }
): Promise<{ action: RedirectRuleAction }> {
  const { fromHost, toHost } = options;
  const description = redirectRuleDescription(fromHost);
  const existing = await getDynamicRedirectRules(config);
  const alreadyPresent = existing.some(rule => rule.description === description);
  const others = existing.filter(rule => rule.description !== description).map(writableRule);
  const rules = [...others, hostRedirectRule(fromHost, toHost, options.statusCode ?? 301)];
  debugLog("%s redirect rule %s -> %s", alreadyPresent ? "Updating" : "Creating", fromHost, toHost);
  await putDynamicRedirectRules(config, rules);
  return { action: alreadyPresent ? RedirectRuleAction.UPDATED : RedirectRuleAction.CREATED };
}

export async function removeHostRedirectRule(config: CloudflareDnsConfig, fromHost: string): Promise<boolean> {
  const description = redirectRuleDescription(fromHost);
  const existing = await getDynamicRedirectRules(config);
  if (!existing.some(rule => rule.description === description)) {
    return false;
  }
  const remaining = existing.filter(rule => rule.description !== description).map(writableRule);
  debugLog("Removing redirect rule for %s", fromHost);
  await putDynamicRedirectRules(config, remaining);
  return true;
}
