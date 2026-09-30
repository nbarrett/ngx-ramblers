import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { CloudflareConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { hostFromUrl } from "../../../projects/ngx-ramblers/src/app/functions/hosts";
import { mailDomainForSiteHost } from "../../../projects/ngx-ramblers/src/app/functions/rewrite-mail-domain";
import { configuredCloudflare } from "../cloudflare/cloudflare-config";
import { createDnsRecord, listDnsRecords, zoneForHostname } from "../cloudflare/cloudflare-dns";
import { DnsRecordType } from "../cloudflare/cloudflare.model";
import { ensureCloudflareTokenCanManageEmailRouting } from "../cloudflare/cloudflare-api-token";
import { enableEmailRouting, getEmailRoutingSettings } from "../cloudflare/cloudflare-email-routing";
import { configuredEnvironments } from "../environments/environments-config";
import { connectToEnvironmentMongo } from "./environment-context";

const debugLog = debug(envConfig.logNamespace("environment-setup:inbound-mail"));

const REQUIRED_MX_RECORDS = [
  {content: "route1.mx.cloudflare.net", priority: 16},
  {content: "route2.mx.cloudflare.net", priority: 99},
  {content: "route3.mx.cloudflare.net", priority: 2}
];

export interface EnableInboundMailResult {
  environmentName: string;
  domain: string;
  zoneId: string;
  routingEnabled: boolean;
  mxCreated: number;
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
    const missing = REQUIRED_MX_RECORDS.filter(mx => !existing.some(record => record.content === mx.content));
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

export async function enableInboundMailForEnvironment(environmentName: string): Promise<EnableInboundMailResult> {
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
          if (nonCloudflareMx.length > 0) {
            logs.push(`  - Left existing MX in place (${nonCloudflareMx.map(record => record.content).join(", ")}); Email Routing was not changed, so mail delivery is unchanged`);
            return {
              environmentName,
              domain,
              zoneId: zone.id,
              routingEnabled: false,
              mxCreated: 0,
              logs
            };
          } else {
            const cloudflareConfig = await ensureCloudflareTokenCanManageEmailRouting(initialConfig, zone.id, logs);
            const settings = await getEmailRoutingSettings(cloudflareConfig).catch(() => ({enabled: false}));
            if (settings.enabled) {
              logs.push("  - Email Routing already enabled on this zone");
            } else {
              await enableEmailRouting(cloudflareConfig, zone.name);
              logs.push("  ✓ Enabled Cloudflare Email Routing on this zone");
            }
            const mxCreated = await ensureCloudflareMxIfAlreadyOnCloudflare(cloudflareConfig, zone.name, logs);
            debugLog("Email Routing enabled for %s on %s", environmentName, domain);
            return {
              environmentName,
              domain,
              zoneId: zone.id,
              routingEnabled: true,
              mxCreated,
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
