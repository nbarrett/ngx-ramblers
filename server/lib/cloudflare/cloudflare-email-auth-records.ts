import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { CloudflareDnsConfig, DnsRecordType } from "./cloudflare.model";
import { DmarcRecordStatus, EmailAuthRecordsStatus, SpfRecordStatus } from "../../../projects/ngx-ramblers/src/app/models/cloudflare-email-routing.model";
import { createDnsRecord, listDnsRecords, updateDnsRecord } from "./cloudflare-dns";

const debugLog = debug(envConfig.logNamespace("cloudflare:email-auth-records"));

export const REQUIRED_SPF_INCLUDES = ["_spf.mx.cloudflare.net", "spf.brevo.com"];
export const DEFAULT_SPF_QUALIFIER = "~all";
export const BREVO_DMARC_RUA_URI = "mailto:rua@dmarc.brevo.com";
export const BREVO_DMARC_REPORTING_TAG = `rua=${BREVO_DMARC_RUA_URI}`;
export const DEFAULT_DMARC_POLICY = `v=DMARC1; p=none; ${BREVO_DMARC_REPORTING_TAG};`;

function unquoteTxtContent(content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function extractIncludes(spfContent: string): string[] {
  const matches: string[] = spfContent.match(/include:\S+/gi) || [];
  return matches.map((token: string) => token.slice("include:".length));
}

function extractAllQualifier(spfContent: string): string {
  const match = spfContent.match(/[~\-+?]all\b/i);
  return match ? match[0] : DEFAULT_SPF_QUALIFIER;
}

interface DmarcTagPart {
  rawName: string;
  name: string;
  value: string;
}

function dmarcTagParts(content: string): DmarcTagPart[] {
  return content.split(";").map(part => part.trim()).filter(part => part.length > 0).map(part => {
    const separator = part.indexOf("=");
    if (separator < 0) {
      return { rawName: part, name: part.toLowerCase(), value: "" };
    } else {
      const rawName = part.slice(0, separator).trim();
      return { rawName, name: rawName.toLowerCase(), value: part.slice(separator + 1).trim() };
    }
  });
}

function ruaUris(tag: DmarcTagPart): string[] {
  return tag.value.split(",").map(uri => uri.trim().toLowerCase()).filter(uri => uri.length > 0);
}

export function dmarcReportingConfigured(content: string): boolean {
  const tags = dmarcTagParts(content);
  const ruaTags = tags.filter(tag => tag.name === "rua");
  const uris = ruaTags.length === 1 ? ruaUris(ruaTags[0]) : [];
  const forensicPresent = tags.some(tag => tag.name === "ruf");
  return ruaTags.length === 1 && uris.length === 1 && uris[0] === BREVO_DMARC_RUA_URI && !forensicPresent;
}

export function withBrevoDmarcReporting(content: string): string {
  const source = content.trim() || DEFAULT_DMARC_POLICY;
  const kept = dmarcTagParts(source).filter(tag => tag.name !== "rua" && tag.name !== "ruf");
  const rebuilt = kept.map(tag => tag.value.length === 0 ? tag.rawName : `${tag.rawName}=${tag.value}`);
  rebuilt.push(BREVO_DMARC_REPORTING_TAG);
  return `${rebuilt.join("; ")};`;
}

export function buildSpfContent(existingIncludes: string[], qualifier: string = DEFAULT_SPF_QUALIFIER, otherMechanisms: string[] = []): string {
  const seen = new Set<string>();
  const merged: string[] = [];
  [...existingIncludes, ...REQUIRED_SPF_INCLUDES].forEach(include => {
    const key = include.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(include);
    }
  });
  const parts = ["v=spf1", ...merged.map(inc => `include:${inc}`), ...otherMechanisms, qualifier];
  return parts.join(" ");
}

function otherMechanismsIn(spfContent: string): string[] {
  const tokens = spfContent.split(/\s+/).slice(1);
  return tokens.filter(token =>
    token
    && !/^include:/i.test(token)
    && !/^[~\-+?]?all$/i.test(token)
  );
}

