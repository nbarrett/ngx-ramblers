import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { cloudflareApi, CloudflareDnsConfig, CloudflareResponse, CloudflareZone, DnsRecord, DnsRecordResult } from "./cloudflare.model";

const debugLog = debug(envConfig.logNamespace("cloudflare:dns"));

export async function createDnsRecord(config: CloudflareDnsConfig, record: DnsRecord): Promise<DnsRecordResult> {
  const url = cloudflareApi.zoneDnsRecords(config.zoneId);

  debugLog("Creating DNS record: %s %s -> %s", record.type, record.name, record.content);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.apiToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      type: record.type,
      name: record.name,
      content: record.content,
      ttl: record.ttl ?? 1,
      proxied: record.proxied ?? false,
      ...(record.priority !== undefined ? {priority: record.priority} : {})
    })
  });

  const data: CloudflareResponse<DnsRecordResult> = await response.json();

  if (!data.success) {
    const errorMsg = data.errors.map(e => e.message).join(", ");
    throw new Error(`Failed to create DNS record: ${errorMsg}`);
  }

  debugLog("DNS record created: %s", data.result.id);
  return data.result;
}

export async function listDnsRecords(config: CloudflareDnsConfig, name?: string, type?: DnsRecord["type"]): Promise<DnsRecordResult[]> {
  const params = new URLSearchParams();
  if (name) {
    params.set("name", name);
  }
  if (type) {
    params.set("type", type);
  }
  const url = cloudflareApi.zoneDnsRecords(config.zoneId, params.toString());

  const response = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${config.apiToken}`,
      "Content-Type": "application/json"
    }
  });

  const data: CloudflareResponse<DnsRecordResult[]> = await response.json();

  if (!data.success) {
    const errorMsg = data.errors.map(e => e.message).join(", ");
    throw new Error(`Failed to list DNS records: ${errorMsg}`);
  }

  return data.result;
}

export async function updateDnsRecord(config: CloudflareDnsConfig, recordId: string, record: DnsRecord): Promise<DnsRecordResult> {
  const url = cloudflareApi.zoneDnsRecord(config.zoneId, recordId);

  debugLog("Updating DNS record %s: %s %s -> %s", recordId, record.type, record.name, record.content);

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${config.apiToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      type: record.type,
      name: record.name,
      content: record.content,
      ttl: record.ttl ?? 1,
      proxied: record.proxied ?? false,
      ...(record.priority !== undefined ? {priority: record.priority} : {})
    })
  });

  const data: CloudflareResponse<DnsRecordResult> = await response.json();

  if (!data.success) {
    const errorMsg = data.errors.map(e => e.message).join(", ");
    throw new Error(`Failed to update DNS record: ${errorMsg}`);
  }

  debugLog("DNS record updated: %s", data.result.id);
  return data.result;
}

export async function deleteDnsRecord(config: CloudflareDnsConfig, recordId: string): Promise<void> {
  const url = cloudflareApi.zoneDnsRecord(config.zoneId, recordId);

  debugLog("Deleting DNS record: %s", recordId);

  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${config.apiToken}`
    }
  });

  const data: CloudflareResponse<{ id: string }> = await response.json();

  if (!data.success) {
    const errorMsg = data.errors.map(e => e.message).join(", ");
    throw new Error(`Failed to delete DNS record: ${errorMsg}`);
  }

  debugLog("DNS record deleted");
}

export async function verifyToken(apiToken: string): Promise<boolean> {
  const response = await fetch(cloudflareApi.verifyToken(), {
    headers: {
      "Authorization": `Bearer ${apiToken}`
    }
  });

  const data = await response.json();
  return data.success === true;
}

export async function listZones(apiToken: string, name?: string): Promise<CloudflareZone[]> {
  const params = new URLSearchParams();
  if (name) {
    params.set("name", name);
  }
  const url = cloudflareApi.zones(params.toString());

  const response = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${apiToken}`,
      "Content-Type": "application/json"
    }
  });

  const data: CloudflareResponse<CloudflareZone[]> = await response.json();

  if (!data.success) {
    const errorMsg = data.errors.map(e => e.message).join(", ");
    throw new Error(`Failed to list Cloudflare zones: ${errorMsg}`);
  }

  return data.result;
}

function candidateZoneNames(hostname: string): string[] {
  const labels = hostname.split(".");
  return labels
    .map((_, index) => labels.slice(index).join("."))
    .filter(candidate => candidate.includes("."));
}

export async function zoneForHostname(apiToken: string, hostname: string): Promise<CloudflareZone | null> {
  const candidates = candidateZoneNames(hostname);
  for (const candidate of candidates) {
    const zones = await listZones(apiToken, candidate);
    const match = zones.find(zone => zone.name === candidate);
    if (match) {
      debugLog("Resolved zone for %s: %s (%s)", hostname, match.name, match.id);
      return match;
    }
  }
  return null;
}
