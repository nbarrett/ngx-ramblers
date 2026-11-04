import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { AppIpAddresses, FlyConfig, IpAddressType } from "./fly.model";
import * as certificates from "./fly-certificates";

const debugLog = debug(envConfig.logNamespace("fly:public-ips"));

export async function ensureAppPublicIps(config: FlyConfig): Promise<AppIpAddresses> {
  const current = await certificates.appIpAddresses(config);
  const ipv6 = current.ipv6 ? current.ipv6 : (await certificates.allocateIpAddress(config, IpAddressType.V6)).address;
  const ipv4 = current.ipv4 ? current.ipv4 : (await certificates.allocateIpAddress(config, IpAddressType.SharedV4)).address;
  debugLog("Public IPs for %s: IPv4=%s IPv6=%s", config.appName, ipv4, ipv6);
  return {ipv4, ipv6};
}
