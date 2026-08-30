import { CustomDomainStatus } from "../../../models/environment-config.model";
import {
  DnsProvider,
  HostnameHealth,
  hostnameHealthLabels,
  HostnameOrigin,
  hostnameOriginLabels,
  HostnameStatus
} from "../../../models/environment-setup.model";
import { ramblersNationalUrl } from "../../../functions/hosts";

export function hostnameHealthBadgeClass(hostname: HostnameStatus): string {
  if (hostname.health === HostnameHealth.NOT_CREATED) {
    return "badge bg-warning";
  } else if (hostname.healthy) {
    return "badge bg-success";
  } else if (hostname.health === HostnameHealth.NO_DNS
    || hostname.health === HostnameHealth.REDIRECT_TARGET_MISSING
    || hostname.health === HostnameHealth.REDIRECT_NOT_PROXIED) {
    return "badge bg-danger";
  } else {
    return "badge bg-warning text-dark";
  }
}

export function hostnameHealthLabel(hostname: HostnameStatus): string {
  return hostnameHealthLabels[hostname.health] || hostname.health;
}

export function hostnameOriginLabel(hostname: HostnameStatus): string {
  return hostnameOriginLabels[hostname.origin] || hostname.origin;
}

export function hostnameDnsSummary(hostname: HostnameStatus): string {
  if (!hostname.dnsRecordType) {
    return "no record";
  } else {
    const proxyState = hostname.proxied ? "proxied" : "DNS only";
    return `${hostname.dnsRecordType} ${hostname.dnsContent} (${proxyState})`;
  }
}

export function hostnameNameserverSummary(hostname: HostnameStatus): string {
  return (hostname.nameservers || []).length > 0
    ? `Nameservers ${hostname.nameservers.join(", ")}`
    : "";
}

export function hostnameHttpsSummary(hostname: HostnameStatus): string {
  if (hostname.health === HostnameHealth.NOT_CREATED) {
    return "";
  } else if (hostname.health === HostnameHealth.REDIRECT_PENDING) {
    return "HTTPS not up yet";
  } else {
    return `HTTPS ${hostname.httpStatus || "no response"}`;
  }
}

export function hostnameDnsProviderOurs(hostname: HostnameStatus): boolean {
  return hostname.dnsProvider === DnsProvider.CLOUDFLARE;
}

export function hostnameDnsProviderShown(hostname: HostnameStatus): boolean {
  return !!hostname.dnsProvider && hostname.dnsProvider !== DnsProvider.UNKNOWN;
}

export function hostnameDnsProviderBadgeClass(hostname: HostnameStatus): string {
  if (hostname.dnsProvider === DnsProvider.CLOUDFLARE) {
    return "bg-success";
  } else {
    return "bg-warning text-dark";
  }
}

export function isNationalSiteUrl(hostname: HostnameStatus): boolean {
  return ramblersNationalUrl(`https://${hostname.hostname}`);
}

export function isEnvironmentSubdomainHost(hostname: HostnameStatus, environmentSubdomainHint: string): boolean {
  return hostname.hostname === environmentSubdomainHint
    || hostname.origin === HostnameOrigin.ENVIRONMENT_SUBDOMAIN;
}

export function canRepairRedirect(hostname: HostnameStatus): boolean {
  return hostname.health === HostnameHealth.REDIRECT_NOT_PROXIED && !!hostname.redirectRuleTarget;
}

export function shouldOfferClearSiteUrl(hostname: HostnameStatus, environmentSubdomainHint: string): boolean {
  return !hostname.healthy
    && hostname.origin === HostnameOrigin.SITE_URL
    && !isEnvironmentSubdomainHost(hostname, environmentSubdomainHint);
}

export function canUseAsSiteUrl(hostname: HostnameStatus, statuses: HostnameStatus[]): boolean {
  const alreadySite = statuses.some(status =>
    status.origin === HostnameOrigin.SITE_URL && status.hostname === hostname.hostname);
  return !alreadySite
    && hostname.health === HostnameHealth.SERVING
    && (hostname.origin === HostnameOrigin.ENVIRONMENT_SUBDOMAIN || hostname.origin === HostnameOrigin.CUSTOM_DOMAIN);
}

