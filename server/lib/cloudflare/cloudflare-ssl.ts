import { CloudflareDnsConfig, CloudflareResponse, CloudflareSslMode, CloudflareSslSetting, cloudflareApi } from "./cloudflare.model";
import { queryCertificates } from "../fly/fly-certificates";
import { flyRuntimeConfig } from "../fly/fly-runtime-config";
import { dateTimeFromIso, dateTimeNow } from "../shared/dates";

export async function queryZoneSslSetting(config: CloudflareDnsConfig): Promise<CloudflareSslSetting> {
  const response = await fetch(cloudflareApi.zoneSslSetting(config.zoneId), {
    headers: {Authorization: `Bearer ${config.apiToken}`}
  });
  const data: CloudflareResponse<CloudflareSslSetting> = await response.json();
  if (!data.success) {
    throw new Error(`Could not read Cloudflare SSL mode: ${data.errors.map(error => error.message).join(", ")}`);
  } else {
    return data.result;
  }
}

export function inboxRouterSslNeedsRepair(setting: CloudflareSslSetting): boolean {
  return setting.value === CloudflareSslMode.FLEXIBLE || setting.value === CloudflareSslMode.OFF;
}

export async function ensureInboxRouterSsl(config: CloudflareDnsConfig, hostname: string): Promise<boolean> {
  const setting = await queryZoneSslSetting(config);
  if (!inboxRouterSslNeedsRepair(setting)) {
    return false;
  } else if (!setting.editable) {
    throw new Error("Cloudflare SSL mode must use HTTPS to the origin, but this setting is not editable.");
  } else {
    const fly = await flyRuntimeConfig();
    const certificates = await queryCertificates(fly);
    const certificate = certificates.find(cert => cert.hostname.toLowerCase() === hostname.toLowerCase());
    const issued = certificate?.issued?.filter(cert => dateTimeFromIso(cert.expiresAt).toMillis() > dateTimeNow().toMillis()) || [];
    if (certificate?.clientStatus?.toLowerCase() !== "ready" || issued.length === 0) {
      throw new Error("A valid Fly origin certificate is required before changing Cloudflare to Full (strict). Check the hostname certificate before retrying the migration.");
    } else {
      const response = await fetch(cloudflareApi.zoneSslSetting(config.zoneId), {
        method: "PATCH",
        headers: {Authorization: `Bearer ${config.apiToken}`, "Content-Type": "application/json"},
        body: JSON.stringify({value: CloudflareSslMode.STRICT})
      });
      const data: CloudflareResponse<CloudflareSslSetting> = await response.json();
      if (!data.success || data.result?.value !== CloudflareSslMode.STRICT) {
        throw new Error(`Could not set Cloudflare Full (strict): ${(data.errors || []).map(error => error.message).join(", ")}`);
      } else {
        const verified = await queryZoneSslSetting(config);
        if (verified.value !== CloudflareSslMode.STRICT) {
          throw new Error("Cloudflare SSL mode did not remain Full (strict) after the update.");
        } else {
          return true;
        }
      }
    }
  }
}
