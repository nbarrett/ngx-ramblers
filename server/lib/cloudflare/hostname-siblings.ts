import { CloudflareZone } from "./cloudflare.model";

export function apexWwwSibling(hostname: string, zone: CloudflareZone): string {
  if (hostname === zone.name) {
    return `www.${zone.name}`;
  } else if (hostname === `www.${zone.name}`) {
    return zone.name;
  } else {
    return "";
  }
}
