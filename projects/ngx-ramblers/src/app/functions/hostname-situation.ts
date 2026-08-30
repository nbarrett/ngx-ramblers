import { ramblersNationalUrl } from "./hosts";
import {
  ENVIRONMENT_SUBDOMAIN_BASE,
  HostnameHealth,
  HostnameOrigin,
  HostnameSituation,
  HostnameSituationAlert,
  HostnameSituationKind,
  HostnameStatus
} from "../models/environment-setup.model";

export function hostnameNeedsAction(hostname: HostnameStatus): boolean {
  return !hostname.healthy && hostname.health !== HostnameHealth.REDIRECT_PENDING;
}

function servingHost(hostnames: HostnameStatus[]): HostnameStatus | null {
  const bySiteUrl = hostnames.find(hostname =>
    hostname.health === HostnameHealth.SERVING && hostname.origin === HostnameOrigin.SITE_URL);
  const anyServing = hostnames.find(hostname => hostname.health === HostnameHealth.SERVING);
  return bySiteUrl || anyServing || null;
}

function ofHealth(hostnames: HostnameStatus[], health: HostnameHealth): HostnameStatus[] {
  return hostnames.filter(hostname => hostname.health === health);
}

function pairHalf(hostnames: HostnameStatus[]): HostnameStatus[] {
  return hostnames.filter(hostname =>
    hostname.origin === HostnameOrigin.SIBLING || hostname.origin === HostnameOrigin.REDIRECT_TARGET);
}

function named(hostname: HostnameStatus | null | undefined): string {
  return hostname?.hostname || "this address";
}

function isPlatformHost(hostname: HostnameStatus | null | undefined): boolean {
  const host = hostname?.hostname || "";
  return host === ENVIRONMENT_SUBDOMAIN_BASE || host.endsWith(`.${ENVIRONMENT_SUBDOMAIN_BASE}`);
}

function isNationalSiteUrl(hostname: HostnameStatus | null | undefined): boolean {
  return !!hostname && hostname.origin === HostnameOrigin.SITE_URL
    && ramblersNationalUrl(`https://${hostname.hostname}`);
}

function hasDnsRecord(hostname: HostnameStatus): boolean {
  return !!hostname.dnsRecordType;
}

function situation(
  kind: HostnameSituationKind,
  alert: HostnameSituationAlert,
  title: string,
  detail: string,
  action: string | null
): HostnameSituation {
  return {kind, alert, title, detail, action};
}

function siteNotLive(hostnames: HostnameStatus[]): HostnameSituation {
  const siteUrl = hostnames.find(hostname => hostname.origin === HostnameOrigin.SITE_URL);
  const ngx = hostnames.find(hostname => hostname.origin === HostnameOrigin.ENVIRONMENT_SUBDOMAIN);
  const custom = hostnames.find(hostname => hostname.origin === HostnameOrigin.CUSTOM_DOMAIN);
  const focus = siteUrl || custom || ngx || hostnames[0];

  if (focus && focus.health === HostnameHealth.ZONE_NOT_FOUND) {
    return situation(
      HostnameSituationKind.SITE_NOT_LIVE_EXTERNAL_DNS,
      HostnameSituationAlert.DANGER,
      "The site is not reachable",
      `${named(focus)} is not in this Cloudflare account, so this screen cannot create its DNS or certificate.`,
      "Point that domain at this Cloudflare account, or set Site URL to a host this environment already manages."
    );
  } else if ((focus && isPlatformHost(focus) && hasDnsRecord(focus) && focus.health === HostnameHealth.UNREACHABLE)
    || (ngx && hasDnsRecord(ngx) && ngx.health === HostnameHealth.UNREACHABLE)) {
    const host = (focus && isPlatformHost(focus)) ? focus : ngx;
    return situation(
      HostnameSituationKind.SITE_NOT_LIVE_DEPLOY,
      HostnameSituationAlert.DANGER,
      "The site is not reachable",
      `${named(host)} has DNS but HTTPS is not serving.`,
      "Tick Deploy to Fly.io and Setup subdomain under Steps to run, then Run selected steps."
    );
  } else if ((focus && isPlatformHost(focus)) || (ngx && hostnameNeedsAction(ngx)) || !focus) {
    return situation(
      HostnameSituationKind.SITE_NOT_LIVE_SETUP_SUBDOMAIN,
      HostnameSituationAlert.DANGER,
      "The site is not reachable",
      "No public host is serving yet. The free NGX host is the one this screen can create.",
      "Tick Setup subdomain under Steps to run, then Run selected steps."
    );
  } else if (focus.health === HostnameHealth.NO_DNS) {
    return situation(
      HostnameSituationKind.SITE_NOT_LIVE_ATTACH_DOMAIN,
      HostnameSituationAlert.DANGER,
      "The site is not reachable",
      `${named(focus)} has no DNS record, so visitors cannot reach the site.`,
      `Attach ${named(focus)} under Attach a custom domain.`
    );
  } else {
    return situation(
      HostnameSituationKind.SITE_NOT_LIVE_CHECK_DOMAIN,
      HostnameSituationAlert.DANGER,
      "The site is not reachable",
      `${named(focus)} is the public address but it is not serving.`,
      `Press Check on ${named(focus)} in the custom domain table. If it is not listed, attach it there.`
    );
  }
}