export function hostnameActionStatement(hostname: HostnameStatus, environmentSubdomainHint: string): string {
  if (hostname.healthy && hostname.origin === HostnameOrigin.SITE_URL) {
    return "This is the public site.";
  } else if (hostname.health === HostnameHealth.REDIRECTING) {
    return "Sends visitors to the live site.";
  } else if (hostname.health === HostnameHealth.REDIRECT_PENDING) {
    return "Wait a minute, then Re-check.";
  } else if (hostname.health === HostnameHealth.NOT_CREATED) {
    return "Not used.";
  } else if (hostname.healthy && hostname.origin === HostnameOrigin.ENVIRONMENT_SUBDOMAIN) {
    return "Free NGX host. Optional once a custom domain is the Site URL.";
  } else if (hostname.healthy) {
    return "Nothing to do.";
  } else if (hostname.health === HostnameHealth.REDIRECT_NOT_PROXIED) {
    return "Press Repair redirect on this row.";
  } else if (hostname.origin === HostnameOrigin.SITE_URL && isNationalSiteUrl(hostname)) {
    return "Wrong Site URL (Ramblers national group page). Clear it, then once the environment subdomain is live use Use as Site URL on that row.";
  } else if (hostname.origin === HostnameOrigin.SITE_URL && isEnvironmentSubdomainHost(hostname, environmentSubdomainHint)) {
    return "Site URL is already the free environment host you want. It is not live yet: tick Deploy to Fly.io and Setup subdomain under Steps to run, then Run selected steps. No need to clear this URL.";
  } else if (hostname.origin === HostnameOrigin.SITE_URL) {
    return `${hostname.message} If this is not the address you want, Clear Site URL; otherwise bring the host online first.`;
  } else if (hostname.origin === HostnameOrigin.ENVIRONMENT_SUBDOMAIN) {
    return "Not live yet. Tick Setup subdomain under Steps to run, then Run selected steps.";
  } else if (hostname.origin === HostnameOrigin.CUSTOM_DOMAIN) {
    return `${hostname.message} Check or re-attach the domain in Attach a custom domain below.`;
  } else if (hostname.origin === HostnameOrigin.SIBLING && hostname.redirectRuleTarget) {
    return hostname.message;
  } else if (hostname.origin === HostnameOrigin.SIBLING) {
    return "Optional. Use Apex / www redirect below only if visitors will type this address.";
  } else {
    return hostname.message;
  }
}

export function hostnameHasActions(
  hostname: HostnameStatus,
  statuses: HostnameStatus[],
  environmentSubdomainHint: string,
  canRemoveSubdomain: boolean
): boolean {
  return canRepairRedirect(hostname)
    || shouldOfferClearSiteUrl(hostname, environmentSubdomainHint)
    || canUseAsSiteUrl(hostname, statuses)
    || (canRemoveSubdomain && isEnvironmentSubdomainHost(hostname, environmentSubdomainHint))
    || (!!hostname.redirectRuleTarget && !canRepairRedirect(hostname));
}

export function domainBadgeClass(status: CustomDomainStatus | string | undefined): string {
  if (status === CustomDomainStatus.ATTACHED) {
    return "bg-success";
  } else if (status === CustomDomainStatus.FAILED) {
    return "bg-danger";
  } else {
    return "bg-warning text-dark";
  }
}

export function domainStatusLabel(status: CustomDomainStatus | string | undefined): string {
  if (status === CustomDomainStatus.ATTACHED) {
    return "Attached";
  } else if (status === CustomDomainStatus.FAILED) {
    return "Failed";
  } else {
    return "Awaiting configuration";
  }
}

export function subdomainStepBadgeClass(configured: boolean, optional: boolean): string {
  if (configured) {
    return "bg-success";
  } else {
    return "bg-warning";
  }
}

export function subdomainStepBadgeLabel(configured: boolean, optional: boolean): string {
  if (configured) {
    return "done";
  } else if (optional) {
    return "optional";
  } else {
    return "needed";
  }
}
