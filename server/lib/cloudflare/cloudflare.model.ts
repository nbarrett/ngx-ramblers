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