export function analyseHostnameSituation(hostnames: HostnameStatus[]): HostnameSituation {
  if (hostnames.length === 0) {
    return situation(
      HostnameSituationKind.NONE_TO_CHECK,
      HostnameSituationAlert.WARNING,
      "No hostnames were checked",
      "The live check did not return any addresses for this environment.",
      "Press Re-check. If that still returns nothing, confirm the environment has a Site URL or a custom domain."
    );
  } else {
    const site = servingHost(hostnames);
    const national = hostnames.find(hostname => isNationalSiteUrl(hostname));
    const notProxied = ofHealth(hostnames, HostnameHealth.REDIRECT_NOT_PROXIED);
    const missingTarget = ofHealth(hostnames, HostnameHealth.REDIRECT_TARGET_MISSING);
    const pending = ofHealth(hostnames, HostnameHealth.REDIRECT_PENDING);
    const redirecting = ofHealth(hostnames, HostnameHealth.REDIRECTING);
    const ngx = hostnames.find(hostname => hostname.origin === HostnameOrigin.ENVIRONMENT_SUBDOMAIN);
    const deadCustom = hostnames.find(hostname =>
      hostname.origin === HostnameOrigin.CUSTOM_DOMAIN && hostnameNeedsAction(hostname));
    const deadSibling = pairHalf(hostnames).find(hostname =>
      hostnameNeedsAction(hostname)
      && hostname.health !== HostnameHealth.REDIRECT_NOT_PROXIED
      && hostname.health !== HostnameHealth.REDIRECT_TARGET_MISSING);
    const otherServing = hostnames.filter(hostname =>
      hostname.health === HostnameHealth.SERVING && hostname.hostname !== site?.hostname);
    const leftoverNgx = ngx
      && site
      && !isPlatformHost(site)
      && (ngx.health === HostnameHealth.SERVING || hostnameNeedsAction(ngx));

    if (national) {
      return situation(
        HostnameSituationKind.WRONG_SITE_URL,
        HostnameSituationAlert.DANGER,
        "Site URL is the Ramblers national page, not this site",
        `${named(national)} is stored as the public address. That is the Ramblers national website, not this group.`,
        site
          ? `Press Clear Site URL on that row, then Use as Site URL on ${named(site)}.`
          : "Press Clear Site URL on that row, then tick Setup subdomain under Steps to run."
      );
    } else if (!site) {
      return siteNotLive(hostnames);
    } else if (notProxied.length > 0) {
      return situation(
        HostnameSituationKind.LIVE_REDIRECT_BROKEN,
        HostnameSituationAlert.DANGER,
        "The site is live, but the other address is not",
        `${named(site)} is serving visitors. ${named(notProxied[0])} does not send people there.`,
        `Press Repair redirect on the ${named(notProxied[0])} row.`
      );
    } else if (missingTarget.length > 0 && missingTarget[0].redirectRuleTarget) {
      return situation(
        HostnameSituationKind.LIVE_REDIRECT_TARGET_MISSING,
        HostnameSituationAlert.DANGER,
        "The site is live, but the redirect points at a dead address",
        `${named(site)} is serving visitors. ${named(missingTarget[0])} sends people to ${missingTarget[0].redirectRuleTarget}, which is not working.`,
        `Press Remove redirect on ${named(missingTarget[0])}, then use Apex / www redirect to send it to ${named(site)}.`
      );
    } else if (missingTarget.length > 0) {
      return situation(
        HostnameSituationKind.LIVE_REDIRECT_TARGET_MISSING,
        HostnameSituationAlert.DANGER,
        "The site is live, but the other address has no redirect rule",
        `${named(site)} is serving visitors. ${named(missingTarget[0])} is a redirect placeholder with no rule, so requests time out.`,
        `Use Apex / www redirect below with ${named(site)} as the serving host.`
      );
    } else if (pending.length > 0) {
      return situation(
        HostnameSituationKind.LIVE_REDIRECT_WAITING,
        HostnameSituationAlert.WARNING,
        "The site is live. The redirect is still finishing",
        `${named(site)} is serving visitors. ${named(pending[0])} is set to send people there; Cloudflare has not finished HTTPS yet. That is normal just after Repair.`,
        "Wait a minute, then press Re-check."
      );
    } else if (site.origin !== HostnameOrigin.SITE_URL) {
      return situation(
        HostnameSituationKind.LIVE_SET_SITE_URL,
        HostnameSituationAlert.WARNING,
        "The site is live, but Site URL is not that address",
        `${named(site)} is serving visitors. The stored Site URL is not this host, so links the group publishes may be wrong.`,
        `Press Use as Site URL on the ${named(site)} row.`
      );
    } else if (leftoverNgx && ngx && hostnameNeedsAction(ngx)) {
      return situation(
        HostnameSituationKind.LIVE_REMOVE_SUBDOMAIN,
        HostnameSituationAlert.WARNING,
        "The site is live. The free NGX host is broken",
        `${named(site)} is serving visitors. ${named(ngx)} still has DNS but is not serving.`,
        `Press Remove subdomain on the ${named(ngx)} row.`
      );
    } else if (leftoverNgx && ngx && ngx.health === HostnameHealth.SERVING) {
      return situation(
        HostnameSituationKind.LIVE_REMOVE_SUBDOMAIN,
        HostnameSituationAlert.WARNING,
        "The site is live. The free NGX host is still serving too",
        `${named(site)} is the public site. ${named(ngx)} also still serves.`,
        `Press Remove subdomain on the ${named(ngx)} row if you only want the custom domain.`
      );
    } else if (otherServing.length > 0) {
      return situation(
        HostnameSituationKind.LIVE_BOTH_SERVING,
        HostnameSituationAlert.WARNING,
        "Both addresses serve the site",
        `${named(site)} and ${named(otherServing[0])} both return the site.`,
        "Use Apex / www redirect below if only one address should be public."
      );
    } else if (deadCustom) {
      return situation(
        HostnameSituationKind.LIVE_CHECK_CUSTOM_DOMAIN,
        HostnameSituationAlert.WARNING,
        "The site is live. Another attached hostname is not",
        `${named(site)} is serving visitors. ${named(deadCustom)} is attached but not serving.`,
        `Press Check on ${named(deadCustom)} in the custom domain table, or Remove it if it is not needed.`
      );
    } else if (deadSibling) {
      return situation(
        HostnameSituationKind.LIVE_SETUP_PAIR_REDIRECT,
        HostnameSituationAlert.WARNING,
        "The site is live. The other half of the pair is not",
        `${named(site)} is serving visitors. ${named(deadSibling)} does not.`,
        `Use Apex / www redirect below with ${named(site)} as the serving host.`
      );
    } else if (redirecting.length > 0) {
      return situation(
        HostnameSituationKind.LIVE,
        HostnameSituationAlert.SUCCESS,
        "The site is live",
        `${named(site)} is serving visitors. ${named(redirecting[0])} sends people there.`,
        null
      );
    } else {
      return situation(
        HostnameSituationKind.LIVE,
        HostnameSituationAlert.SUCCESS,
        "The site is live",
        `${named(site)} is serving visitors.`,
        null
      );
    }
  }
}
