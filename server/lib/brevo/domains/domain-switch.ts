import debug from "debug";
import { envConfig } from "../../env-config/env-config";
import { CloudflareDnsConfig } from "../../cloudflare/cloudflare.model";
import { zoneForHostname } from "../../cloudflare/cloudflare-dns";
import { configuredCloudflare } from "../../cloudflare/cloudflare-config";
import { authenticateSendingDomain } from "./domain-authentication";
import { configuredBrevo } from "../brevo-config";
import { listBrevoSenders } from "../senders/senders";
import { registerBrevoSender } from "../senders/create-sender";
import { deleteBrevoSenderById } from "../senders/delete-sender";
import { logBrevoError } from "../common/error-log";
import { DomainAuthenticationResult } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { ConfigKey } from "../../../../projects/ngx-ramblers/src/app/models/config.model";
import { CommitteeConfig } from "../../../../projects/ngx-ramblers/src/app/models/committee.model";
import { createOrUpdateKey, queryKey } from "../../mongo/controllers/config";
import {
  committeeMailRewriteCount,
  mailDomainForSiteHost,
  rewriteCommitteeMailAddresses
} from "../../../../projects/ngx-ramblers/src/app/functions/rewrite-mail-domain";
import { BrevoClient } from "@getbrevo/brevo";

const debugLog = debug(envConfig.logNamespace("brevo:domain-switch"));
debugLog.enabled = true;

export interface SenderRewriteSummary {
  oldDomain: string;
  newDomain: string;
  rewritten: { oldEmail: string; newEmail: string; newSenderId?: number }[];
  skipped: { email: string; reason: string }[];
  failed: { email: string; error: string }[];
}

export interface DomainSwitchResult {
  logs: string[];
  domain: DomainAuthenticationResult;
  rewrite: SenderRewriteSummary;
  committeeRolesRewritten: number;
}

async function resolveCloudflareConfigFor(step: (msg: string) => void, hostname: string): Promise<{ cfDnsConfig: CloudflareDnsConfig; zoneName: string }> {
  const { apiToken } = await configuredCloudflare();
  step(`Resolving Cloudflare zone for ${hostname}...`);
  const zone = await zoneForHostname(apiToken, hostname);
  if (!zone) {
    throw new Error(`No Cloudflare zone found for ${hostname}. Add the zone in Cloudflare first.`);
  }
  step(`  ✓ Zone ${zone.name} (${zone.id})`);
  return {
    cfDnsConfig: { apiToken, zoneId: zone.id },
    zoneName: zone.name
  };
}

async function rewriteSendersFromDomainTo(step: (msg: string) => void, apiKey: string, oldDomain: string, newDomain: string): Promise<SenderRewriteSummary> {
  const summary: SenderRewriteSummary = {
    oldDomain,
    newDomain,
    rewritten: [],
    skipped: [],
    failed: []
  };
  if (!oldDomain || oldDomain === newDomain) {
    step("  - Skipping sender rewrite (no old domain or same as new)");
    return summary;
  }

  step(`Rewriting senders from @${oldDomain} to @${newDomain}...`);
  const allSenders = await listBrevoSenders(apiKey);
  const oldSuffix = `@${oldDomain}`;
  const newSuffix = `@${newDomain}`;
  const candidates = allSenders.filter(sender => sender.email?.toLowerCase().endsWith(oldSuffix));

  if (candidates.length === 0) {
    step(`  - No senders using @${oldDomain}`);
    return summary;
  }

  for (const sender of candidates) {
    const localPart = sender.email.slice(0, -oldSuffix.length);
    const newEmail = `${localPart}${newSuffix}`;
    const existing = allSenders.find(item => item.email?.toLowerCase() === newEmail.toLowerCase());
    if (existing) {
      step(`  - Skipping ${sender.email} — ${newEmail} already exists`);
      summary.skipped.push({ email: sender.email, reason: `${newEmail} already exists` });
      continue;
    }
    try {
      const created = await registerBrevoSender(apiKey, sender.name, newEmail);
      const createdId = created.id !== undefined ? Number(created.id) : undefined;
      step(`  ✓ Created ${newEmail} (id ${createdId ?? "?"})`);
      await deleteBrevoSenderById(apiKey, sender.id);
      step(`  ✓ Deleted ${sender.email}`);
      summary.rewritten.push({ oldEmail: sender.email, newEmail, newSenderId: createdId });
    } catch (error) {
      logBrevoError("brevo:domain-switch", error, {email: sender.email});
      const message = error instanceof Error ? error.message : String(error);
      step(`  ✗ Failed ${sender.email} -> ${newEmail}: ${message}`);
      summary.failed.push({ email: sender.email, error: message });
    }
  }
  return summary;
}

async function rewriteCommitteeOnThisDatabase(step: (msg: string) => void, oldDomain: string, newDomain: string): Promise<number> {
  const document = await queryKey(ConfigKey.COMMITTEE);
  const before = document?.value as CommitteeConfig;
  if (!before) {
    step("  - No committee config on this site");
    return 0;
  } else {
    const after = rewriteCommitteeMailAddresses(before, oldDomain, newDomain);
    const count = committeeMailRewriteCount(before, after);
    if (count > 0) {
      await createOrUpdateKey(ConfigKey.COMMITTEE, after);
      step(`  ✓ Updated ${count} committee role mailbox(es)`);
    } else {
      step("  - Committee role mailboxes already on the new domain");
    }
    return count;
  }
}

export async function switchBrevoSendingDomain(options: {
  newHostname: string;
  oldHostname?: string;
  rewriteSenders?: boolean;
  rewriteCommittee?: boolean;
  apiKey?: string;
}): Promise<DomainSwitchResult> {
  const newHostname = mailDomainForSiteHost(options.newHostname);
  const oldHostname = options.oldHostname ? mailDomainForSiteHost(options.oldHostname) : undefined;
  if (!newHostname) {
    throw new Error("New sending domain is required");
  }

  const logs: string[] = [];
  const step = (msg: string) => { logs.push(msg); debugLog(msg); };

  step(`Switching Brevo sending domain to ${newHostname}${oldHostname ? ` (from ${oldHostname})` : ""}`);

  const { cfDnsConfig, zoneName } = await resolveCloudflareConfigFor(step, newHostname);

  step(`Authenticating ${newHostname} in Brevo (zone ${zoneName})...`);
  const brevoConfig = options.apiKey ? { apiKey: options.apiKey } : await configuredBrevo();
  const domain = await authenticateSendingDomain(newHostname, {
    cloudflareDnsConfig: cfDnsConfig,
    baseDomainOverride: zoneName,
    client: options.apiKey ? new BrevoClient({ apiKey: options.apiKey }) : undefined
  });
  step(`  ✓ Brevo domain status: authenticated=${domain.authenticated}, verified=${domain.verified}`);
  if (domain.message) step(`  ${domain.message}`);

  const rewrite = options.rewriteSenders !== false && oldHostname
    ? await rewriteSendersFromDomainTo(step, brevoConfig.apiKey, oldHostname, newHostname)
    : { oldDomain: oldHostname || "", newDomain: newHostname, rewritten: [], skipped: [], failed: [] };

  const committeeRolesRewritten = options.rewriteCommittee === false || !oldHostname
    ? 0
    : await rewriteCommitteeOnThisDatabase(step, oldHostname, newHostname);

  step(`Done: sending domain switched to ${newHostname}`);
  return { logs, domain, rewrite, committeeRolesRewritten };
}
