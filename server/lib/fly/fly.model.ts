export interface FlyConfig {
  apiToken: string;
  appName: string;
}

export interface FlyRuntimeConfig extends FlyConfig {
  machineId: string;
  organisation: string;
}

export interface FlyMetricSeriesDefinition {
  label: string;
  dashed?: boolean;
  scale: number;
  promQuery: (appName: string, machineId: string, rateWindowSeconds: number) => string;
}

export interface FlyMetricDefinition {
  key: string;
  unit: string;
  series: FlyMetricSeriesDefinition[];
}

export interface FlyAppDetailsResponse {
  organization?: { slug: string };
}

export interface FlyMachineSummary {
  id: string;
  state: string;
  updated_at?: string;
}

export interface FlySecureConfig {
  apiToken: string;
  appName?: string;
}

export interface FlyRestartResult {
  ok: boolean;
  error?: string;
}

export interface PrometheusResult {
  metric: Record<string, string>;
  value: [number, string];
}

export interface PrometheusResponse {
  status: string;
  data: { result: PrometheusResult[] };
}

export interface PrometheusRangeResult {
  metric: Record<string, string>;
  values: [number, string][];
}

export interface PrometheusRangeResponse {
  status: string;
  data: { result: PrometheusRangeResult[] };
}

export interface CertificateInfo {
  hostname: string;
  clientStatus: string;
  issued: { type: string; expiresAt: string }[];
  dnsValidationHostname?: string;
  dnsValidationTarget?: string;
  dnsValidationInstructions?: string;
  acmeDnsConfigured?: boolean;
  acmeAlpnConfigured?: boolean;
  configured?: boolean;
}

export interface AppIpAddresses {
  ipv4: string | null;
  ipv6: string | null;
}

export interface StreamingCommandResult {
  exitCode: number;
  output: string;
}

export enum IpAddressType {
  V4 = "v4",
  V6 = "v6",
  SharedV4 = "shared_v4",
  PrivateV6 = "private_v6",
}

export interface FlyImageQueryResponse {
  data?: {
    app?: {
      image?: { id?: string; digest?: string; ref?: string };
    };
  };
}
