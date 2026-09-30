import debug from "debug";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { CloudflareConfig, EnvironmentsConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { envConfig } from "../env-config/env-config";
import * as config from "../mongo/controllers/config";
import { cloudflareApi, CloudflareResponse } from "./cloudflare.model";
import { getEmailRoutingSettings } from "./cloudflare-email-routing";

const debugLog = debug(envConfig.logNamespace("cloudflare:api-token"));
debugLog.enabled = true;

const ZONE_PERMISSION_NAMES = [
  "DNS Write",
  "Zone Settings Write",
  "Zone Write",
  "Zone Read",
  "Email Routing Rules Write",
  "Workers Routes Write"
];

const ACCOUNT_PERMISSION_NAMES = [
  "Account Settings Write",
  "Account Analytics Read",
  "Workers Scripts Write",
  "Account API Tokens Write"
];

interface PermissionGroup {
  id: string;
  name: string;
}

interface TokenPolicy {
  effect: "allow";
  permission_groups: {id: string}[];
  resources: Record<string, string>;
}

function headers(apiToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiToken}`,
    "Content-Type": "application/json"
  };
}

function cloudflareErrorMessage(data: {errors?: {code?: number; message?: string}[]}): string {
  return (data.errors || [])
    .map(item => item.code ? `${item.message} (${item.code})` : item.message)
    .filter(Boolean)
    .join(", ") || "Cloudflare request failed";
}

async function permissionGroups(apiToken: string): Promise<PermissionGroup[]> {
  const response = await fetch(cloudflareApi.userTokenPermissionGroups(), {headers: headers(apiToken)});
  const data: CloudflareResponse<PermissionGroup[]> = await response.json();
  if (!data.success || !data.result) {
    throw new Error(`Failed to list Cloudflare token permission groups: ${cloudflareErrorMessage(data)}`);
  } else {
    return data.result;
  }
}

function groupsNamed(all: PermissionGroup[], names: string[]): PermissionGroup[] {
  return names
    .map(name => all.find(group => group.name === name))
    .filter((group): group is PermissionGroup => !!group);
}

function tokenPolicies(accountId: string, groups: PermissionGroup[]): TokenPolicy[] {
  const zoneGroups = groupsNamed(groups, ZONE_PERMISSION_NAMES);
  const accountGroups = groupsNamed(groups, ACCOUNT_PERMISSION_NAMES);
  const missing = [...ZONE_PERMISSION_NAMES, ...ACCOUNT_PERMISSION_NAMES]
    .filter(name => !groups.some(group => group.name === name));
  if (missing.length) {
    debugLog("Permission groups not present in this account (skipped): %o", missing);
  }
  const policies: TokenPolicy[] = [
    {
      effect: "allow",
      permission_groups: accountGroups.map(group => ({id: group.id})),
      resources: {[`com.cloudflare.api.account.${accountId}`]: "*"}
    },
    {
      effect: "allow",
      permission_groups: zoneGroups.map(group => ({id: group.id})),
      resources: {"com.cloudflare.api.account.zone.*": "*"}
    }
  ];
  return policies.filter(policy => policy.permission_groups.length > 0);
}

async function verifyTokenId(apiToken: string): Promise<string | null> {
  const response = await fetch(cloudflareApi.verifyToken(), {headers: headers(apiToken)});
  const data: CloudflareResponse<{id?: string; status?: string}> = await response.json();
  return data.success ? data.result?.id || null : null;
}

async function updateTokenPolicies(apiToken: string, accountId: string, tokenId: string, policies: TokenPolicy[]): Promise<boolean> {
  const accountUrl = cloudflareApi.accountToken(accountId, tokenId);
  const userUrl = cloudflareApi.userToken(tokenId);
  const body = JSON.stringify({policies});
  const accountAttempt = await fetch(accountUrl, {method: "PUT", headers: headers(apiToken), body});
  const accountData: CloudflareResponse<unknown> = await accountAttempt.json();
  if (accountData.success) {
    debugLog("Updated account-owned token policies for %s", tokenId);
    return true;
  } else {
    const userAttempt = await fetch(userUrl, {method: "PUT", headers: headers(apiToken), body});
    const userData: CloudflareResponse<unknown> = await userAttempt.json();
    if (userData.success) {
      debugLog("Updated user-owned token policies for %s", tokenId);
      return true;
    } else {
      debugLog("Could not update token policies: %s / %s", cloudflareErrorMessage(accountData), cloudflareErrorMessage(userData));
      return false;
    }
  }
}

async function createPlatformToken(apiToken: string, accountId: string, policies: TokenPolicy[]): Promise<string | null> {
  const body = JSON.stringify({
    name: "NGX Ramblers platform (DNS, Email Routing, Workers)",
    policies
  });
  const accountAttempt = await fetch(cloudflareApi.accountTokens(accountId), {
    method: "POST",
    headers: headers(apiToken),
    body
  });
  const accountData: CloudflareResponse<{value?: string}> = await accountAttempt.json();
  if (accountData.success && accountData.result?.value) {
    debugLog("Created account-owned Cloudflare API token");
    return accountData.result.value;
  } else {
    const userAttempt = await fetch(cloudflareApi.userTokens(), {
      method: "POST",
      headers: headers(apiToken),
      body
    });
    const userData: CloudflareResponse<{value?: string}> = await userAttempt.json();
    if (userData.success && userData.result?.value) {
      debugLog("Created user-owned Cloudflare API token");
      return userData.result.value;
    } else {
      debugLog("Could not create Cloudflare API token: %s / %s", cloudflareErrorMessage(accountData), cloudflareErrorMessage(userData));
      return null;
    }
  }
}

async function persistPlatformToken(apiToken: string): Promise<void> {
  const document = await config.queryKey(ConfigKey.ENVIRONMENTS);
  const value = document?.value as EnvironmentsConfig;
  if (!value?.cloudflare) {
    throw new Error("No Cloudflare configuration is stored in environment settings");
  } else {
    await config.createOrUpdateKey(ConfigKey.ENVIRONMENTS, {
      ...value,
      cloudflare: {
        ...value.cloudflare,
        apiToken
      }
    });
  }
}

export async function ensureCloudflareTokenCanManageEmailRouting(cloudflareConfig: CloudflareConfig, zoneId: string, logs: string[]): Promise<CloudflareConfig> {
  const probe = await getEmailRoutingSettings({...cloudflareConfig, zoneId}).then(() => true).catch(() => false);
  if (probe) {
    return cloudflareConfig;
  } else {
    logs.push("  - Stored Cloudflare token cannot manage Email Routing; widening it through the Cloudflare token API");
    const groups = await permissionGroups(cloudflareConfig.apiToken);
    const policies = tokenPolicies(cloudflareConfig.accountId, groups);
    const tokenId = await verifyTokenId(cloudflareConfig.apiToken);
    const policiesUpdated = tokenId
      ? await updateTokenPolicies(cloudflareConfig.apiToken, cloudflareConfig.accountId, tokenId, policies)
      : false;
    const widened = policiesUpdated
      ? await getEmailRoutingSettings({...cloudflareConfig, zoneId}).then(() => true).catch(() => false)
      : false;
    if (widened) {
      logs.push("  ✓ Existing Cloudflare token now includes Email Routing and Zone Settings");
      return cloudflareConfig;
    } else {
      const created = await createPlatformToken(cloudflareConfig.apiToken, cloudflareConfig.accountId, policies);
      if (!created) {
        throw new Error("The stored Cloudflare token cannot manage Email Routing, and it also cannot create a wider token (needs Account API Tokens Edit). Add that permission once, save Global Settings, then Enable incoming mail again. After that, environment setup will keep the token current.");
      } else {
        await persistPlatformToken(created);
        logs.push("  ✓ Stored a Cloudflare token that can manage Email Routing on every zone");
        return {...cloudflareConfig, apiToken: created};
      }
    }
  }
}
