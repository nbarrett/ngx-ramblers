import { CloudflareConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import {
  CloudflareWorkerInventory,
  EmailRoutingActionType,
  EmailRoutingRule,
  emailRoutingRuleAddress,
  WorkerEmailReference,
  WorkerEmailUsageStatus,
  WorkerZoneCheck
} from "../../../projects/ngx-ramblers/src/app/models/cloudflare-email-routing.model";
import { CloudflareZone } from "./cloudflare.model";
import { listZones } from "./cloudflare-dns";
import { catchAllRule, listEmailRoutingRules } from "./cloudflare-email-routing";
import { listWorkerScripts } from "./cloudflare-email-workers";
import { PUBLIC_SITE_FETCH_WORKER_NAME } from "./public-site-fetch-worker";

function referencesForRules(zone: string, rules: EmailRoutingRule[]): WorkerEmailReference[] {
  return rules.flatMap(rule => (rule.actions || [])
    .filter(action => action.type === EmailRoutingActionType.WORKER)
    .flatMap(action => (action.value || []).map(scriptName => ({
      scriptName,
      zone,
      rule: emailRoutingRuleAddress(rule) || rule.name || "Catch-all",
      enabled: rule.enabled === true
    }))));
}

async function checkZone(config: CloudflareConfig, zone: CloudflareZone): Promise<WorkerZoneCheck> {
  const zoneConfig = {...config, zoneId: zone.id, baseDomain: zone.name};
  const checks = await Promise.allSettled([listEmailRoutingRules(zoneConfig), catchAllRule(zoneConfig)]);
  const rules = checks.flatMap(check => check.status === "fulfilled" ? [check.value].flat().filter(Boolean) : []);
  const errors = checks.flatMap((check, index) => check.status === "rejected"
    ? [`${index === 0 ? "Address rules" : "Catch-all"}: ${check.reason instanceof Error ? check.reason.message : "Cloudflare request failed"}`]
    : []);
  return {zone: zone.name, references: referencesForRules(zone.name, rules), errors};
}

export async function cloudflareWorkerInventory(config: CloudflareConfig): Promise<CloudflareWorkerInventory> {
  const [scripts, zones] = await Promise.all([
    listWorkerScripts(config),
    listZones(config.apiToken, null, config.accountId)
  ]);
  const checks = await zones.reduce(async (previous, zone) => [...await previous, await checkZone(config, zone)], Promise.resolve([] as WorkerZoneCheck[]));
  const references = checks.flatMap(check => check.references);
  const complete = checks.length > 0 && checks.every(check => !check.errors.length);
  return {
    accountId: config.accountId,
    zones: checks,
    workers: scripts.map(script => {
      const matching = references.filter(reference => reference.scriptName === script.id);
      const reserved = script.id === PUBLIC_SITE_FETCH_WORKER_NAME;
      return {
        id: script.id,
        mapped: [...new Set(matching.map(reference => `${reference.zone}: ${reference.rule}${reference.enabled ? "" : " (disabled)"}`))].join("; ") || (reserved ? "Site migration fetch worker" : "No references found"),
        status: matching.length ? WorkerEmailUsageStatus.REFERENCED : reserved ? WorkerEmailUsageStatus.RESERVED : complete ? WorkerEmailUsageStatus.UNREFERENCED : WorkerEmailUsageStatus.INCOMPLETE
      };
    })
  };
}
