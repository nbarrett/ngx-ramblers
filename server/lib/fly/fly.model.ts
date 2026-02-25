export interface FlyConfig {
  apiToken: string;
  appName: string;
}

export interface CertificateInfo {
  hostname: string;
  clientStatus: string;
  issued: { type: string; expiresAt: string }[];
}

export interface AppIpAddresses {
  ipv4: string | null;
  ipv6: string | null;
}

export interface StreamingCommandResult {
  exitCode: number;
  output: string;
}
