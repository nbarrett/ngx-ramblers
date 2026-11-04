import { AdminPath } from "../models/admin-route-paths.model";
import { StoredValue } from "../models/ui-actions";
import { kebabCase } from "es-toolkit/compat";
import { BrevoDnsRecord, BrevoDomainDnsRecords, MailSettingsTab } from "../models/mail.model";

export function brevoDkimRecords(records: BrevoDomainDnsRecords): BrevoDnsRecord[] {
  return [records?.dkimRecord, records?.dkim1Record, records?.dkim2Record]
    .filter(record => !!record?.hostName && !!record?.value);
}

export function brevoDnsRecordHostname(recordName: string, domainName: string, zoneName: string): string {
  const name = recordName.replace(/\.$/, "");
  const relativeDomain = domainName.endsWith(`.${zoneName}`) ? domainName.slice(0, -(zoneName.length + 1)) : "";
  if (name === "@") {
    return domainName;
  } else if (name === zoneName || name.endsWith(`.${zoneName}`)) {
    return name;
  } else if (relativeDomain && (name === relativeDomain || name.endsWith(`.${relativeDomain}`))) {
    return `${name}.${zoneName}`;
  } else {
    return `${name}.${domainName}`;
  }
}

export function mailDomainSettingsUrl(hostname: string): string {
  const url = new URL(AdminPath.MAIL_SETTINGS, `https://${hostname}`);
  url.searchParams.set(StoredValue.TAB, kebabCase(MailSettingsTab.DOMAINS));
  return url.toString();
}
