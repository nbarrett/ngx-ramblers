import { CloudflareZone } from "./cloudflare.model";
import { SiteUrlPreference } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";

export function apexWwwSibling(hostname: string, zone: CloudflareZone): string {
  if (hostname === zone.name) {
    return `www.${zone.name}`;
  } else if (hostname === `www.${zone.name}`) {
    return zone.name;
  } else {
    return "";
  }
}

export function hostnameIsApexOrWww(hostname: string, zone: CloudflareZone): boolean {
  return !!apexWwwSibling(hostname, zone);
}

export function siteUrlPreferenceFromHostname(hostname: string, zone: CloudflareZone): SiteUrlPreference | null {
  if (hostname === zone.name) {
    return SiteUrlPreference.APEX;
  } else if (hostname === `www.${zone.name}`) {
    return SiteUrlPreference.WWW;
  } else {
    return null;
  }
}

export function publicHostnameForSiteUrlPreference(zoneName: string, preference: SiteUrlPreference): string {
  if (preference === SiteUrlPreference.WWW) {
    return `www.${zoneName}`;
  } else {
    return zoneName;
  }
}
