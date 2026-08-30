import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { configuredEnvironments } from "../environments/environments-config";
import { listDnsRecords, zoneForHostname } from "../cloudflare/cloudflare-dns";
import { getDynamicRedirectRules } from "../cloudflare/cloudflare-redirect-rules";
import { apexWwwSibling } from "../cloudflare/hostname-siblings";
import { CloudflareDnsConfig, CloudflareZone, DynamicRedirectRule, REDIRECT_PLACEHOLDER_IPV4 } from "../cloudflare/cloudflare.model";
import { connectToEnvironmentMongo, EnvironmentNotFoundError } from "./environment-context";
import { dateTimeNowAsValue } from "../shared/dates";
import {
  CrossEnvironmentHostnameHealth,
  CustomDomainEligibility,
  DnsProvider,
  HostnameHealth,
  HostnameHealthReport,
  HostnameOrigin,
  HostnameStatus
} from "../../../projects/ngx-ramblers/src/app/models/environment-setup.model";
import { hostnameNeedsAction } from "../../../projects/ngx-ramblers/src/app/functions/hostname-situation";
import { CustomDomainEntry, EnvironmentConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { dnsProviderFromNameservers, hostFromUrl, ramblersNationalUrl, relatedEnvironmentName } from "../../../projects/ngx-ramblers/src/app/functions/hosts";
import { nameserversForHostname, publicAddressRecord } from "../shared/dns-nameservers";

const debugLog = debug(envConfig.logNamespace("hostname-health"));

const HTTP_PROBE_TIMEOUT_MS = 8000;

enum HttpProbeMethod {
  HEAD = "HEAD",
  GET = "GET"
}

interface HostnameCandidate {
  hostname: string;
  origin: HostnameOrigin;
}

function hostnameFromUrl(url: string): string {
  const hostname = hostFromUrl(url);
  if (!hostname) {
    debugLog("Could not parse site url %s", url);
  }
  return hostname;
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
  return addCandidate(withCustomDomains, environmentSubdomain, HostnameOrigin.ENVIRONMENT_SUBDOMAIN);
}

async function siteHrefFor(environmentEntry: EnvironmentConfig): Promise<string> {
  if (!environmentEntry?.mongo?.cluster) {
    return "";
  } else {
    const { client, db } = await connectToEnvironmentMongo(environmentEntry);
    try {
      const systemConfigDoc = await db.collection("config").findOne({ key: "system" });
      return systemConfigDoc?.value?.group?.href || "";
    } finally {
      await client.close();
    }
  }
}

async function relatedGroupSiteHostname(environmentName: string, environments: EnvironmentConfig[]): Promise<string> {
  const relatedName = relatedEnvironmentName(environmentName);
  const sibling = (environments || []).find(entry => entry.environment === relatedName);
  if (!sibling) {
    return "";
  } else {
    try {
      return hostnameFromUrl(await siteHrefFor(sibling));
    } catch (error) {
      debugLog("Could not read related group site URL for %s: %s", relatedName, error instanceof Error ? error.message : String(error));
      return "";
    }
  }
}

function validatedSiteUrl(normalised: string): string {
  if (ramblersNationalUrl(normalised)) {
    throw new Error("Site URL must be this environment's own address, not a ramblers.org.uk group page. The national page belongs in the footer quick link only.");
  } else {
    try {
      const parsed = new URL(normalised);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error("Site URL must be an http or https address");
      } else {
        return normalised;
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Site URL")) {
        throw error;
      } else {
        throw new Error("Site URL must be a full address such as https://group.ngx-ramblers.org.uk");
      }
    }
  }
}

export async function updateEnvironmentSiteUrl(environmentName: string, siteUrl: string | null): Promise<{
  success: boolean;
  message: string;
  siteUrl: string;
}> {
  const environmentsConfig = await configuredEnvironments();
  const environmentEntry = (environmentsConfig?.environments || []).find(entry => entry.environment === environmentName);
  if (!environmentEntry) {
    throw new Error(`Environment ${environmentName} not found`);
  } else {
    const normalised = (siteUrl || "").trim();
    const siteUrlToStore = normalised ? validatedSiteUrl(normalised) : "";
    const { client, db } = await connectToEnvironmentMongo(environmentEntry);
    try {
      const configCollection = db.collection("config");
      const systemConfigDoc = await configCollection.findOne({ key: "system" });
      if (!systemConfigDoc?.value) {
        throw new Error(`No system config found for environment ${environmentName}`);
      } else {
        await configCollection.updateOne(
          { key: "system" },
          { $set: { "value.group.href": siteUrlToStore } }
        );
        return {
          success: true,
          message: siteUrlToStore
            ? `Site URL set to ${siteUrlToStore}`
            : "Site URL cleared",
          siteUrl: siteUrlToStore
        };
      }
    } finally {
      await client.close();
    }
  }
}

