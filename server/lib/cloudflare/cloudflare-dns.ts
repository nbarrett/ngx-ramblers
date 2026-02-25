import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { CloudflareDnsConfig, CloudflareResponse, DnsRecord, DnsRecordResult } from "./cloudflare.model";

const debugLog = debug(envConfig.logNamespace("cloudflare:dns"));

export async function createDnsRecord(config: CloudflareDnsConfig, record: DnsRecord): Promise<DnsRecordResult> {
  const url = `https://api.cloudflare.com/client/v4/zones/${config.zoneId}/dns_records`;

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
      proxied: record.proxied ?? false
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
  const queryString = params.toString();
  const url = `https://api.cloudflare.com/client/v4/zones/${config.zoneId}/dns_records${queryString ? `?${queryString}` : ""}`;

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

export async function deleteDnsRecord(config: CloudflareDnsConfig, recordId: string): Promise<void> {
  const url = `https://api.cloudflare.com/client/v4/zones/${config.zoneId}/dns_records/${recordId}`;

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
  const response = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", {
    headers: {
      "Authorization": `Bearer ${apiToken}`
    }
  });

  const data = await response.json();
  return data.success === true;
}
