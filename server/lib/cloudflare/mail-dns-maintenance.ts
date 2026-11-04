import { Request, Response } from "express";
import { isArray, isString } from "es-toolkit/compat";
import { Member } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { MailDnsDelegationRemovalRequest } from "../../../projects/ngx-ramblers/src/app/models/cloudflare-email-routing.model";
import { mailDomainForSiteHost } from "../../../projects/ngx-ramblers/src/app/functions/rewrite-mail-domain";
import { buildMxRecordStatus } from "../../../projects/ngx-ramblers/src/app/functions/mx-record-status";
import { systemConfig } from "../config/system-config";
import { configuredCloudflare } from "./cloudflare-config";
import { deleteDnsRecord, listDnsRecords, zoneForHostname } from "./cloudflare-dns";
import { DnsRecordType } from "./cloudflare.model";
import { getEmailRoutingSettings } from "./cloudflare-email-routing";
import { domainConfiguration } from "../brevo/domains/domain-management";
import { brevoDkimRecords, brevoDnsRecordHostname } from "../../../projects/ngx-ramblers/src/app/functions/brevo-domain-dns";
import { HttpError } from "../shared/http-error";

export async function removeMailDnsDelegation(req: Request, res: Response): Promise<void> {
  const member = req.user as Partial<Member>;
  const request = req.body as MailDnsDelegationRemovalRequest;
  if (!member?.memberAdmin) {
    throw new HttpError(403, "Member administrator access is required for mail DNS maintenance");
  } else if (!isString(request?.hostname) || !isArray(request?.records) || request.records.length === 0
    || request.records.some(record => !isString(record?.id) || !isString(record?.name) || !isString(record?.content) || record?.type !== DnsRecordType.NS)) {
    throw new HttpError(400, "Choose the DNS delegation records to remove and confirm the action");
  } else {
    const hostname = mailDomainForSiteHost((await systemConfig())?.group?.href || "");
    if (!hostname || request.hostname !== hostname) {
      throw new HttpError(400, "DNS maintenance can only change this site's own mail subdomain");
    } else {
      const cloudflare = await configuredCloudflare();
      const zone = await zoneForHostname(cloudflare.apiToken, hostname);
      if (!zone || hostname === zone.name) {
        throw new HttpError(400, "This action cannot change a zone's authoritative nameservers");
      } else {
        const config = {apiToken: cloudflare.apiToken, zoneId: zone.id};
        const [records, mxRecords, routing] = await Promise.all([
          listDnsRecords(config, hostname, DnsRecordType.NS),
          listDnsRecords(config, hostname, DnsRecordType.MX),
          getEmailRoutingSettings({...cloudflare, zoneId: zone.id})
        ]);
        const mx = buildMxRecordStatus(hostname, mxRecords);
        const unchanged = records.length === request.records.length && records.length > 0
          && new Set(request.records.map(record => record.id)).size === request.records.length
          && request.records.every(record => records.some(current => current.id === record.id
            && current.name === hostname && record.name === hostname
            && current.type === DnsRecordType.NS && record.type === DnsRecordType.NS
            && current.content === record.content));
        if (!unchanged) {
          throw new HttpError(409, "The delegation records have changed. Re-check Domains and review the current records before confirming again.");
        } else if (!mx.allPresent || mx.extraRecords.length > 0 || !routing.enabled) {
          throw new HttpError(409, "Cloudflare Email Routing must be enabled with all required MX records and no conflicting MX records before removing delegation");
        } else {
          const sendingDomain = await domainConfiguration(hostname);
          const dkimRecords = brevoDkimRecords(sendingDomain.dnsRecords);
          const dkimPresent = await Promise.all(dkimRecords.map(async record => {
            const name = brevoDnsRecordHostname(record.hostName, hostname, zone.name);
            if ((record.type !== DnsRecordType.TXT && record.type !== DnsRecordType.CNAME) || !name.endsWith(`.${hostname}`)) {
              return false;
            } else {
              const current = await listDnsRecords(config, name, record.type);
              return current.some(existing => existing.type === record.type && existing.content.replace(/\.$/, "") === record.value.replace(/\.$/, ""));
            }
          }));
          if (dkimRecords.length === 0 || !dkimPresent.every(Boolean)) {
            throw new HttpError(409, "Brevo DKIM signing records are not configured in Cloudflare. Use Authenticate Domain on Domains to configure the individual records, then review delegation removal again. Removing NS delegation first could break outgoing mail authentication.");
          }
          const progress = {removed: 0};
          try {
            for (const record of records) {
              await deleteDnsRecord(config, record.id);
              progress.removed += 1;
            }
          } catch (error) {
            throw new HttpError(502, `Removed ${progress.removed} of ${records.length} delegation records before Cloudflare reported an error. Re-check Domains before retrying. ${(error as Error).message}`);
          }
          res.json({response: {
            removedRecords: records,
            message: "The confirmed NS delegation records were removed. DNS caches may retain the old delegation until its TTL expires. Re-check public DNS before resending your message."
          }});
        }
      }
    }
  }
}
