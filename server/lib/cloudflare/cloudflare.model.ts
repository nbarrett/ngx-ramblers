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
  accountRumSites: (accountId: string) => `${CLOUDFLARE_API_BASE}/accounts/${accountId}/rum/site_info`,
  zoneRulesetPhaseEntrypoint: (zoneId: string, phase: string) => `${CLOUDFLARE_API_BASE}/zones/${zoneId}/rulesets/phases/${phase}/entrypoint`,
  graphql: () => `${CLOUDFLARE_API_BASE}/graphql`
};

export interface CloudflareDnsConfig {
  apiToken: string;
  zoneId: string;
}

export enum DnsRecordType {
  A = "A",
  AAAA = "AAAA",
  CNAME = "CNAME",
  TXT = "TXT",
  MX = "MX",
}

export interface DnsRecord {
  type: DnsRecordType;
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
  ownsZone?: boolean;
  zoneName?: string;
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
  extraRecords: DnsRecordResult[];
}

export interface CloudflareZone {
  id: string;
  name: string;
  status: string;
}

export interface RedirectRuleTargetUrl {
  expression?: string;
  value?: string;
}

export interface RedirectRuleFromValue {
  status_code: number;
  target_url: RedirectRuleTargetUrl;
  preserve_query_string?: boolean;
}

export interface DynamicRedirectRule {
  id?: string;
  action: string;
  action_parameters: { from_value: RedirectRuleFromValue };
  expression: string;
  description?: string;
  enabled?: boolean;
}

export interface RulesetResult {
  id: string;
  name?: string;
  phase?: string;
  rules?: DynamicRedirectRule[];
}

export enum RecipientDeliveryStatus {
  Delivered = "delivered",
  Failed = "failed",
}