async function probeOnce(hostname: string, method: HttpProbeMethod, signal: AbortSignal): Promise<{ httpStatus: number; httpRedirectLocation: string }> {
  const response = await fetch(`https://${hostname}/`, { method, redirect: "manual", signal });
  return { httpStatus: response.status, httpRedirectLocation: response.headers.get("location") || "" };
}

function probeLooksSuccessful(httpStatus: number): boolean {
  return httpStatus >= 200 && httpStatus < 400;
}

async function probeHttp(hostname: string): Promise<{ httpStatus: number; httpRedirectLocation: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HTTP_PROBE_TIMEOUT_MS);
  try {
    const headResult = await probeOnce(hostname, HttpProbeMethod.HEAD, controller.signal);
    if (probeLooksSuccessful(headResult.httpStatus) || (headResult.httpStatus >= 300 && headResult.httpStatus < 400)) {
      return headResult;
    } else {
      debugLog("HEAD probe for %s returned %s — retrying with GET", hostname, headResult.httpStatus);
      return await probeOnce(hostname, HttpProbeMethod.GET, controller.signal);
    }
  } catch (error) {
    debugLog("HTTP probe failed for %s: %s", hostname, error instanceof Error ? error.message : String(error));
    try {
      return await probeOnce(hostname, HttpProbeMethod.GET, controller.signal);
    } catch (getError) {
      debugLog("GET probe failed for %s: %s", hostname, getError instanceof Error ? getError.message : String(getError));
      return { httpStatus: 0, httpRedirectLocation: "" };
    }
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

export function classifyHostnameHealth(
  hostname: string,
  records: { type: string; content: string; proxied?: boolean }[],
  redirectRuleTarget: string,
  httpStatus: number,
  httpRedirectLocation: string
): { health: HostnameHealth; message: string } {
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
  } else if (redirectRuleTarget && !primaryRecord.proxied && (httpStatus < 200 || httpStatus >= 400)) {
    return {
      health: HostnameHealth.REDIRECT_NOT_PROXIED,
      message: `Visitors cannot reach this address. It should send them to https://${redirectRuleTarget}.`
    };
  } else if (redirectRuleTarget && primaryRecord.proxied && httpStatus >= 300 && httpStatus < 400) {
    return {
      health: HostnameHealth.REDIRECTING,
      message: `Redirects to https://${redirectRuleTarget} via a Cloudflare rule`
    };
  } else if (redirectRuleTarget && primaryRecord.proxied && httpStatus === 0) {
    return {
      health: HostnameHealth.REDIRECT_PENDING,
      message: `Set to send visitors to https://${redirectRuleTarget}. Cloudflare has not finished HTTPS yet.`
    };
  } else if (httpStatus >= 300 && httpStatus < 400 && httpRedirectLocation) {
    return {
      health: HostnameHealth.REDIRECTING,
      message: `Redirects to ${httpRedirectLocation} (sent by the site itself, not a Cloudflare rule, so nothing needs setting up here)`
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

async function cachedNameservers(hostname: string, cache: Map<string, string[]>): Promise<string[]> {
  if (!cache.has(hostname)) {
    cache.set(hostname, await nameserversForHostname(hostname));
  }
  return cache.get(hostname) || [];
}

function nameserverClause(nameservers: string[]): string {
  const provider = dnsProviderFromNameservers(nameservers);
  const nameserverText = nameservers.length > 0 ? ` Nameservers: ${nameservers.join(", ")}.` : "";
  if (provider.provider !== DnsProvider.UNKNOWN) {
    const ours = provider.ours ? "" : " (not Cloudflare)";
    return ` DNS provider: ${provider.label}${ours}.${nameserverText}`;
  } else {
    return nameserverText;
  }
}

function withDnsProvider<T extends { nameservers: string[] }>(status: T): T & { dnsProvider: DnsProvider; dnsProviderLabel: string } {
  const detected = dnsProviderFromNameservers(status.nameservers);
  return { ...status, dnsProvider: detected.provider, dnsProviderLabel: detected.label };
}

async function statusFor(
  candidate: HostnameCandidate,
  apiToken: string,
  zoneCache: Map<string, CloudflareZone>,
  rulesCache: Map<string, DynamicRedirectRule[]>,
  nameserverCache: Map<string, string[]>
): Promise<HostnameStatus> {
  const { hostname, origin } = candidate;
  const nameservers = await cachedNameservers(hostname, nameserverCache);
  const zone = zoneCache.get(hostname) || await zoneForHostname(apiToken, hostname);
  if (!zone) {
    const { httpStatus, httpRedirectLocation } = await probeHttp(hostname);
    const serving = httpStatus >= 200 && httpStatus < 400;
    const publicRecord = await publicAddressRecord(hostname);
    return withDnsProvider({
      hostname,
      origin,
      health: serving ? HostnameHealth.SERVING : HostnameHealth.ZONE_NOT_FOUND,
      healthy: serving,
      dnsRecordType: publicRecord?.type || "",
      dnsContent: publicRecord?.content || "",
      proxied: false,
      redirectRuleTarget: "",
      httpStatus,
      httpRedirectLocation,
      nameservers,
      message: serving
        ? `Serving, but DNS is not in this Cloudflare account.${nameserverClause(nameservers)}`
        : `No Cloudflare zone covering ${hostname}.${nameserverClause(nameservers)}`
    });
  } else {
    zoneCache.set(hostname, zone);
    const cloudflareConfig: CloudflareDnsConfig = { apiToken, zoneId: zone.id };
    const cachedRules = rulesCache.get(zone.id);
    const rules = cachedRules || await getDynamicRedirectRules(cloudflareConfig);
    rulesCache.set(zone.id, rules);
    const records = await listDnsRecords(cloudflareConfig, hostname);
    const redirectRuleTarget = redirectTargetFor(hostname, rules);
    const { httpStatus, httpRedirectLocation } = await probeHttp(hostname);
    const { health, message } = classifyHostnameHealth(hostname, records, redirectRuleTarget, httpStatus, httpRedirectLocation);
    const primaryRecord = records.find(record => ["A", "AAAA", "CNAME"].includes(record.type));
    return withDnsProvider({
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
      nameservers,
      message
    });
  }
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
  const siteHref = environmentEntry ? await siteHrefFor(environmentEntry) : "";
  const siteHostname = hostnameFromUrl(siteHref);
  const relatedGroupSiteUrl = await relatedGroupSiteHostname(environmentName, environmentsConfig?.environments || []);
  const environmentSubdomain = baseDomain ? `${environmentName}.${baseDomain}` : "";
  const primaries = primaryCandidates(siteHostname, environmentEntry?.customDomains || [], environmentSubdomain);

  if (!apiToken) {
    return {
      environmentName,
      siteUrl: siteHostname,
      relatedGroupSiteUrl,
      hostnames: [],
      problemCount: 0,
      checkedAt: dateTimeNowAsValue()
    };
  } else {
    const zoneCache = new Map<string, CloudflareZone>();
    const rulesCache = new Map<string, DynamicRedirectRule[]>();
    const nameserverCache = new Map<string, string[]>();
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
    const settled = await Promise.allSettled(candidates.map(candidate => statusFor(candidate, apiToken, zoneCache, rulesCache, nameserverCache)));
    const checked = settled
      .filter((result): result is PromiseFulfilledResult<HostnameStatus> => result.status === "fulfilled")
      .map(result => result.value);

    const uncheckedTargets = checked.reduce((accumulator: HostnameCandidate[], status) =>
        status.redirectRuleTarget && !checked.some(existing => existing.hostname === status.redirectRuleTarget)
          ? addCandidate(accumulator, status.redirectRuleTarget, HostnameOrigin.REDIRECT_TARGET)
          : accumulator,
      []);
    const targetSettled = await Promise.allSettled(uncheckedTargets.map(candidate => statusFor(candidate, apiToken, zoneCache, rulesCache, nameserverCache)));
    const targetStatuses = targetSettled
      .filter((result): result is PromiseFulfilledResult<HostnameStatus> => result.status === "fulfilled")
      .map(result => result.value);
    const hostnames = annotateOptionalPairHost(annotateOptionalEnvironmentSubdomain(annotateNationalSiteUrl(validateRedirectTargets([...checked, ...targetStatuses]))));

    return {
      environmentName,
      siteUrl: siteHostname,
      relatedGroupSiteUrl,
      hostnames,
      problemCount: hostnames.filter(hostnameNeedsAction).length,
      checkedAt: dateTimeNowAsValue()
    };
  }
}

const neverCreatedStates = [HostnameHealth.NO_DNS, HostnameHealth.ZONE_NOT_FOUND];

export function annotateOptionalPairHost(hostnames: HostnameStatus[]): HostnameStatus[] {
  const siteServed = hostnames.some(hostname =>
    hostname.healthy && hostname.health === HostnameHealth.SERVING);
  return hostnames.map(status => {
    if (status.origin !== HostnameOrigin.SIBLING) {
      return status;
    } else if (!siteServed) {
      return status;
    } else if (status.healthy) {
      return status;
    } else if (!neverCreatedStates.includes(status.health)) {
      return status;
    } else {
      return {
        ...status,
        health: HostnameHealth.NOT_CREATED,
        healthy: true,
        message: "Not created. Optional: the site is already served on another address."
      };
    }
  });
}

export function annotateOptionalEnvironmentSubdomain(hostnames: HostnameStatus[]): HostnameStatus[] {
  const siteServedElsewhere = hostnames.some(hostname =>
    hostname.healthy
    && hostname.health === HostnameHealth.SERVING
    && hostname.origin !== HostnameOrigin.ENVIRONMENT_SUBDOMAIN);
  return hostnames.map(status => {
    if (status.origin !== HostnameOrigin.ENVIRONMENT_SUBDOMAIN) {
      return status;
    } else if (status.healthy) {
      return status;
    } else if (!siteServedElsewhere) {
      return status;
    } else if (!neverCreatedStates.includes(status.health)) {
      return status;
    } else {
      return {
        ...status,
        health: HostnameHealth.NOT_CREATED,
        healthy: true,
        message: "Not created. Optional: the site is already served on another address."
      };
    }
  });
}

function annotateNationalSiteUrl(hostnames: HostnameStatus[]): HostnameStatus[] {
  return hostnames.map(status =>
    status.origin === HostnameOrigin.SITE_URL && ramblersNationalUrl(`https://${status.hostname}`)
      ? {
        ...status,
        health: HostnameHealth.UNREACHABLE,
        healthy: false,
        message: "Not this site's address (Ramblers national group page). Clear Site URL, then set the environment subdomain once it is live."
      }
      : status);
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

export function customDomainEligibilityMessage(input: {
  hostname: string;
  managedByThisAccount: boolean;
  zoneName: string | null;
  dnsProvider: DnsProvider;
  dnsProviderLabel: string;
  nameservers: string[];
}): string {
  const nameserverText = input.nameservers.length > 0 ? ` Nameservers: ${input.nameservers.join(", ")}.` : "";
  if (input.managedByThisAccount) {
    const zoneText = input.zoneName ? ` (zone ${input.zoneName})` : "";
    return `DNS for ${input.hostname} is in this Cloudflare account${zoneText}. Records and the certificate can be created here.`;
  } else if (input.dnsProvider === DnsProvider.CLOUDFLARE) {
    return `This Cloudflare account does not manage ${input.hostname}. DNS nameservers are Cloudflare, but the zone is not in this account.${nameserverText} Attaching will request a Fly certificate and give you the records to add at that DNS host. Site URL will be updated to this hostname.`;
  } else if (input.dnsProvider === DnsProvider.UNKNOWN) {
    return `This Cloudflare account does not manage ${input.hostname}. Public nameservers could not be determined.${nameserverText} Attaching will request a Fly certificate and give you the records to add at the current DNS host. Site URL will be updated to this hostname.`;
  } else {
    return `This Cloudflare account does not manage ${input.hostname}. DNS is hosted at ${input.dnsProviderLabel} (not this Cloudflare account).${nameserverText} Attaching will request a Fly certificate and give you the records to add at that DNS host. Site URL will be updated to this hostname.`;
  }
}

export function customDomainEligibilityFromLookup(
  hostname: string,
  zoneName: string | null,
  nameservers: string[]
): CustomDomainEligibility {
  const detected = dnsProviderFromNameservers(nameservers);
  const managedByThisAccount = !!zoneName;
  return {
    hostname,
    managedByThisAccount,
    dnsProvider: detected.provider,
    dnsProviderLabel: detected.label,
    nameservers,
    zoneName,
    message: customDomainEligibilityMessage({
      hostname,
      managedByThisAccount,
      zoneName,
      dnsProvider: detected.provider,
      dnsProviderLabel: detected.label,
      nameservers
    })
  };
}

export async function probeCustomDomainEligibility(environmentName: string, hostnameInput: string): Promise<CustomDomainEligibility> {
  const hostname = (hostnameInput || "").trim().toLowerCase().replace(/\.$/, "").replace(/^https?:\/\//, "");
  if (!hostname) {
    throw new Error("hostname is required");
  } else {
    const environmentsConfig = await configuredEnvironments();
    const environmentEntry = (environmentsConfig?.environments || []).find(entry => entry.environment === environmentName);
    if (!environmentEntry) {
      throw new EnvironmentNotFoundError(environmentName);
    } else if (!environmentsConfig?.cloudflare?.apiToken) {
      throw new Error("Cloudflare API token not configured. Add cloudflare.apiToken to environments config.");
    } else {
      const nameservers = await nameserversForHostname(hostname);
      const zone = await zoneForHostname(environmentsConfig.cloudflare.apiToken, hostname);
      debugLog("Custom domain eligibility for %s on %s: zone %s, provider %s",
        hostname, environmentName, zone?.name || "(none)", dnsProviderFromNameservers(nameservers).label);
      return customDomainEligibilityFromLookup(hostname, zone?.name || null, nameservers);
    }
  }
}
