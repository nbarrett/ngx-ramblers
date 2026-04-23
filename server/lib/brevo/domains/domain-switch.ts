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
import { DomainAuthenticationResult } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

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
}

function hostOf(urlOrHost: string): string {
  const trimmed = (urlOrHost || "").trim();
  if (!trimmed) return "";
  try {
    return new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`).host.toLowerCase();
  } catch {
    return trimmed.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
  }
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
      const message = error instanceof Error ? error.message : String(error);
      step(`  ✗ Failed ${sender.email} -> ${newEmail}: ${message}`);
      summary.failed.push({ email: sender.email, error: message });
    }
  }
  return summary;
}

export async function switchBrevoSendingDomain(options: { newHostname: string; oldHostname?: string; rewriteSenders?: boolean }): Promise<DomainSwitchResult> {
  const newHostname = hostOf(options.newHostname);
  const oldHostname = options.oldHostname ? hostOf(options.oldHostname) : undefined;
  if (!newHostname) {
    throw new Error("New sending domain is required");
  }

  const logs: string[] = [];
  const step = (msg: string) => { logs.push(msg); debugLog(msg); };

  step(`Switching Brevo sending domain to ${newHostname}${oldHostname ? ` (from ${oldHostname})` : ""}`);

  const { cfDnsConfig, zoneName } = await resolveCloudflareConfigFor(step, newHostname);

  step(`Authenticating ${newHostname} in Brevo (zone ${zoneName})...`);
  const domain = await authenticateSendingDomain(newHostname, {
    cloudflareDnsConfig: cfDnsConfig,
    baseDomainOverride: zoneName
  });
  step(`  ✓ Brevo domain status: authenticated=${domain.authenticated}, verified=${domain.verified}`);
  if (domain.message) step(`  ${domain.message}`);

  const brevoConfig = await configuredBrevo();
  const rewrite = options.rewriteSenders && oldHostname
    ? await rewriteSendersFromDomainTo(step, brevoConfig.apiKey, oldHostname, newHostname)
    : { oldDomain: oldHostname || "", newDomain: newHostname, rewritten: [], skipped: [], failed: [] };

  step(`Done: sending domain switched to ${newHostname}`);
  return { logs, domain, rewrite };
}
