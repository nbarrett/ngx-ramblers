import { DnsRecordResult } from "../cloudflare/cloudflare.model";

const SKIP_LABELS = new Set([
  "mail", "imap", "smtp", "pop3", "ftp", "autodiscover", "webmail", "cpanel", "webdisk"
]);

export function webFacingHostnamesFromDns(records: DnsRecordResult[], zoneName: string): string[] {
  const zone = (zoneName || "").toLowerCase();
  const names = records
    .filter(record => record.type === "A" || record.type === "AAAA" || record.type === "CNAME")
    .map(record => (record.name || "").toLowerCase())
    .filter(name => {
      if (!name || name.startsWith("*.") || name.startsWith("_")) {
        return false;
      } else {
        const relative = name === zone ? "@" : name.endsWith(`.${zone}`) ? name.slice(0, -(zone.length + 1)) : name;
        const firstLabel = relative.split(".")[0];
        return firstLabel !== "@" && !SKIP_LABELS.has(firstLabel) && !relative.includes("_domainkey");
      }
    });
  return names.filter((name, index) => names.indexOf(name) === index);
}
