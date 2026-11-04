import debug from "debug";
import { BrevoClient } from "@getbrevo/brevo";
import { brevoDkimRecords, brevoDnsRecordHostname } from "../../../../projects/ngx-ramblers/src/app/functions/brevo-domain-dns";
import { envConfig } from "../../env-config/env-config";
import { mailDnsDelegations } from "../../cloudflare/mail-dns-health";
import { configuredCloudflare } from "../../cloudflare/cloudflare-config";
import { CloudflareDnsConfig, DnsRecordType } from "../../cloudflare/cloudflare.model";
import { createDnsRecord, listDnsRecords, updateDnsRecord, zoneForHostname } from "../../cloudflare/cloudflare-dns";
import {
  authenticateDomain,
  domainConfiguration,
  findDomainByName,
  registerDomain
} from "./domain-management";
import { logBrevoError } from "../common/error-log";
import {
  BrevoDnsRecord,
  BrevoDomainConfiguration,
  DomainAuthenticationResult
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const debugLog = debug(envConfig.logNamespace("brevo:domain-authentication"));
debugLog.enabled = true;

const DNS_PROPAGATION_DELAY_MS = 10000;
const BREVO_DOMAINS_URL = "https://app.brevo.com/senders/domain/list";

type DomainAuthenticationOptions = {
  cloudflareDnsConfig?: CloudflareDnsConfig;
  baseDomainOverride?: string;
  client?: BrevoClient;
  stopWhenCloudflareUnavailable?: boolean;
};

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function dkimAvailable(config: BrevoDomainConfiguration): boolean {
  return brevoDkimRecords(config.dnsRecords).length > 0;
}

type DnsOutcome =
  | { type: "ok"; dnsRecordsConfigured: boolean }
  | { type: "failed"; errorMessage: string };

async function configureDnsRecords(cfDnsConfig: CloudflareDnsConfig, config: BrevoDomainConfiguration, baseDomain: string): Promise<DnsOutcome> {
  try {
    const dkimRecords = brevoDkimRecords(config.dnsRecords);
    const dkimConfigured = await Promise.all(dkimRecords.map(record => ensureAuthenticationDnsRecord(cfDnsConfig, record, config.domain, baseDomain)));
    const brevoCodeCreated = await ensureAuthenticationDnsRecord(cfDnsConfig, config.dnsRecords.brevoCode, config.domain, baseDomain);
    const dnsRecordsConfigured = dkimConfigured.some(Boolean) || brevoCodeCreated;

    const allRecordsVerified = config.dnsRecords.brevoCode.status && dkimRecords.length > 0 && dkimRecords.every(record => record.status);
    if (dnsRecordsConfigured && !allRecordsVerified) {
      debugLog("Waiting", DNS_PROPAGATION_DELAY_MS, "ms for DNS propagation");
      await delay(DNS_PROPAGATION_DELAY_MS);
    } else if (dnsRecordsConfigured) {
      debugLog("Skipping DNS propagation delay — records already verified by Brevo");
    }
    return { type: "ok", dnsRecordsConfigured };
  } catch (error) {
    logBrevoError("brevo:domain-authentication", error);
    debugLog("Cloudflare DNS configuration failed:", error.message);
    return { type: "failed", errorMessage: error.message };
  }
}

async function requestAuthentication(domainName: string, client?: BrevoClient): Promise<{ authenticationRequested: boolean; authError: string | null }> {
  try {
    const authResult = await authenticateDomain(domainName, client);
    debugLog("Authentication requested:", authResult.message);
    return { authenticationRequested: true, authError: null };
  } catch (error) {
    logBrevoError("brevo:domain-authentication", error, {domainName});
    const authError = error.message || "Unknown error";
    debugLog("Authentication request failed:", authError);
    return { authenticationRequested: false, authError };
  }
}

async function resolveCfAndBaseDomain(options: DomainAuthenticationOptions, domainName: string): Promise<{ cfDnsConfig: CloudflareDnsConfig; baseDomain: string }> {
  if (options.cloudflareDnsConfig) {
    return {
      cfDnsConfig: options.cloudflareDnsConfig,
      baseDomain: options.baseDomainOverride || domainName
    };
  }
  const cfConfig = await configuredCloudflare();
  const zone = await zoneForHostname(cfConfig.apiToken, domainName);
  if (!zone) {
    throw new Error(`No Cloudflare zone found for ${domainName}. Add the zone in Cloudflare before authenticating in Brevo.`);
  }
  return {
    cfDnsConfig: { apiToken: cfConfig.apiToken, zoneId: zone.id },
    baseDomain: options.baseDomainOverride || zone.name
  };
}

async function cloudflareOrUnavailable(options: DomainAuthenticationOptions, domainName: string): Promise<{ cfDnsConfig: CloudflareDnsConfig; baseDomain: string } | null> {
  if (options.stopWhenCloudflareUnavailable) {
    try {
      return await resolveCfAndBaseDomain(options, domainName);
    } catch (error) {
      debugLog("Cloudflare unavailable for", domainName, ":", error.message);
      return null;
    }
  } else {
    return resolveCfAndBaseDomain(options, domainName);
  }
}

async function ensureAuthenticationDnsRecord(cfDnsConfig: CloudflareDnsConfig, record: BrevoDnsRecord, domainName: string, baseDomain: string): Promise<boolean> {
  if (!record.hostName || !record.value) {
    debugLog("Skipping authentication DNS record with missing name or value");
    return false;
  } else {
    const fqdn = brevoDnsRecordHostname(record.hostName, domainName, baseDomain);
    if (record.type !== DnsRecordType.TXT && record.type !== DnsRecordType.CNAME) {
      throw new Error(`Unsupported Brevo authentication DNS record type: ${record.type}. DNS delegation is not used for an NGX website and inbox.`);
    } else if (fqdn !== domainName && !fqdn.endsWith(`.${domainName}`)) {
      throw new Error(`Brevo authentication record ${fqdn} is outside the sending domain ${domainName}`);
    } else {
      const current = await listDnsRecords(cfDnsConfig, fqdn, record.type);
      if (current.some(existing => existing.content === record.value)) {
        debugLog("Authentication DNS record already exists: %s", fqdn);
        return true;
      } else {
        const dnsRecord = {type: record.type, name: fqdn, content: record.value, ttl: 1, proxied: false};
        const ownedRecords = record.type === DnsRecordType.CNAME ? current : current.filter(existing =>
          record.value.startsWith("brevo-code:") ? existing.content.startsWith("brevo-code:")
            : fqdn.includes("._domainkey.") && /(?:^|;)\s*(?:v=DKIM1|k=|p=)/i.test(existing.content));
        if (ownedRecords.length > 1) {
          throw new Error(`Multiple authentication records exist at ${fqdn}. Review the DNS records before updating authentication.`);
        } else if (ownedRecords.length === 1) {
          await updateDnsRecord(cfDnsConfig, ownedRecords[0].id, dnsRecord);
        } else {
          await createDnsRecord(cfDnsConfig, dnsRecord);
        }
        return true;
      }
    }
  }
}

export async function authenticateSendingDomain(domainName: string, options: DomainAuthenticationOptions = {}): Promise<DomainAuthenticationResult> {
  debugLog("Starting domain authentication for:", domainName);
  const existingDomain = await findDomainByName(domainName, options.client);
  if (!existingDomain) {
    debugLog("Domain not registered, registering:", domainName);
    await registerDomain(domainName, options.client);
  } else {
    debugLog("Domain already registered:", domainName);
  }
  const registered = true;

  const config = await domainConfiguration(domainName, options.client);
  debugLog("Domain config, authenticated:", config.authenticated, "verified:", config.verified, "DKIM available:", dkimAvailable(config));

  const cloudflare = await cloudflareOrUnavailable(options, domainName);
  if (cloudflare) {
    return authenticateThroughDns(domainName, options, config, cloudflare, registered);
  } else {
    return {
      domainName,
      registered,
      dnsRecordsConfigured: false,
      authenticationRequested: false,
      authenticated: false,
      verified: false,
      dnsRecords: config.dnsRecords,
      message: `Cloudflare is not configured for ${domainName}, so the DNS records could not be added automatically. Add the Brevo code and DKIM records shown at your DNS provider, then run again.`,
      brevoDomainsUrl: BREVO_DOMAINS_URL
    };
  }
}

async function authenticateThroughDns(domainName: string, options: DomainAuthenticationOptions, config: BrevoDomainConfiguration, cloudflare: { cfDnsConfig: CloudflareDnsConfig; baseDomain: string }, registered: boolean): Promise<DomainAuthenticationResult> {
  const dnsOutcome = await configureDnsRecords(cloudflare.cfDnsConfig, config, cloudflare.baseDomain);
  if (dnsOutcome.type === "failed") {
    return {
      domainName,
      registered,
      dnsRecordsConfigured: false,
      authenticationRequested: false,
      authenticated: false,
      verified: false,
      dnsRecords: config.dnsRecords,
      message: `DNS configuration failed: ${dnsOutcome.errorMessage}`,
      brevoDomainsUrl: BREVO_DOMAINS_URL
    };
  } else {
    const dnsRecordsConfigured = dnsOutcome.dnsRecordsConfigured;
    const { authenticationRequested, authError } = await requestAuthentication(domainName, options.client);
    const finalConfig = await domainConfiguration(domainName, options.client);
    const missingDkim = !dkimAvailable(config);
    const zone = await zoneForHostname(cloudflare.cfDnsConfig.apiToken, domainName);
    if (!zone) {
      throw new Error(`Cannot verify DNS delegation for ${domainName}: no Cloudflare zone was found`);
    } else {
      const delegations = await mailDnsDelegations(cloudflare.cfDnsConfig, domainName, zone.name);
      const signingRecords = brevoDkimRecords(finalConfig.dnsRecords);
      const signingVerified = signingRecords.length > 0 && signingRecords.every(record => record.status);
      const authenticated = finalConfig.authenticated && finalConfig.verified && signingVerified && !missingDkim && delegations.length === 0;
      const message = delegations.length > 0
        ? "Review the conflicting NS records in Mail DNS maintenance to complete setup. Authentication has not removed any NS records."
        : missingDkim
        ? "Brevo has not provided individual DKIM signing records. In Brevo, choose Individual DNS records for this sending domain, then retry here. Do not delegate the website or inbox subdomain to Brevo-managed nameservers."
        : authenticated
          ? "Domain successfully authenticated"
          : !signingVerified
            ? "Individual DKIM signing records are configured but Brevo has not verified them yet. Re-check Domains after DNS propagation; setup is not complete."
          : authError
            ? `Brevo could not finish domain authentication via API (${authError}). DNS records may already be in Cloudflare; review Individual DNS records in Brevo at ${BREVO_DOMAINS_URL}, then re-check here later. Do not select Brevo-managed NS delegation for a website and inbox subdomain.`
            : "Authentication requested, DNS verification may still be propagating";
      return {
        domainName,
        registered,
        dnsRecordsConfigured,
        authenticationRequested,
        authenticated,
        verified: finalConfig.verified,
        dnsRecords: finalConfig.dnsRecords,
        message,
        brevoDomainsUrl: authenticated || delegations.length > 0 ? null : BREVO_DOMAINS_URL
      };
    }
  }
}
