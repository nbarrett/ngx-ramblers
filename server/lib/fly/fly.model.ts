export interface FlyConfig {
  apiToken: string;
  appName: string;
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
