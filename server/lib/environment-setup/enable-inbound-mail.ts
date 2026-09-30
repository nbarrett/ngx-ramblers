import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { CloudflareConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { hostFromUrl } from "../../../projects/ngx-ramblers/src/app/functions/hosts";
import { mailDomainForSiteHost } from "../../../projects/ngx-ramblers/src/app/functions/rewrite-mail-domain";
import { configuredCloudflare } from "../cloudflare/cloudflare-config";
import { createDnsRecord, deleteDnsRecord, listDnsRecords, zoneForHostname } from "../cloudflare/cloudflare-dns";
import { DnsRecordType } from "../cloudflare/cloudflare.model";
import { ensureCloudflareTokenCanManageEmailRouting } from "../cloudflare/cloudflare-api-token";
import { catchAllRule, enableEmailRouting, getEmailRoutingSettings, updateCatchAllRule } from "../cloudflare/cloudflare-email-routing";
import { createDestinationAddress, listDestinationAddresses } from "../cloudflare/cloudflare-destination-addresses";
import { configuredEnvironments } from "../environments/environments-config";
import { connectToEnvironmentMongo } from "./environment-context";
import { CLOUDFLARE_INBOUND_MX } from "../../../projects/ngx-ramblers/src/app/functions/mx-record-status";
import { EmailRoutingActionType, EmailRoutingMatcherType } from "../../../projects/ngx-ramblers/src/app/models/cloudflare-email-routing.model";
import { InboxMailboxConnection } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";

const debugLog = debug(envConfig.logNamespace("environment-setup:inbound-mail"));

export interface EnableInboundMailOptions {
  replaceForeignMx: boolean;
}

export interface EnableInboundMailResult {
  environmentName: string;
  domain: string;
  zoneId: string;
  routingEnabled: boolean;
  mxCreated: number;
  mxRemoved: number;
  logs: string[];
}

function isCloudflareMx(content: string | undefined): boolean {
  return (content || "").includes("mx.cloudflare.net");
}

async function ensureCloudflareMxIfAlreadyOnCloudflare(
  cloudflareConfig: CloudflareConfig,
  zoneName: string,
  logs: string[]
): Promise<number> {
  const existing = await listDnsRecords({apiToken: cloudflareConfig.apiToken, zoneId: cloudflareConfig.zoneId}, zoneName, DnsRecordType.MX);
  const nonCloudflare = existing.filter(record => !isCloudflareMx(record.content));
  if (nonCloudflare.length > 0) {
    logs.push(`  - Left existing MX in place (${nonCloudflare.map(record => record.content).join(", ")}); Email Routing is on, mail delivery is unchanged`);
    return 0;
  } else {
    const missing = CLOUDFLARE_INBOUND_MX.filter(mx => !existing.some(record => record.content === mx.content));
    await Promise.all(missing.map(async mx => {
      await createDnsRecord({apiToken: cloudflareConfig.apiToken, zoneId: cloudflareConfig.zoneId}, {
        type: DnsRecordType.MX,
        name: zoneName,
        content: mx.content,
        priority: mx.priority
      });
      logs.push(`  ✓ Added MX ${mx.content}`);
    }));
    if (missing.length === 0) {
      logs.push("  - Cloudflare MX records already present");
    }
    return missing.length;
  }
}

async function replaceForeignMxWithCloudflare(
  cloudflareConfig: CloudflareConfig,
  zoneName: string,
  logs: string[]
): Promise<{mxCreated: number; mxRemoved: number}> {
  const existing = await listDnsRecords({apiToken: cloudflareConfig.apiToken, zoneId: cloudflareConfig.zoneId}, zoneName, DnsRecordType.MX);
  const foreign = existing.filter(record => !isCloudflareMx(record.content));
  await Promise.all(foreign.map(async record => {
    await deleteDnsRecord({apiToken: cloudflareConfig.apiToken, zoneId: cloudflareConfig.zoneId}, record.id);
    logs.push(`  ✓ Removed MX ${record.content}`);
  }));
  const remaining = await listDnsRecords({apiToken: cloudflareConfig.apiToken, zoneId: cloudflareConfig.zoneId}, zoneName, DnsRecordType.MX);
  const missing = CLOUDFLARE_INBOUND_MX.filter(mx => !remaining.some(record => record.content === mx.content));
  await Promise.all(missing.map(async mx => {
    await createDnsRecord({apiToken: cloudflareConfig.apiToken, zoneId: cloudflareConfig.zoneId}, {
      type: DnsRecordType.MX,
      name: zoneName,
      content: mx.content,
      priority: mx.priority
    });
    logs.push(`  ✓ Added MX ${mx.content}`);
  }));
  if (foreign.length === 0 && missing.length === 0) {
    logs.push("  - Cloudflare MX records already present");
  }
  return {mxCreated: missing.length, mxRemoved: foreign.length};
}

async function gmailMailboxEmail(db: {collection: (name: string) => {findOne: (query: object) => Promise<InboxMailboxConnection | null>}}): Promise<string | null> {
  const connection = await db.collection("inboxMailboxConnections").findOne({
    enabled: true,
    gmailAccountEmail: {$ne: null}
  });
  const email = (connection?.gmailAccountEmail || "").trim();
  return email || null;
}

async function ensureCatchAllForwardsToGmail(cloudflareConfig: CloudflareConfig, gmail: string, logs: string[]): Promise<void> {
  const existing = await catchAllRule(cloudflareConfig).catch(() => null);
  const workerAction = existing?.actions?.find(action => action.type === EmailRoutingActionType.WORKER);
  if (workerAction) {
    logs.push(`  - Left Direct to inbox catch-all worker (${workerAction.value?.[0] || "worker"}) in place`);
  } else {
    const destinations = await listDestinationAddresses(cloudflareConfig);
    const alreadyListed = destinations.some(item => (item.email || "").toLowerCase() === gmail.toLowerCase());
    if (!alreadyListed) {
      await createDestinationAddress(cloudflareConfig, gmail).catch((error: Error) => {
        logs.push(`  - Destination ${gmail}: ${error.message}`);
      });
    }
    await updateCatchAllRule(cloudflareConfig, {
      name: `Catch-all - ${gmail}`,
      enabled: true,
      matchers: [{type: EmailRoutingMatcherType.ALL}],
      actions: [{type: EmailRoutingActionType.FORWARD, value: [gmail]}]
    });
    logs.push(`  ✓ Catch-all forwards to ${gmail}`);
  }
}

export async function enableInboundMailForEnvironment(
  environmentName: string,
  options: EnableInboundMailOptions = {replaceForeignMx: false}
): Promise<EnableInboundMailResult> {
  const logs: string[] = [];
  const environmentsConfig = await configuredEnvironments();
  const env = (environmentsConfig.environments || []).find(item => item.environment === environmentName);
  if (!env) {
    throw new Error(`Environment '${environmentName}' not found`);
  } else if (!env.mongo?.cluster) {
    throw new Error(`Environment '${environmentName}' has no Mongo config`);
  } else {
    const platformCloudflare = await configuredCloudflare();
    const {client, db} = await connectToEnvironmentMongo(env);
    try {
      const system = (await db.collection("config").findOne({key: ConfigKey.SYSTEM}))?.value as SystemConfig;
      const domain = mailDomainForSiteHost(system?.group?.href || "") || hostFromUrl(system?.group?.href || "");
      if (!domain || domain.endsWith(".ngx-ramblers.org.uk")) {
        throw new Error(`Environment '${environmentName}' has no group domain to receive mail on. Set Group Web URL first.`);
      } else {
        const zone = await zoneForHostname(platformCloudflare.apiToken, domain);
        if (!zone) {
          throw new Error(`No Cloudflare zone covers ${domain}, so inbound mail cannot be enabled.`);
        } else {
          const initialConfig: CloudflareConfig = {
            ...platformCloudflare,
            apiToken: env.cloudflare?.apiToken || platformCloudflare.apiToken,
            accountId: env.cloudflare?.accountId || platformCloudflare.accountId,
            zoneId: zone.id,
            baseDomain: zone.name
          };
          logs.push(`Enabling Cloudflare Email Routing for ${environmentName} on ${domain} (zone ${zone.name})`);
          const existingMx = await listDnsRecords({apiToken: initialConfig.apiToken, zoneId: zone.id}, zone.name, DnsRecordType.MX);
          const nonCloudflareMx = existingMx.filter(record => !isCloudflareMx(record.content));
          if (nonCloudflareMx.length > 0 && !options.replaceForeignMx) {
            logs.push(`  - Left existing MX in place (${nonCloudflareMx.map(record => record.content).join(", ")}); Email Routing was not changed, so mail delivery is unchanged`);
            return {
              environmentName,
              domain,
              zoneId: zone.id,
              routingEnabled: false,
              mxCreated: 0,
              mxRemoved: 0,
              logs
            };
          } else {
            const cloudflareConfig = await ensureCloudflareTokenCanManageEmailRouting(initialConfig, zone.id, logs);
            const mxResult = options.replaceForeignMx
              ? await replaceForeignMxWithCloudflare(cloudflareConfig, zone.name, logs)
              : {mxCreated: await ensureCloudflareMxIfAlreadyOnCloudflare(cloudflareConfig, zone.name, logs), mxRemoved: 0};
            const settings = await getEmailRoutingSettings(cloudflareConfig).catch(() => ({enabled: false}));
            if (settings.enabled) {
              logs.push("  - Email Routing already enabled on this zone");
            } else {
              await enableEmailRouting(cloudflareConfig, zone.name);
              logs.push("  ✓ Enabled Cloudflare Email Routing on this zone");
            }
            const gmail = options.replaceForeignMx ? await gmailMailboxEmail(db) : null;
            if (gmail) {
              await ensureCatchAllForwardsToGmail(cloudflareConfig, gmail, logs);
            }
            debugLog("Email Routing enabled for %s on %s", environmentName, domain);
            return {
              environmentName,
              domain,
              zoneId: zone.id,
              routingEnabled: true,
              mxCreated: mxResult.mxCreated,
              mxRemoved: mxResult.mxRemoved,
              logs
            };
          }
        }
      }
    } finally {
      await client.close();
    }
  }
}
