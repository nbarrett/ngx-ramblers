export const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";

export const cloudflareApi = {
  base: CLOUDFLARE_API_BASE,
  zones: (params = "") => `${CLOUDFLARE_API_BASE}/zones${params ? `?${params}` : ""}`,
  zoneDnsRecords: (zoneId: string, params = "") => `${CLOUDFLARE_API_BASE}/zones/${zoneId}/dns_records${params ? `?${params}` : ""}`,
  zoneDnsRecord: (zoneId: string, recordId: string) => `${CLOUDFLARE_API_BASE}/zones/${zoneId}/dns_records/${recordId}`,
  verifyToken: () => `${CLOUDFLARE_API_BASE}/user/tokens/verify`,
  accountEmailDestinationAddresses: (accountId: string) => `${CLOUDFLARE_API_BASE}/accounts/${accountId}/email/routing/addresses`,
  zoneEmailRoutingRules: (zoneId: string) => `${CLOUDFLARE_API_BASE}/zones/${zoneId}/email/routing/rules`,
  accountWorkersScripts: (accountId: string) => `${CLOUDFLARE_API_BASE}/accounts/${accountId}/workers/scripts`,
  graphql: () => `${CLOUDFLARE_API_BASE}/graphql`
};

export interface CloudflareDnsConfig {
  apiToken: string;
  zoneId: string;
}

export interface DnsRecord {
  type: "A" | "AAAA" | "CNAME" | "TXT" | "MX";
  name: string;
  content: string;
  ttl?: number;
  proxied?: boolean;
  priority?: number;
}

export interface CloudflareResponse<T> {
  success: boolean;
  errors: { code: number; message: string }[];
  result: T;
}

export interface DnsRecordResult {
  id: string;
  name: string;
  type: string;
  content: string;
  ttl: number;
  proxied: boolean;
  priority?: number;
  created_on: string;
  modified_on: string;
}

export interface NonSensitiveCloudflareConfig {
  configured?: boolean;
  accountId?: string;
  zoneId?: string;
  baseDomain?: string;
}

export interface MxRecordDetail {
  content: string;
  priority: number;
  exists: boolean;
}

export interface MxRecordStatus {
  subdomain: string;
  allPresent: boolean;
  expectedRecords: MxRecordDetail[];
  existingRecords: DnsRecordResult[];
}

export interface CloudflareZone {
  id: string;
  name: string;
  status: string;
}
