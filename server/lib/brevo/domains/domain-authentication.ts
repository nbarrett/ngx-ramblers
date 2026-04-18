import debug from "debug";
import { envConfig } from "../../env-config/env-config";
import { configuredCloudflare } from "../../cloudflare/cloudflare-config";
import { CloudflareDnsConfig } from "../../cloudflare/cloudflare.model";
import { createDnsRecord, deleteDnsRecord, listDnsRecords, zoneForHostname } from "../../cloudflare/cloudflare-dns";
import {
  authenticateDomain,
  deleteDomain,
  domainConfiguration,
  findDomainByName,
  registerDomain
} from "./domain-management";
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
  cleanupIncorrectParentDomain?: boolean;
  cloudflareDnsConfig?: CloudflareDnsConfig;
  baseDomainOverride?: string;
};

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function dkimAvailable(config: BrevoDomainConfiguration): boolean {
  return !!(config.dnsRecords.dkimRecord.hostName && config.dnsRecords.dkimRecord.value);
}

async function ensureDkimAvailable(domainName: string): Promise<BrevoDomainConfiguration> {
  const config = await domainConfiguration(domainName);
  if (config.authenticated || dkimAvailable(config)) {
    return config;
  }
  debugLog("DKIM missing for", domainName, "— deleting and re-registering to force Brevo to generate fresh DKIM");
  try {
    await deleteDomain(domainName);
  } catch (error) {
    debugLog("Delete during DKIM recovery failed (continuing):", error.message);
  }
  const fresh = await registerDomain(domainName);
  debugLog("Fresh registration dnsRecords:", JSON.stringify(fresh.dnsRecords));
  const dkimFromRegister = fresh.dnsRecords?.dkimRecord;
  if (dkimFromRegister?.hostName && dkimFromRegister?.value) {
    return {
      domain: domainName,
      authenticated: false,
      verified: false,
      dnsRecords: fresh.dnsRecords
    };
  }
  debugLog("Register response also lacked DKIM — falling back to getDomainConfiguration");
  return await domainConfiguration(domainName);
}

type DnsOutcome =
  | { type: "ok"; dnsRecordsConfigured: boolean }
  | { type: "failed"; errorMessage: string };

async function configureDnsRecords(cfDnsConfig: CloudflareDnsConfig, config: BrevoDomainConfiguration, baseDomain: string): Promise<DnsOutcome> {
  try {
    const dkimCreated = await ensureTxtRecord(cfDnsConfig, config.dnsRecords.dkimRecord, baseDomain);
    const brevoCodeCreated = await ensureTxtRecord(cfDnsConfig, config.dnsRecords.brevoCode, baseDomain);
    const dnsRecordsConfigured = dkimCreated || brevoCodeCreated;

    const allRecordsVerified = config.dnsRecords.brevoCode.status && (!dkimAvailable(config) || config.dnsRecords.dkimRecord.status);
    if (dnsRecordsConfigured && !allRecordsVerified) {
      debugLog("Waiting", DNS_PROPAGATION_DELAY_MS, "ms for DNS propagation");
      await delay(DNS_PROPAGATION_DELAY_MS);
    } else if (dnsRecordsConfigured) {
      debugLog("Skipping DNS propagation delay — records already verified by Brevo");
    }
    return { type: "ok", dnsRecordsConfigured };
  } catch (error) {
    debugLog("Cloudflare DNS configuration failed:", error.message);
    return { type: "failed", errorMessage: error.message };
  }
}

