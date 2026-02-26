import * as SibApiV3Sdk from "@getbrevo/brevo";
import debug from "debug";
import * as http from "http";
import { envConfig } from "../../env-config/env-config";
import { configuredBrevo } from "../brevo-config";
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

async function apiInstance(): Promise<SibApiV3Sdk.DomainsApi> {
  const brevoConfig = await configuredBrevo();
  const api = new SibApiV3Sdk.DomainsApi();
  api.setApiKey(SibApiV3Sdk.DomainsApiApiKeys.apiKey, brevoConfig.apiKey);
  return api;
}

function mapDnsRecord(record: { type?: string; hostName?: string; value?: string; status?: boolean }): BrevoDnsRecord {
  return {
    type: record?.type || "",
    hostName: record?.hostName || "",
    value: record?.value || "",
    status: record?.status || false
  };
}

function mapDnsRecords(records: { dkimRecord?: any; brevoCode?: any }): BrevoDomainDnsRecords {
  return {
    dkimRecord: mapDnsRecord(records?.dkimRecord),
    brevoCode: mapDnsRecord(records?.brevoCode)
  };
}

export async function listDomains(): Promise<BrevoDomainInfo[]> {
  const api = await apiInstance();
  const response: { response: http.IncomingMessage; body: any } = await api.getDomains();
  const domains = response.body?.domains || [];
  debugLog("listDomains: found", domains.length, "domains");
  return domains.map((d: any) => ({
    id: d.id,
    domainName: d.domainName,
    authenticated: d.authenticated,
    verified: d.verified
  }));
}

export async function registerDomain(name: string): Promise<DomainRegistrationResult> {
  const api = await apiInstance();
  const createDomain = new SibApiV3Sdk.CreateDomain();
  createDomain.name = name;
  debugLog("registerDomain:", name);
  const response: { response: http.IncomingMessage; body: any } = await api.createDomain(createDomain);
  const body = response.body;
  debugLog("registerDomain raw response:", JSON.stringify(body));
  return {
    id: body.id,
    domainName: name,
    alreadyRegistered: false,
    dnsRecords: mapDnsRecords(body.dnsRecords)
  };
}

export async function domainConfiguration(domainName: string): Promise<BrevoDomainConfiguration> {
  const api = await apiInstance();
  debugLog("domainConfiguration:", domainName);
  const response: { response: http.IncomingMessage; body: any } = await api.getDomainConfiguration(domainName);
  const body = response.body;
  debugLog("domainConfiguration raw dnsRecords:", JSON.stringify(body.dnsRecords));
  return {
    domain: body.domain,
    verified: body.verified,
    authenticated: body.authenticated,
    dnsRecords: mapDnsRecords(body.dnsRecords)
  };
}

export async function authenticateDomain(domainName: string): Promise<{ domainName: string; message: string }> {
  const api = await apiInstance();
  debugLog("authenticateDomain:", domainName);
  try {
    const response: { response: http.IncomingMessage; body: any } = await api.authenticateDomain(domainName);
    debugLog("authenticateDomain response:", response.response.statusCode, JSON.stringify(response.body));
    return {
      domainName: response.body.domainName || domainName,
      message: response.body.message || "Authentication requested"
    };
  } catch (error) {
    const statusCode = error?.response?.statusCode || error?.status || "unknown";
    const responseBody = error?.response?.body || error?.body || null;
    debugLog("authenticateDomain error:", statusCode, JSON.stringify(responseBody), error.message);
    throw new Error(`Authentication failed (HTTP ${statusCode}): ${responseBody?.message || error.message}`);
  }
}

export async function deleteDomain(domainName: string): Promise<void> {
  const api = await apiInstance();
  debugLog("deleteDomain:", domainName);
  await api.deleteDomain(domainName);
}

export async function findDomainByName(name: string): Promise<BrevoDomainInfo | null> {
  const domains = await listDomains();
  return domains.find(d => d.domainName === name) || null;
}
