import debug from "debug";
import { envConfig } from "../../env-config/env-config";
import { brevoClient } from "../brevo-config";
import { logBrevoError } from "../common/error-log";
import { Brevo, BrevoError } from "@getbrevo/brevo";
import {
  BrevoDnsRecord,
  BrevoDomainConfiguration,
  BrevoDomainDnsRecords,
  BrevoDomainInfo,
  DomainRegistrationResult
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const messageType = "brevo:domain-management";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = true;

const EMPTY_DNS_RECORD: BrevoDnsRecord = {type: "", hostName: "", value: "", status: false};

async function domainsApi() {
  const client = await brevoClient();
  return client.domains;
}

function mapDnsRecord(record: { type: string; host_name: string; value: string; status: boolean } | null | undefined): BrevoDnsRecord {
  if (!record) {
    return EMPTY_DNS_RECORD;
  }
  return {
    type: record.type,
    hostName: record.host_name,
    value: record.value,
    status: record.status
  };
}

function mapDnsRecords(records: Brevo.CreateDomainResponse.DnsRecords | Brevo.GetDomainConfigurationResponse.DnsRecords | undefined): BrevoDomainDnsRecords {
  return {
    dkimRecord: mapDnsRecord(records?.dkim_record),
    brevoCode: mapDnsRecord(records?.brevo_code)
  };
}

export async function listDomains(): Promise<BrevoDomainInfo[]> {
  const api = await domainsApi();
  const response = await api.getDomains();
  const domains = response.domains ?? [];
  debugLog("listDomains: found", domains.length, "domains");
  return domains.map(domain => ({
    id: Number(domain.id),
    domainName: domain.domain_name,
    authenticated: domain.authenticated,
    verified: domain.verified
  }));
}

export async function registerDomain(name: string): Promise<DomainRegistrationResult> {
  const api = await domainsApi();
  debugLog("registerDomain:", name);
  const body = await api.createDomain({name});
  debugLog("registerDomain raw response:", JSON.stringify(body));
  return {
    id: body.id,
    domainName: name,
    alreadyRegistered: false,
    dnsRecords: mapDnsRecords(body.dns_records)
  };
}

export async function domainConfiguration(domainName: string): Promise<BrevoDomainConfiguration> {
  const api = await domainsApi();
  debugLog("domainConfiguration:", domainName);
  const body = await api.getDomainConfiguration({domainName});
  debugLog("domainConfiguration raw dnsRecords:", JSON.stringify(body.dns_records));
  return {
    domain: body.domain,
    verified: body.verified,
    authenticated: body.authenticated,
    dnsRecords: mapDnsRecords(body.dns_records)
  };
}

export async function authenticateDomain(domainName: string): Promise<{ domainName: string; message: string }> {
  const api = await domainsApi();
  debugLog("authenticateDomain:", domainName);
  try {
    const body = await api.authenticateDomain({domainName});
    return {
      domainName: body.domain_name || domainName,
      message: body.message || "Authentication requested"
    };
  } catch (error) {
    logBrevoError(messageType, error, {domainName});
    const brevoError = error instanceof BrevoError ? error : null;
    const statusCode = brevoError?.statusCode ?? "unknown";
    const responseBody = (brevoError?.body ?? null) as { message?: string } | null;
    const errorMessage = error instanceof Error ? error.message : String(error);
    debugLog("authenticateDomain error:", statusCode, JSON.stringify(responseBody), errorMessage);
    throw new Error(`Authentication failed (HTTP ${statusCode}): ${responseBody?.message || errorMessage}`);
  }
}

export async function deleteDomain(domainName: string): Promise<void> {
  const api = await domainsApi();
  debugLog("deleteDomain:", domainName);
  await api.deleteDomain({domainName});
}

export async function findDomainByName(name: string): Promise<BrevoDomainInfo | null> {
  const domains = await listDomains();
  return domains.find(d => d.domainName === name) || null;
}
