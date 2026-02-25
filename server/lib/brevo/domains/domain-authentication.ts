import debug from "debug";
import { envConfig } from "../../env-config/env-config";
import { configuredCloudflare } from "../../cloudflare/cloudflare-config";
import { CloudflareDnsConfig } from "../../cloudflare/cloudflare.model";
import { createDnsRecord, listDnsRecords } from "../../cloudflare/cloudflare-dns";
import {
  authenticateDomain,
  domainConfiguration,
  findDomainByName,
  registerDomain
} from "./domain-management";
import {
  BrevoDnsRecord,
  BrevoDomainDnsRecords,
  DomainAuthenticationResult
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const debugLog = debug(envConfig.logNamespace("brevo:domain-authentication"));
debugLog.enabled = true;

const DNS_PROPAGATION_DELAY_MS = 10000;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function ensureTxtRecord(cfConfig: CloudflareDnsConfig, record: BrevoDnsRecord): Promise<boolean> {
  if (!record.hostName || !record.value) {
    debugLog("Skipping DNS record with missing hostName or value:", record);
    return false;
  }

  const existing = await listDnsRecords(cfConfig, record.hostName, "TXT");
  const alreadyExists = existing.some(r => r.content === record.value);

  if (alreadyExists) {
    debugLog("TXT record already exists:", record.hostName);
    return true;
  }

  debugLog("Creating TXT record:", record.hostName, "->", record.value);
  await createDnsRecord(cfConfig, {
    type: "TXT",
    name: record.hostName,
    content: record.value,
    ttl: 1,
    proxied: false
  });
  return true;
}

function emptyDnsRecords(): BrevoDomainDnsRecords {
  return {
    dkimRecord: {type: "", hostName: "", value: "", status: false},
    brevoCode: {type: "", hostName: "", value: "", status: false}
  };
}

export async function authenticateSendingDomain(domainName: string): Promise<DomainAuthenticationResult> {
  debugLog("Starting domain authentication for:", domainName);

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
  debugLog("Domain configuration retrieved, authenticated:", config.authenticated, "verified:", config.verified);

  if (config.authenticated && config.verified) {
    return {
      domainName,
      registered,
      dnsRecordsConfigured: true,
      authenticationRequested: false,
      authenticated: config.authenticated,
      verified: config.verified,
      dnsRecords: config.dnsRecords,
      message: "Domain already fully authenticated and verified"
    };
  }

  let dnsRecordsConfigured = false;
  try {
    const cfConfig = await configuredCloudflare();
    const cfDnsConfig: CloudflareDnsConfig = {
      apiToken: cfConfig.apiToken,
      zoneId: cfConfig.zoneId
    };

    const dkimCreated = await ensureTxtRecord(cfDnsConfig, config.dnsRecords.dkimRecord);
    const brevoCodeCreated = await ensureTxtRecord(cfDnsConfig, config.dnsRecords.brevoCode);
    dnsRecordsConfigured = dkimCreated || brevoCodeCreated;

    if (dnsRecordsConfigured) {
      debugLog("Waiting", DNS_PROPAGATION_DELAY_MS, "ms for DNS propagation");
      await delay(DNS_PROPAGATION_DELAY_MS);
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
  try {
    const authResult = await authenticateDomain(domainName);
    authenticationRequested = true;
    debugLog("Authentication requested:", authResult.message);
  } catch (error) {
    debugLog("Authentication request failed:", error.message);
  }

  const finalConfig = await domainConfiguration(domainName);

  return {
    domainName,
    registered,
    dnsRecordsConfigured,
    authenticationRequested,
    authenticated: finalConfig.authenticated,
    verified: finalConfig.verified,
    dnsRecords: finalConfig.dnsRecords,
    message: finalConfig.authenticated
      ? "Domain successfully authenticated"
      : "Authentication requested, DNS verification may still be propagating"
  };
}
