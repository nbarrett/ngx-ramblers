import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { configuredEnvironments } from "../environments/environments-config";
import { listDnsRecords, zoneForHostname } from "../cloudflare/cloudflare-dns";
import { getDynamicRedirectRules } from "../cloudflare/cloudflare-redirect-rules";
import { apexWwwSibling } from "../cloudflare/hostname-siblings";
import { CloudflareDnsConfig, CloudflareZone, DnsRecordResult, DynamicRedirectRule } from "../cloudflare/cloudflare.model";
import { connectToEnvironmentMongo } from "./environment-context";
import { dateTimeNowAsValue } from "../shared/dates";
import {
  CrossEnvironmentHostnameHealth,
  HostnameHealth,
  HostnameHealthReport,
  HostnameOrigin,
  HostnameStatus
} from "../../../projects/ngx-ramblers/src/app/models/environment-setup.model";
import { CustomDomainEntry, EnvironmentConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";

const debugLog = debug(envConfig.logNamespace("hostname-health"));

const REDIRECT_PLACEHOLDER_IPV4 = "192.0.2.1";
const HTTP_PROBE_TIMEOUT_MS = 8000;

interface HostnameCandidate {
  hostname: string;
  origin: HostnameOrigin;
}

function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    debugLog("Could not parse site url %s", url);
    return "";
  }
}

function addCandidate(candidates: HostnameCandidate[], hostname: string, origin: HostnameOrigin): HostnameCandidate[] {
  const alreadyPresent = candidates.some(candidate => candidate.hostname === hostname);
  return alreadyPresent || !hostname ? candidates : [...candidates, { hostname, origin }];
}

function primaryCandidates(siteHostname: string, customDomains: CustomDomainEntry[], environmentSubdomain: string): HostnameCandidate[] {
  const fromSite = addCandidate([], siteHostname, HostnameOrigin.SITE_URL);
  const withCustomDomains = customDomains.reduce(
    (accumulator, entry) => addCandidate(accumulator, entry.hostname, HostnameOrigin.CUSTOM_DOMAIN),
    fromSite);
  const environmentSubdomainRelevant = !siteHostname || siteHostname === environmentSubdomain;
  return environmentSubdomainRelevant
    ? addCandidate(withCustomDomains, environmentSubdomain, HostnameOrigin.ENVIRONMENT_SUBDOMAIN)
    : withCustomDomains;
}

async function siteHostnameFor(environmentEntry: EnvironmentConfig): Promise<string> {
  if (!environmentEntry?.mongo?.cluster) {
    return "";
  }
  const { client, db } = await connectToEnvironmentMongo(environmentEntry);
  try {
    const systemConfigDoc = await db.collection("config").findOne({ key: "system" });
    const href = systemConfigDoc?.value?.group?.href || "";
    return hostnameFromUrl(href);
  } finally {
    await client.close();
  }
}

async function probeHttp(hostname: string): Promise<{ httpStatus: number; httpRedirectLocation: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HTTP_PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(`https://${hostname}/`, { method: "HEAD", redirect: "manual", signal: controller.signal });
    return { httpStatus: response.status, httpRedirectLocation: response.headers.get("location") || "" };
  } catch (error) {
    debugLog("HTTP probe failed for %s: %s", hostname, error instanceof Error ? error.message : String(error));
    return { httpStatus: 0, httpRedirectLocation: "" };
  } finally {
    clearTimeout(timeout);
  }
}

