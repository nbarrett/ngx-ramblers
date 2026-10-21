import { Db } from "mongodb";
import { ConfigKey } from "../../../../../projects/ngx-ramblers/src/app/models/config.model";
import { EmailRoutingActionType, SHARED_INBOX_ROUTER_WORKER_NAME, inboxRouterFallbackAddress, inboxRouterWorkerName } from "../../../../../projects/ngx-ramblers/src/app/models/cloudflare-email-routing.model";
import { InboxReaderProvider } from "../../../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { MigrationUpResult } from "../../../../../projects/ngx-ramblers/src/app/models/mongo-migration-model";
import { SystemConfig } from "../../../../../projects/ngx-ramblers/src/app/models/system.model";
import { apexHostFromUrl } from "../../../../../projects/ngx-ramblers/src/app/functions/hosts";
import { configuredCloudflare } from "../../../cloudflare/cloudflare-config";
import { zoneForHostname } from "../../../cloudflare/cloudflare-dns";
import { catchAllRule } from "../../../cloudflare/cloudflare-email-routing";
import { ensureDirectInboxCatchAll } from "../../../cloudflare/direct-inbox-catch-all";
import { ensureForwardDestinationVerified } from "../../../cloudflare/cloudflare-destination-addresses";
import { ensureInboxRouterSsl, inboxRouterSslNeedsRepair, queryZoneSslSetting } from "../../../cloudflare/cloudflare-ssl";
import { CONFIG_COLLECTION } from "./collection-names";
import createMigrationLogger from "../migrations-logger";

const debugLog = createMigrationLogger("scope-inbox-router-to-zone");

export async function migrateZoneInboxRouter(db: Db): Promise<MigrationUpResult> {
  try {
    const document = await db.collection(CONFIG_COLLECTION).findOne({key: ConfigKey.SYSTEM});
    const system: SystemConfig = document?.value;
    const host = apexHostFromUrl(system?.group?.href);
    if (system?.inbox?.provider !== InboxReaderProvider.CLOUDFLARE_INGRESS) {
      return {skipped: true, reason: "This environment does not use Direct to inbox; its mail settings are unchanged"};
    } else if (!host) {
      return {deferred: true, reason: "Direct to inbox has no configured site hostname; check Group Settings before retrying"};
    } else {
      const cloudflare = await configuredCloudflare();
      const zone = await zoneForHostname(cloudflare.apiToken, host);
      if (!zone?.id || !zone.name) {
        return {deferred: true, reason: "The site's Cloudflare zone could not be resolved; retry after checking its configuration"};
      } else if (zone.name.toLowerCase() !== host) {
        return {skipped: true, reason: `This site uses the ${zone.name} parent zone; only its apex site migrates the shared router`};
      } else {
        const config = {...cloudflare, apiToken: cloudflare.apiToken, zoneId: zone.id, baseDomain: zone.name};
        const existing = await catchAllRule(config);
        const worker = existing?.actions?.find(action => action.type === EmailRoutingActionType.WORKER)?.value?.[0];
        const legacy = worker === SHARED_INBOX_ROUTER_WORKER_NAME;
        const expectedWorker = inboxRouterWorkerName(zone.name);
        if (!existing?.enabled || (!legacy && worker !== expectedWorker)) {
          return {skipped: true, reason: "No active inbox router catch-all needs migration; forwarding, custom workers and disabled rules are unchanged"};
        } else {
          const ssl = await queryZoneSslSetting(config);
          if (!legacy && !inboxRouterSslNeedsRepair(ssl)) {
            return {skipped: true, reason: "The catch-all already uses its zone router and HTTPS to the origin"};
          } else {
            const fallback = inboxRouterFallbackAddress(existing);
            if (legacy && fallback) {
              await ensureForwardDestinationVerified(config, fallback, false);
            }
            const sslChanged = await ensureInboxRouterSsl(config, host);
            if (legacy) {
              const deployment = await ensureDirectInboxCatchAll(config, host, {fallbackAddress: fallback, registerMissingDestination: false});
              debugLog("Migrated zone %s to %s; explicit fallback=%s; SSL repaired=%s", zone.name, deployment.scriptName, !!fallback, sslChanged);
            } else {
              debugLog("Repaired SSL for existing zone router %s; routing unchanged", expectedWorker);
            }
            return {};
          }
        }
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    debugLog("Migration left pending for retry: %s", message);
    return {deferred: true, reason: message};
  }
}