async function requestAuthentication(domainName: string): Promise<{ authenticationRequested: boolean; authError: string | null }> {
  try {
    const authResult = await authenticateDomain(domainName);
    debugLog("Authentication requested:", authResult.message);
    return { authenticationRequested: true, authError: null };
  } catch (error) {
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

async function cleanupStaleTxtRecords(cfDnsConfig: CloudflareDnsConfig, fqdn: string, currentValue: string | null): Promise<number> {
  const existing = await listDnsRecords(cfDnsConfig, fqdn, "TXT");
  const staleRecords = existing.filter(r => r.content !== currentValue);
  await Promise.all(staleRecords.map(async record => {
    debugLog("Deleting stale TXT record:", record.name, "->", record.content?.substring(0, 40));
    await deleteDnsRecord(cfDnsConfig, record.id);
  }));
  return staleRecords.length;
}

async function ensureTxtRecord(cfDnsConfig: CloudflareDnsConfig, record: BrevoDnsRecord, baseDomain: string): Promise<boolean> {
  if (!record.hostName || !record.value) {
    debugLog("Skipping DNS record with missing hostName or value:", record);
    return false;
  }

  const fqdn = record.hostName.endsWith(baseDomain) ? record.hostName : `${record.hostName}.${baseDomain}`;
  const staleCount = await cleanupStaleTxtRecords(cfDnsConfig, fqdn, record.value);
  if (staleCount > 0) {
    debugLog("Cleaned up", staleCount, "stale TXT record(s) for:", fqdn);
  }

  const current = await listDnsRecords(cfDnsConfig, fqdn, "TXT");
  if (current.some(r => r.content === record.value)) {
    debugLog("TXT record already exists:", fqdn);
    return true;
  }

  debugLog("Creating TXT record:", fqdn, "->", record.value);
  await createDnsRecord(cfDnsConfig, {
    type: "TXT",
    name: record.hostName,
    content: record.value,
    ttl: 1,
    proxied: false
  });
  return true;
}

async function cleanupIncorrectParentDomain(domainName: string): Promise<void> {
  try {
    const cfConfig = await configuredCloudflare();
    const configuredBaseDomain = cfConfig.baseDomain || "";
    if (!configuredBaseDomain || !domainName.endsWith(`.${configuredBaseDomain}`)) {
      return;
    }
    const labels = domainName.split(".");
    if (labels.length < 3) {
      return;
    }
    const parentDomain = labels.slice(1).join(".");
    if (!parentDomain || parentDomain !== configuredBaseDomain) {
      return;
    }
    const existingParentDomain = await findDomainByName(parentDomain);
    if (!existingParentDomain) {
      return;
    }
    debugLog("Removing previously registered parent domain:", parentDomain);
    await deleteDomain(parentDomain);
  } catch (error) {
    debugLog("Parent domain cleanup skipped:", error.message);
  }
}

export async function authenticateSendingDomain(domainName: string, options: DomainAuthenticationOptions = {}): Promise<DomainAuthenticationResult> {
  debugLog("Starting domain authentication for:", domainName);
  if (options.cleanupIncorrectParentDomain) {
    await cleanupIncorrectParentDomain(domainName);
  }

  const existingDomain = await findDomainByName(domainName);
  if (!existingDomain) {
    debugLog("Domain not registered, registering:", domainName);
    await registerDomain(domainName);
  } else {
    debugLog("Domain already registered:", domainName);
  }
  const registered = true;

  const config = await ensureDkimAvailable(domainName);
  debugLog("Domain config, authenticated:", config.authenticated, "verified:", config.verified, "DKIM available:", dkimAvailable(config));

  if (config.authenticated && config.verified) {
    return {
      domainName,
      registered,
      dnsRecordsConfigured: true,
      authenticationRequested: false,
      authenticated: true,
      verified: true,
      dnsRecords: config.dnsRecords,
      message: "Domain already fully authenticated and verified"
    };
  }

  const { cfDnsConfig, baseDomain } = await resolveCfAndBaseDomain(options, domainName);

  const dnsOutcome = await configureDnsRecords(cfDnsConfig, config, baseDomain);
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
  }
  const dnsRecordsConfigured = dnsOutcome.dnsRecordsConfigured;

  const { authenticationRequested, authError } = await requestAuthentication(domainName);

  const finalConfig = await domainConfiguration(domainName);
  const missingDkim = !dkimAvailable(config);
  const message = finalConfig.authenticated
    ? "Domain successfully authenticated"
    : authError && missingDkim
      ? `Brevo code is configured in DNS, but Brevo did not return a DKIM record for ${domainName} via API. To complete authentication, open ${domainName} in Brevo, click "Authenticate", choose "Authenticate the domain yourself", then retry here.`
      : authError
        ? `Authentication failed: ${authError}`
        : "Authentication requested, DNS verification may still be propagating";

  return {
    domainName,
    registered,
    dnsRecordsConfigured,
    authenticationRequested,
    authenticated: finalConfig.authenticated,
    verified: finalConfig.verified,
    dnsRecords: finalConfig.dnsRecords,
    message,
    brevoDomainsUrl: finalConfig.authenticated ? null : BREVO_DOMAINS_URL
  };
}
