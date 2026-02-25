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
  created_on: string;
  modified_on: string;
}

export interface NonSensitiveCloudflareConfig {
  configured?: boolean;
  accountId?: string;
  zoneId?: string;
  baseDomain?: string;
}
