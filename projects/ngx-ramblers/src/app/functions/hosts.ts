import { DnsProvider, dnsProviderLabels } from "../models/environment-setup.model";

export function apexHost(host: string | undefined | null): string {
  return (host || "").replace(/^www\./i, "");
}

export const RAMBLERS_NATIONAL_DOMAIN = "ramblers.org.uk";

export function hostFromUrl(url: string | undefined | null): string {
  try {
    return new URL(url || "").hostname;
  } catch {
    return "";
  }
}

export function apexHostFromUrl(url: string | undefined | null): string {
  return apexHost(hostFromUrl(url)).toLowerCase();
}

export function stagingHostForSiteHref(siteHref: string | undefined | null): string | null {
  const apex = apexHostFromUrl(siteHref);
  if (apex) {
    return `staging.${apex}`;
  } else {
    return null;
  }
}

export function ramblersNationalUrl(url: string | undefined | null): boolean {
  return isHostUnderDomain(hostFromUrl(url), RAMBLERS_NATIONAL_DOMAIN);
}

export function isHostUnderDomain(host: string | undefined | null, baseDomain: string | undefined | null): boolean {
  const normalisedHost = apexHost(host).toLowerCase();
  const normalisedDomain = (baseDomain || "").toLowerCase();
  return !!normalisedHost && !!normalisedDomain
    && (normalisedHost === normalisedDomain || normalisedHost.endsWith(`.${normalisedDomain}`));
}

export function hostnameMayHaveWwwCompanion(host: string | undefined | null): boolean {
  const normalised = (host || "").trim().toLowerCase();
  const labels = normalised.split(".").filter(Boolean);
  return !!normalised && !normalised.startsWith("www.") && labels.length >= 2 && labels.length <= 3;
}

export function hostOrUrlHostname(hostOrUrl: string | undefined | null): string {
  const raw = (hostOrUrl || "").trim();
  return hostFromUrl(raw) || raw.replace(/^https?:\/\//, "").split("/")[0].toLowerCase();
}

const MULTI_PART_PUBLIC_SUFFIXES = ["org.uk", "co.uk", "ac.uk", "gov.uk", "me.uk", "net.uk", "sch.uk"];

export function registrableApex(host: string | undefined | null): string {
  const normalised = apexHost(host).toLowerCase();
  const labels = normalised.split(".").filter(Boolean);
  if (labels.length < 2) {
    return normalised;
  } else {
    const lastTwo = labels.slice(-2).join(".");
    const keep = MULTI_PART_PUBLIC_SUFFIXES.includes(lastTwo) ? 3 : 2;
    return labels.length <= keep ? normalised : labels.slice(-keep).join(".");
  }
}

export function groupOwnedApex(hostOrUrl: string | undefined | null, platformBase: string): string | null {
  const apex = registrableApex(hostOrUrlHostname(hostOrUrl));
  if (apex && !isHostUnderDomain(apex, platformBase)) {
    return apex;
  } else {
    return null;
  }
}

export function firstGroupOwnedApex(hostsOrUrls: (string | null | undefined)[], platformBase: string): string | null {
  return (hostsOrUrls || []).map(value => groupOwnedApex(value, platformBase)).find(apex => !!apex) || null;
}

export function suggestedCustomDomainHostname(apex: string | null | undefined, siteHostname?: string | null): string | null {
  if (!apex) {
    return null;
  } else {
    const site = (siteHostname || "").toLowerCase();
    if (site && registrableApex(site) === apex.toLowerCase()) {
      return site;
    } else {
      return `www.${apex}`;
    }
  }
}

export function exampleWwwHostname(hostOrUrl: string | undefined | null, platformBase: string): string {
  const apex = groupOwnedApex(hostOrUrl, platformBase);
  if (apex) {
    return `www.${apex}`;
  } else {
    return "www.your-group.org.uk";
  }
}

export function exampleStagingHostname(hostOrUrl: string | undefined | null, platformBase: string): string | null {
  const apex = groupOwnedApex(hostOrUrl, platformBase);
  if (apex) {
    return `staging.${apex}`;
  } else {
    return null;
  }
}

function nameserverOrganisation(nameserver: string): string {
  const labels = nameserver.split(".").filter(Boolean);
  if (labels.length >= 2) {
    const lastTwo = labels.slice(-2).join(".");
    if (lastTwo === "co.uk" || lastTwo === "org.uk" || lastTwo === "ac.uk") {
      return labels.slice(-3).join(".");
    } else {
      return lastTwo;
    }
  } else {
    return nameserver;
  }
}

export function dnsProviderFromNameservers(nameservers: string[] | undefined | null): {
  provider: DnsProvider;
  label: string;
  ours: boolean;
} {
  const hosts = (nameservers || []).map(nameserver => nameserver.replace(/\.$/, "").toLowerCase()).filter(Boolean);
  if (hosts.length === 0) {
    return { provider: DnsProvider.UNKNOWN, label: dnsProviderLabels[DnsProvider.UNKNOWN], ours: false };
  } else if (hosts.some(nameserver => nameserver === "cloudflare.com" || nameserver.endsWith(".cloudflare.com"))) {
    return { provider: DnsProvider.CLOUDFLARE, label: dnsProviderLabels[DnsProvider.CLOUDFLARE], ours: true };
  } else if (hosts.some(nameserver => nameserver === "stackdns.com" || nameserver.endsWith(".stackdns.com"))) {
    return { provider: DnsProvider.STACK_DNS, label: dnsProviderLabels[DnsProvider.STACK_DNS], ours: false };
  } else {
    const organisation = nameserverOrganisation(hosts[0]);
    return {
      provider: DnsProvider.OTHER,
      label: organisation || dnsProviderLabels[DnsProvider.OTHER],
      ours: false
    };
  }
}