export async function querySpfStatus(dnsConfig: CloudflareDnsConfig, domain: string): Promise<SpfRecordStatus> {
  const records = await listDnsRecords(dnsConfig, domain, DnsRecordType.TXT);
  const spfRecords = records.filter(record => /^"?v=spf1\b/i.test(record.content));
  const multiple = spfRecords.length > 1;
  if (spfRecords.length === 0) {
    return {
      domain,
      present: false,
      multiple: false,
      rawContent: null,
      existingIncludes: [],
      missingIncludes: [...REQUIRED_SPF_INCLUDES],
      extraIncludes: [],
      allPresent: false,
      recordId: null
    };
  } else {
    const chosen = spfRecords[0];
    const content = unquoteTxtContent(chosen.content);
    const existingIncludes = extractIncludes(content);
    const normalisedExisting = new Set(existingIncludes.map(i => i.toLowerCase()));
    const missingIncludes = REQUIRED_SPF_INCLUDES.filter(required => !normalisedExisting.has(required.toLowerCase()));
    const required = new Set(REQUIRED_SPF_INCLUDES.map(include => include.toLowerCase()));
    const extraIncludes = existingIncludes.filter(include => !required.has(include.toLowerCase()));
    return {
      domain,
      present: true,
      multiple,
      rawContent: content,
      existingIncludes,
      missingIncludes,
      extraIncludes,
      allPresent: !multiple && missingIncludes.length === 0,
      recordId: chosen.id
    };
  }
}

async function queryDmarcStatusForPolicyDomain(dnsConfig: CloudflareDnsConfig, domain: string, policyDomain: string): Promise<DmarcRecordStatus> {
  const dmarcHostname = `_dmarc.${policyDomain}`;
  const records = await listDnsRecords(dnsConfig, dmarcHostname, DnsRecordType.TXT);
  const dmarcRecord = records.find(record => /^"?v=DMARC1\b/i.test(record.content));
  if (!dmarcRecord) {
    return {
      domain,
      dmarcHostname,
      present: false,
      rawContent: null,
      policy: null,
      reportingConfigured: false,
      inherited: policyDomain !== domain,
      recordId: null
    };
  }
  const content = unquoteTxtContent(dmarcRecord.content);
  const policyMatch = content.match(/\bp=([a-z]+)/i);
  return {
    domain,
    dmarcHostname,
    present: true,
    rawContent: content,
    policy: policyMatch ? policyMatch[1].toLowerCase() : null,
    reportingConfigured: dmarcReportingConfigured(content),
    inherited: policyDomain !== domain,
    recordId: dmarcRecord.id
  };
}

export async function queryDmarcStatus(dnsConfig: CloudflareDnsConfig, domain: string, policyDomain: string = domain): Promise<DmarcRecordStatus> {
  const directStatus = await queryDmarcStatusForPolicyDomain(dnsConfig, domain, domain);
  if (directStatus.present || policyDomain === domain) {
    return directStatus;
  }
  return queryDmarcStatusForPolicyDomain(dnsConfig, domain, policyDomain);
}

export async function queryEmailAuthStatus(dnsConfig: CloudflareDnsConfig, domain: string, policyDomain: string = domain): Promise<EmailAuthRecordsStatus> {
  const [spf, dmarc] = await Promise.all([
    querySpfStatus(dnsConfig, domain),
    queryDmarcStatus(dnsConfig, domain, policyDomain)
  ]);
  return { domain, spf, dmarc };
}

export async function ensureSpfRecord(dnsConfig: CloudflareDnsConfig, domain: string): Promise<SpfRecordStatus> {
  const current = await querySpfStatus(dnsConfig, domain);
  if (current.multiple) {
    throw new Error(`Multiple SPF (v=spf1) records found on ${domain}. RFC 7208 requires exactly one — consolidate manually in Cloudflare before retrying.`);
  }
  if (current.allPresent) {
    debugLog("SPF already contains all required includes for", domain);
    return current;
  }
  if (!current.present) {
    const desired = buildSpfContent([], DEFAULT_SPF_QUALIFIER);
    debugLog("Creating SPF record for %s -> %s", domain, desired);
    await createDnsRecord(dnsConfig, { type: DnsRecordType.TXT, name: domain, content: desired, ttl: 1, proxied: false });
    return querySpfStatus(dnsConfig, domain);
  }
  const qualifier = extractAllQualifier(current.rawContent || "");
  const otherMechanisms = otherMechanismsIn(current.rawContent || "");
  const updated = buildSpfContent(current.existingIncludes, qualifier, otherMechanisms);
  debugLog("Updating SPF record %s for %s: %s -> %s", current.recordId, domain, current.rawContent, updated);
  await updateDnsRecord(dnsConfig, current.recordId, { type: DnsRecordType.TXT, name: domain, content: updated, ttl: 1, proxied: false });
  return querySpfStatus(dnsConfig, domain);
}

export async function stripLeftoverSpfIncludes(dnsConfig: CloudflareDnsConfig, domain: string): Promise<SpfRecordStatus> {
  const current = await querySpfStatus(dnsConfig, domain);
  if (current.multiple) {
    throw new Error(`Multiple SPF (v=spf1) records found on ${domain}. RFC 7208 requires exactly one — consolidate manually in Cloudflare before retrying.`);
  } else if (!current.present || current.extraIncludes.length === 0 || !current.recordId) {
    return current;
  } else {
    const qualifier = extractAllQualifier(current.rawContent || "");
    const otherMechanisms = otherMechanismsIn(current.rawContent || "");
    const updated = buildSpfContent([], qualifier, otherMechanisms);
    debugLog("Stripping leftover SPF includes for %s: %s -> %s", domain, current.rawContent, updated);
    await updateDnsRecord(dnsConfig, current.recordId, { type: DnsRecordType.TXT, name: domain, content: updated, ttl: 1, proxied: false });
    return querySpfStatus(dnsConfig, domain);
  }
}

export async function ensureDmarcRecord(dnsConfig: CloudflareDnsConfig, domain: string, policyDomain: string = domain): Promise<DmarcRecordStatus> {
  const current = await queryDmarcStatus(dnsConfig, domain, policyDomain);
  if (current.present && current.reportingConfigured) {
    debugLog("DMARC already present with aggregate reporting for", domain, "policy:", current.policy);
    return current;
  }
  if (current.present) {
    const updated = withBrevoDmarcReporting(current.rawContent || DEFAULT_DMARC_POLICY);
    debugLog("Adding DMARC aggregate reporting for %s -> %s", domain, updated);
    await updateDnsRecord(dnsConfig, current.recordId, { type: DnsRecordType.TXT, name: current.dmarcHostname, content: updated, ttl: 1, proxied: false });
  } else {
    debugLog("Creating DMARC record for %s -> %s", domain, DEFAULT_DMARC_POLICY);
    await createDnsRecord(dnsConfig, { type: DnsRecordType.TXT, name: current.dmarcHostname, content: DEFAULT_DMARC_POLICY, ttl: 1, proxied: false });
  }
  return queryDmarcStatus(dnsConfig, domain, policyDomain);
}

export async function ensureEmailAuthRecords(dnsConfig: CloudflareDnsConfig, domain: string, policyDomain: string = domain): Promise<EmailAuthRecordsStatus> {
  const spf = await ensureSpfRecord(dnsConfig, domain);
  const dmarc = await ensureDmarcRecord(dnsConfig, domain, policyDomain);
  return { domain, spf, dmarc };
}