function redirectTargetFor(hostname: string, rules: DynamicRedirectRule[]): string {
  const matching = rules.find(rule => rule.expression?.includes(`"${hostname}"`));
  const expression = matching?.action_parameters?.from_value?.target_url?.expression || "";
  const target = expression.match(/https:\/\/([^"]+)/);
  return target ? target[1] : "";
}

function classify(hostname: string, records: DnsRecordResult[], redirectRuleTarget: string, httpStatus: number, httpRedirectLocation: string): { health: HostnameHealth; message: string } {
  const primaryRecord = records.find(record => ["A", "AAAA", "CNAME"].includes(record.type));
  if (!primaryRecord) {
    return {
      health: HostnameHealth.NO_DNS,
      message: `No DNS record exists for ${hostname}, so it does not resolve at all`
    };
  } else if (primaryRecord.content === REDIRECT_PLACEHOLDER_IPV4 && !redirectRuleTarget) {
    return {
      health: HostnameHealth.REDIRECT_TARGET_MISSING,
      message: `${hostname} points at the redirect placeholder but no redirect rule exists, so every request times out with a 522`
    };
  } else if (redirectRuleTarget) {
    return {
      health: HostnameHealth.REDIRECTING,
      message: `Redirects to https://${redirectRuleTarget} via a Cloudflare rule`
    };
  } else if (httpStatus >= 300 && httpStatus < 400 && httpRedirectLocation) {
    return {
      health: HostnameHealth.REDIRECTING,
      message: `Redirects to ${httpRedirectLocation} — sent by the site itself, not a Cloudflare rule, so nothing needs setting up here`
    };
  } else if (httpStatus >= 200 && httpStatus < 400) {
    return {
      health: HostnameHealth.SERVING,
      message: "Serving the site"
    };
  } else if (httpStatus === 0) {
    return {
      health: HostnameHealth.UNREACHABLE,
      message: `${hostname} resolves but could not be reached over HTTPS`
    };
  } else {
    return {
      health: HostnameHealth.UNREACHABLE,
      message: `${hostname} returned HTTP ${httpStatus}`
    };
  }
}

const healthyStates = [HostnameHealth.SERVING, HostnameHealth.REDIRECTING];

async function statusFor(candidate: HostnameCandidate, apiToken: string, zoneCache: Map<string, CloudflareZone>, rulesCache: Map<string, DynamicRedirectRule[]>): Promise<HostnameStatus> {
  const { hostname, origin } = candidate;
  const zone = zoneCache.get(hostname) || await zoneForHostname(apiToken, hostname);
  if (!zone) {
    const { httpStatus, httpRedirectLocation } = await probeHttp(hostname);
    const serving = httpStatus >= 200 && httpStatus < 400;
    return {
      hostname,
      origin,
      health: serving ? HostnameHealth.SERVING : HostnameHealth.ZONE_NOT_FOUND,
      healthy: serving,
      dnsRecordType: "",
      dnsContent: "",
      proxied: false,
      redirectRuleTarget: "",
      httpStatus,
      httpRedirectLocation,
      message: serving
        ? `Serving, but DNS is managed outside this Cloudflare account so records cannot be checked here`
        : `No Cloudflare zone found covering ${hostname}, and it did not respond over HTTPS`
    };
  }
  zoneCache.set(hostname, zone);
  const cloudflareConfig: CloudflareDnsConfig = { apiToken, zoneId: zone.id };
  const cachedRules = rulesCache.get(zone.id);
  const rules = cachedRules || await getDynamicRedirectRules(cloudflareConfig);
  rulesCache.set(zone.id, rules);
  const records = await listDnsRecords(cloudflareConfig, hostname);
  const redirectRuleTarget = redirectTargetFor(hostname, rules);
  const { httpStatus, httpRedirectLocation } = await probeHttp(hostname);
  const { health, message } = classify(hostname, records, redirectRuleTarget, httpStatus, httpRedirectLocation);
  const primaryRecord = records.find(record => ["A", "AAAA", "CNAME"].includes(record.type));
  return {
    hostname,
    origin,
    health,
    healthy: healthyStates.includes(health),
    dnsRecordType: primaryRecord?.type || "",
    dnsContent: primaryRecord?.content || "",
    proxied: primaryRecord?.proxied ?? false,
    redirectRuleTarget,
    httpStatus,
    httpRedirectLocation,
    message
  };
}

export function validateRedirectTargets(statuses: HostnameStatus[]): HostnameStatus[] {
  return statuses.map(status => {
    if (status.health !== HostnameHealth.REDIRECTING) {
      return status;
    }
    const target = statuses.find(candidate => candidate.hostname === status.redirectRuleTarget);
    if (!target) {
      return status;
    }
    if (target.healthy) {
      return status;
    }
    return {
      ...status,
      health: HostnameHealth.REDIRECT_TARGET_MISSING,
      healthy: false,
      message: `Redirects to https://${status.redirectRuleTarget}, but that hostname is not working: ${target.message}`
    };
  });
}

export async function environmentHostnameHealth(environmentName: string): Promise<HostnameHealthReport> {
  const environmentsConfig = await configuredEnvironments();
  const apiToken = environmentsConfig?.cloudflare?.apiToken;
  const baseDomain = environmentsConfig?.cloudflare?.baseDomain;
  const environmentEntry = (environmentsConfig?.environments || []).find(entry => entry.environment === environmentName);
  const siteHostname = await siteHostnameFor(environmentEntry);
  const environmentSubdomain = baseDomain ? `${environmentName}.${baseDomain}` : "";
  const primaries = primaryCandidates(siteHostname, environmentEntry?.customDomains || [], environmentSubdomain);

  if (!apiToken) {
    return {
      environmentName,
      siteUrl: siteHostname,
      hostnames: [],
      problemCount: 0,
      checkedAt: dateTimeNowAsValue()
    };
  }

  const zoneCache = new Map<string, CloudflareZone>();
  const rulesCache = new Map<string, DynamicRedirectRule[]>();
  const siblings = await primaries.reduce(async (accumulator: Promise<HostnameCandidate[]>, candidate) => {
    const collected = await accumulator;
    const zone = await zoneForHostname(apiToken, candidate.hostname);
    if (zone) {
      zoneCache.set(candidate.hostname, zone);
      const sibling = apexWwwSibling(candidate.hostname, zone);
      return sibling ? addCandidate(collected, sibling, HostnameOrigin.SIBLING) : collected;
    } else {
      return collected;
    }
  }, Promise.resolve([]));
  const candidates: HostnameCandidate[] = siblings.reduce(
    (accumulator: HostnameCandidate[], sibling: HostnameCandidate) => addCandidate(accumulator, sibling.hostname, sibling.origin),
    primaries);
  debugLog("Checking %s hostnames for environment %s", candidates.length, environmentName);
  const settled = await Promise.allSettled(candidates.map(candidate => statusFor(candidate, apiToken, zoneCache, rulesCache)));
  const checked = settled
    .filter((result): result is PromiseFulfilledResult<HostnameStatus> => result.status === "fulfilled")
    .map(result => result.value);

  const uncheckedTargets = checked.reduce((accumulator: HostnameCandidate[], status) =>
      status.redirectRuleTarget && !checked.some(existing => existing.hostname === status.redirectRuleTarget)
        ? addCandidate(accumulator, status.redirectRuleTarget, HostnameOrigin.REDIRECT_TARGET)
        : accumulator,
    []);
  const targetSettled = await Promise.allSettled(uncheckedTargets.map(candidate => statusFor(candidate, apiToken, zoneCache, rulesCache)));
  const targetStatuses = targetSettled
    .filter((result): result is PromiseFulfilledResult<HostnameStatus> => result.status === "fulfilled")
    .map(result => result.value);
  const hostnames = validateRedirectTargets([...checked, ...targetStatuses]);

  return {
    environmentName,
    siteUrl: siteHostname,
    hostnames,
    problemCount: hostnames.filter(hostname => !hostname.healthy).length,
    checkedAt: dateTimeNowAsValue()
  };
}

const CACHE_TTL_MS = 15 * 60 * 1000;
const cacheState: { latest: CrossEnvironmentHostnameHealth | null } = { latest: null };

export async function crossEnvironmentHostnameHealth(forceRefresh = false): Promise<CrossEnvironmentHostnameHealth> {
  const now = dateTimeNowAsValue();
  const cached = cacheState.latest;
  const cacheStillValid = cached && (now - cached.checkedAt) < CACHE_TTL_MS;
  if (cacheStillValid && !forceRefresh) {
    debugLog("Returning cached hostname health for %s environments", cached.environments.length);
    return { ...cached, fromCache: true };
  }
  const environmentsConfig = await configuredEnvironments();
  const names = (environmentsConfig?.environments || []).map(entry => entry.environment);
  debugLog("Checking hostname health across %s environments", names.length);
  const settled = await Promise.allSettled(names.map(name => environmentHostnameHealth(name)));
  const environments = settled
    .filter((result): result is PromiseFulfilledResult<HostnameHealthReport> => result.status === "fulfilled")
    .map(result => result.value);
  cacheState.latest = {
    environments,
    totalProblemCount: environments.reduce((total, report) => total + report.problemCount, 0),
    checkedAt: dateTimeNowAsValue(),
    fromCache: false
  };
  return cacheState.latest;
}
