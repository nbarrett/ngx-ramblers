import debug from "debug";
import { envConfig } from "../../env-config/env-config";
import { configuredCloudflare } from "../../cloudflare/cloudflare-config";
import { CloudflareDnsConfig } from "../../cloudflare/cloudflare.model";
import { createDnsRecord, deleteDnsRecord, listDnsRecords } from "../../cloudflare/cloudflare-dns";
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

type DomainAuthenticationOptions = {
  cleanupIncorrectParentDomain?: boolean;
};

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function dkimAvailable(config: BrevoDomainConfiguration): boolean {
  return !!(config.dnsRecords.dkimRecord.hostName && config.dnsRecords.dkimRecord.value);
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
  let registered = !!existingDomain;

  if (!registered) {
    debugLog("Domain not registered, registering:", domainName);
    await registerDomain(domainName);
    registered = true;
  } else {
    debugLog("Domain already registered:", domainName);
  }

  const config = await domainConfiguration(domainName);
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

  const cfConfig = await configuredCloudflare();
  const cfDnsConfig: CloudflareDnsConfig = {
    apiToken: cfConfig.apiToken,
    zoneId: cfConfig.zoneId
  };
  const baseDomain = cfConfig.baseDomain || domainName;

  let dnsRecordsConfigured = false;
  try {
    const dkimCreated = await ensureTxtRecord(cfDnsConfig, config.dnsRecords.dkimRecord, baseDomain);
    const brevoCodeCreated = await ensureTxtRecord(cfDnsConfig, config.dnsRecords.brevoCode, baseDomain);
    dnsRecordsConfigured = dkimCreated || brevoCodeCreated;

    const allRecordsVerified = config.dnsRecords.brevoCode.status && (!dkimAvailable(config) || config.dnsRecords.dkimRecord.status);
    if (dnsRecordsConfigured && !allRecordsVerified) {
      debugLog("Waiting", DNS_PROPAGATION_DELAY_MS, "ms for DNS propagation");
      await delay(DNS_PROPAGATION_DELAY_MS);
    } else if (dnsRecordsConfigured) {
      debugLog("Skipping DNS propagation delay — records already verified by Brevo");
    }
  } catch (error) {
    debugLog("Cloudflare DNS configuration failed:", error.message);
    return {
      domainName,
      registered,
      dnsRecordsConfigured: false,
      authenticationRequested: false,
      authenticated: false,
      verified: false,
      dnsRecords: config.dnsRecords,
      message: `DNS configuration failed: ${error.message}`
    };
  }

  let authenticationRequested = false;
  let authError: string | null = null;
  try {
    const authResult = await authenticateDomain(domainName);
    authenticationRequested = true;
    debugLog("Authentication requested:", authResult.message);
  } catch (error) {
    authError = error.message || "Unknown error";
    debugLog("Authentication request failed:", authError);
  }

  const finalConfig = await domainConfiguration(domainName);
  const missingDkim = !dkimAvailable(config);
  const brevoDomainsUrl = "https://app.brevo.com/senders/domain/list";
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
    brevoDomainsUrl: (!finalConfig.authenticated && missingDkim) ? brevoDomainsUrl : null
  };
}
