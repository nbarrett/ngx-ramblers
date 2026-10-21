import { EmailRoutingActionType, EmailRoutingMatcherType, InboxRouterDeployment, emailRoutingRuleIdentifier, SHARED_INBOX_ROUTER_WORKER_NAME, inboxRouterFallbackAddress, inboxRouterWorkerName, sharedInboxRouterRuleActive } from "../../../projects/ngx-ramblers/src/app/models/cloudflare-email-routing.model";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import { CloudflareConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { apexHost } from "../../../projects/ngx-ramblers/src/app/functions/hosts";
import { envConfig } from "../env-config/env-config";
import { configuredEnvironments } from "../environments/environments-config";
import { HttpError } from "../shared/http-error";
import { catchAllRule, listEmailRoutingRules, updateCatchAllRule, updateEmailRoutingRule } from "./cloudflare-email-routing";
import { generateRouterWorkerScript, uploadWorkerScript, uploadWorkerSecret, workerSecretNames } from "./cloudflare-email-workers";
import { zoneForHostname } from "./cloudflare-dns";
import { InboxRouterDeploymentOptions } from "./cloudflare.model";
import { ensureForwardDestinationVerified } from "./cloudflare-destination-addresses";

async function inboundRouterSecret(): Promise<string | null> {
  const environmentSecret = envConfig.value(Environment.NGX_INBOUND_SECRET)?.trim();
  if (environmentSecret) {
    return environmentSecret;
  } else {
    const environmentsConfig = await configuredEnvironments();
    return environmentsConfig.secrets?.[Environment.NGX_INBOUND_SECRET]?.trim() || null;
  }
}

async function inboxRouterZoneConfig(cloudflareConfig: CloudflareConfig, siteDomain: string): Promise<CloudflareConfig> {
  const host = apexHost(siteDomain.trim().toLowerCase());
  if (!host) {
    throw new HttpError(400, "Cannot resolve the inbox router without this site's domain.", "RouterDomainMissing");
  } else {
    const zone = await zoneForHostname(cloudflareConfig.apiToken, host);
    if (!zone?.id || !zone.name || zone.id !== cloudflareConfig.zoneId) {
      throw new HttpError(400, "The site's Cloudflare zone could not be verified. Check the domain and zone configuration before changing email routing.", "RouterZoneMismatch");
    } else {
      return {...cloudflareConfig, zoneId: zone.id, baseDomain: zone.name.trim().toLowerCase()};
    }
  }
}

export async function assertCatchAllOwnedByThisSite(cloudflareConfig: CloudflareConfig, siteDomain: string): Promise<CloudflareConfig> {
  const zoneConfig = await inboxRouterZoneConfig(cloudflareConfig, siteDomain);
  const host = apexHost(siteDomain.trim().toLowerCase());
  if (host !== zoneConfig.baseDomain) {
    throw new HttpError(403,
      `The catch-all belongs to the ${zoneConfig.baseDomain} Cloudflare zone, which is shared by every site on that domain. This site (${host}) cannot change it. Manage the catch-all from the ${zoneConfig.baseDomain} site instead.`,
      "SubdomainCatchAllForbidden");
  } else {
    return zoneConfig;
  }
}

export async function ensureRouterWorker(cloudflareConfig: CloudflareConfig, siteDomain: string, fallbackAddress: string, options: InboxRouterDeploymentOptions = {}): Promise<string> {
  const zoneConfig = await assertCatchAllOwnedByThisSite(cloudflareConfig, siteDomain);
  const fallback = fallbackAddress.trim();
  const secret = await inboundRouterSecret();
  if (!secret) {
    throw new HttpError(400, `No shared inbound router secret is configured (${Environment.NGX_INBOUND_SECRET}). Set it in the platform admin shared secrets and redeploy this site.`, "RouterSecretMissing");
  } else {
    const scriptName = inboxRouterWorkerName(zoneConfig.baseDomain);
    if (fallback) {
      await ensureForwardDestinationVerified(zoneConfig, fallback, options.registerMissingDestination !== false);
    } else {
      const secretNames = await workerSecretNames(zoneConfig, scriptName);
      if (secretNames.includes("NGX_FALLBACK_FORWARD")) {
        throw new HttpError(400, "This zone worker already has a fallback secret, but no fallback address is recorded on its catch-all. Save its intended fallback in Committee Settings before retrying; the existing secret has been preserved.", "RouterFallbackUnknown");
      }
    }
    await uploadWorkerScript(zoneConfig, scriptName, generateRouterWorkerScript());
    await uploadWorkerSecret(zoneConfig, scriptName, Environment.NGX_INBOUND_SECRET, secret);
    if (fallback) {
      await uploadWorkerSecret(zoneConfig, scriptName, "NGX_FALLBACK_FORWARD", fallback);
    }
    const addressRules = await listEmailRoutingRules(zoneConfig);
    const legacyRules = addressRules.filter(rule => rule.matchers?.some(matcher => matcher.type === EmailRoutingMatcherType.LITERAL) && !rule.matchers?.some(matcher => matcher.type === EmailRoutingMatcherType.ALL) && rule.actions?.some(action => action.type === EmailRoutingActionType.WORKER && action.value?.includes(SHARED_INBOX_ROUTER_WORKER_NAME)));
    for (const rule of legacyRules) {
      const identifier = emailRoutingRuleIdentifier(rule);
      if (!identifier) {
        throw new HttpError(400, "A legacy inbox address rule has no identifier. Refresh the email routing rules before retrying.");
      } else {
        await updateEmailRoutingRule(zoneConfig, identifier, {
          ...rule,
          actions: rule.actions.map(action => action.type === EmailRoutingActionType.WORKER
            ? {...action, value: action.value.map(value => value === SHARED_INBOX_ROUTER_WORKER_NAME ? scriptName : value)}
            : action)
        });
      }
    }
    return scriptName;
  }
}

export async function ensureDirectInboxCatchAll(cloudflareConfig: CloudflareConfig, siteDomain: string, options: InboxRouterDeploymentOptions = {}): Promise<InboxRouterDeployment> {
  const zoneConfig = await inboxRouterZoneConfig(cloudflareConfig, siteDomain);
  const host = apexHost(siteDomain.trim().toLowerCase());
  const scriptName = inboxRouterWorkerName(zoneConfig.baseDomain);
  const existing = await catchAllRule(zoneConfig);
  const workerName = existing?.actions?.find(action => action.type === EmailRoutingActionType.WORKER)?.value?.[0];
  if (host !== zoneConfig.baseDomain) {
    if (sharedInboxRouterRuleActive(existing) && (workerName === scriptName || workerName === SHARED_INBOX_ROUTER_WORKER_NAME)) {
      return {scriptName: workerName, changed: false, detail: `Uses the existing ${zoneConfig.baseDomain} zone inbox router; the shared catch-all was not changed`};
    } else {
      throw new HttpError(403, `Configure the inbox router catch-all from the ${zoneConfig.baseDomain} site before enabling Direct to inbox here.`, "SubdomainCatchAllForbidden");
    }
  } else {
    const fallback = options.fallbackAddress?.trim() || inboxRouterFallbackAddress(existing);
    await ensureRouterWorker(zoneConfig, host, fallback, options);
    if (workerName === scriptName && existing.enabled) {
      return {scriptName, changed: false, detail: "Catch-all already delivers to this site's inbox"};
    } else {
      await updateCatchAllRule(zoneConfig, {
        name: fallback ? `Catch-all - Shared inbox router (fallback ${fallback})` : "Catch-all - Shared inbox router",
        enabled: true,
        matchers: [{type: EmailRoutingMatcherType.ALL}],
        actions: [{type: EmailRoutingActionType.WORKER, value: [scriptName]}]
      });
      return {scriptName, changed: true, detail: "Catch-all now delivers to this site's inbox"};
    }
  }
}
