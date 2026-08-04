import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { configuredCloudflare } from "../../../cloudflare/cloudflare-config";
import { zoneForHostname } from "../../../cloudflare/cloudflare-dns";
import { ensureEmailAuthRecords, queryEmailAuthStatus } from "../../../cloudflare/cloudflare-email-auth-records";
import { listDomains } from "../../../brevo/domains/domain-management";
import { BrevoDomainInfo } from "../../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { apexHost } from "../../../../../projects/ngx-ramblers/src/app/functions/hosts";
import { MigrationUpResult } from "../../../../../projects/ngx-ramblers/src/app/models/mongo-migration-model";
import { withBrevoMigrationSafety } from "../shared/brevo-migration-safety";

const debugLog = createMigrationLogger("ensure-email-auth-records");

async function ensureForDomain(apiToken: string, rawDomain: string): Promise<void> {
  const domain = apexHost(rawDomain);
  if (!domain) {
    debugLog("Empty domain - skipping");
    return;
  }
  const zone = await zoneForHostname(apiToken, domain);
  if (!zone) {
    debugLog("No Cloudflare zone found for %s - skipping", domain);
    return;
  }
  const dnsConfig = { apiToken, zoneId: zone.id };
  const before = await queryEmailAuthStatus(dnsConfig, domain, zone.name);
  if (before.spf.allPresent && before.dmarc.present && before.dmarc.reportingConfigured) {
    debugLog("SPF and DMARC already satisfy requirements for %s - no action needed", domain);
    return;
  }
  if (before.spf.multiple) {
    debugLog("Multiple SPF records on %s - refusing to auto-fix (RFC 7208). Consolidate manually in Cloudflare.", domain);
    return;
  }
  debugLog(
    "Ensuring email auth records for %s (spf.allPresent=%s, dmarc.present=%s, dmarc.reportingConfigured=%s)",
    domain,
    before.spf.allPresent,
    before.dmarc.present,
    before.dmarc.reportingConfigured
  );
  const after = await ensureEmailAuthRecords(dnsConfig, domain, zone.name);
  debugLog("Email auth records ensured for %s - spf=%s, dmarc=%s", domain, after.spf.rawContent, after.dmarc.rawContent);
}

export async function up(_db: Db, _client: MongoClient): Promise<MigrationUpResult | void> {
  return withBrevoMigrationSafety("ensure-email-auth-records", async () => {
    const cloudflareConfig = await configuredCloudflare().catch(() => null);
    if (!cloudflareConfig) {
      const reason = "No Cloudflare config available for this environment";
      debugLog(reason);
      return {skipped: true, reason};
    }
    const brevoDomains: BrevoDomainInfo[] = await listDomains().catch(error => {
      debugLog("Could not list Brevo domains: %s - falling back to Cloudflare baseDomain only", error?.message || error);
      return [] as BrevoDomainInfo[];
    });
    const fromBrevo = brevoDomains.map(d => d.domainName).filter((d): d is string => !!d);
    const fromBase = cloudflareConfig.baseDomain ? [cloudflareConfig.baseDomain] : [];
    const candidates = Array.from(new Set([...fromBrevo, ...fromBase].map(apexHost).filter(Boolean)));
    if (candidates.length === 0) {
      const reason = "No candidate domains to check for email auth records";
      debugLog(reason);
      return {skipped: true, reason};
    }
    debugLog("Ensuring email auth records for %d candidate domain(s): %s", candidates.length, candidates.join(", "));
    await candidates.reduce(async (previous, domain) => {
      await previous;
      try {
        await ensureForDomain(cloudflareConfig.apiToken, domain);
      } catch (error) {
        debugLog("Non-fatal error while ensuring %s: %s", domain, error?.message || error);
      }
    }, Promise.resolve());
    return {};
  }, debugLog);
}

export async function down(_db: Db, _client: MongoClient) {
  debugLog("Down migration not implemented - SPF/DMARC records may be in use by other tooling and should not be blindly removed");
}
