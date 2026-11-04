import { MailDnsDelegation, MailDnsHealth, MailDnsLookupStatus, MxExistingRecord, MxRecordStatus } from "../../../projects/ngx-ramblers/src/app/models/cloudflare-email-routing.model";
import { buildMxRecordStatus } from "../../../projects/ngx-ramblers/src/app/functions/mx-record-status";
import { CloudflareDnsConfig, CloudflareZone, DnsRecordType } from "./cloudflare.model";
import { candidateZoneNames, listDnsRecords } from "./cloudflare-dns";
import { publicMailExchanges } from "../shared/dns-nameservers";
import { dateTimeNowAsValue } from "../shared/dates";

export async function mailDnsDelegations(config: CloudflareDnsConfig, hostname: string, zoneName: string): Promise<MailDnsDelegation[]> {
  const delegatedHosts = candidateZoneNames(hostname).filter(candidate => candidate !== zoneName && candidate.endsWith(`.${zoneName}`));
  const results = await Promise.all(delegatedHosts.map(async candidate => ({
    hostname: candidate,
    records: await listDnsRecords(config, candidate, DnsRecordType.NS)
  })));
  return results.filter(delegation => delegation.records.length > 0);
}

export async function mailDnsHealth(config: CloudflareDnsConfig, hostname: string, zoneName: string, expectedExchanges: string[]): Promise<MailDnsHealth> {
  const [delegations, lookups] = await Promise.all([
    mailDnsDelegations(config, hostname, zoneName),
    publicMailExchanges(hostname, expectedExchanges)
  ]);
  const failed = lookups.filter(lookup => lookup.status !== MailDnsLookupStatus.MATCHED);
  const healthy = delegations.length === 0 && failed.length === 0;
  const message = delegations.length > 0
    ? `DNS for ${delegations.map(delegation => delegation.hostname).join(", ")} is delegated to other nameservers. Senders can follow that delegation instead of the MX records stored in this Cloudflare zone. Review the NS records and the intended DNS host before making changes; adding MX records or redeploying the inbox router does not fix delegation.`
    : failed.length > 0
      ? `Public DNS for ${hostname} does not consistently return the MX records configured in Cloudflare. Senders may be unable to deliver mail. Review the lookup results and DNS hosting; a successful earlier message does not prove DNS is healthy.`
      : `Both public DNS resolvers return the MX records configured for ${hostname}. This checks DNS only; it does not prove a message reached the inbox.`;
  return {healthy, checkedAt: dateTimeNowAsValue(), message, delegations, lookups};
}

export async function checkedMxRecordStatus(config: CloudflareDnsConfig, hostname: string, zone: CloudflareZone, records: MxExistingRecord[]): Promise<MxRecordStatus> {
  const status = buildMxRecordStatus(hostname, records);
  const dnsHealth = await mailDnsHealth(config, hostname, zone.name, records.map(record => record.content));
  return {...status, dnsHealth};
}
