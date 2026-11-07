import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { configuredEnvironments } from "../environments/environments-config";
import { listDnsRecords, updateDnsRecord, zoneForHostname } from "../cloudflare/cloudflare-dns";
import { CloudflareDnsConfig, DnsRecordType, REDIRECT_PLACEHOLDER_IPV4 } from "../cloudflare/cloudflare.model";
import { loadEnvironmentContext } from "./environment-context";

const debugLog = debug(envConfig.logNamespace("environment-setup:set-dns-only"));

const ADDRESS_RECORD_TYPES = [DnsRecordType.A, DnsRecordType.AAAA, DnsRecordType.CNAME];

export interface SetDnsOnlyResult {
  hostname: string;
  updated: number;
  logs: string[];
}

export async function setHostnameDnsOnly(environmentName: string, hostnameInput: string): Promise<SetDnsOnlyResult> {
  const hostname = hostnameInput.trim().toLowerCase();
  const logs: string[] = [];
  await loadEnvironmentContext(environmentName);
  const environmentsConfig = await configuredEnvironments();
  const apiToken = environmentsConfig?.cloudflare?.apiToken;
  if (!apiToken) {
    throw new Error("Cloudflare API token not configured. Add cloudflare.apiToken to environments config.");
  } else {
    const zone = await zoneForHostname(apiToken, hostname);
    if (!zone) {
      throw new Error(`No Cloudflare zone covers ${hostname}`);
    } else {
      const dnsConfig: CloudflareDnsConfig = {apiToken, zoneId: zone.id};
      const records = (await listDnsRecords(dnsConfig, hostname))
        .filter(record => ADDRESS_RECORD_TYPES.includes(record.type as DnsRecordType));
      if (records.length === 0) {
        throw new Error(`No A, AAAA or CNAME record exists for ${hostname}`);
      } else if (records.some(record => record.content === REDIRECT_PLACEHOLDER_IPV4)) {
        throw new Error(`${hostname} is a Cloudflare redirect placeholder. Use Repair redirect, not DNS only.`);
      } else {
        const proxied = records.filter(record => record.proxied);
        if (proxied.length === 0) {
          logs.push(`  - ${hostname} is already DNS only`);
          return {hostname, updated: 0, logs};
        } else {
          await Promise.all(proxied.map(async record => {
            await updateDnsRecord(dnsConfig, record.id, {
              type: record.type as DnsRecordType,
              name: record.name,
              content: record.content,
              ttl: record.ttl,
              proxied: false,
              priority: record.priority
            });
            logs.push(`  ✓ Set ${record.type} ${hostname} to DNS only`);
            debugLog("Set %s %s to DNS only", record.type, hostname);
          }));
          return {hostname, updated: proxied.length, logs};
        }
      }
    }
  }
}
