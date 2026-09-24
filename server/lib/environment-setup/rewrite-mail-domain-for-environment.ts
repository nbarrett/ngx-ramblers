import { MongoClient } from "mongodb";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { CommitteeConfig } from "../../../projects/ngx-ramblers/src/app/models/committee.model";
import { MailConfig } from "../../../projects/ngx-ramblers/src/app/models/mail.model";
import { SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { CustomDomainStatus } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import {
  committeeMailboxDomains,
  committeeMailRewriteCount,
  mailDomainForSiteHost,
  ngxRamblersMailDomain,
  rewriteCommitteeMailAddresses
} from "../../../projects/ngx-ramblers/src/app/functions/rewrite-mail-domain";
import { configuredEnvironments } from "../environments/environments-config";
import { buildMongoUri } from "../shared/mongodb-uri";
import { switchBrevoSendingDomain } from "../brevo/domains/domain-switch";
import { apexHost } from "../../../projects/ngx-ramblers/src/app/functions/hosts";

export interface MoveMailToCustomDomainResult {
  environmentName: string;
  oldDomain: string;
  newDomain: string;
  committeeRolesRewritten: number;
  logs: string[];
}

export async function moveMailToCustomDomainForEnvironment(environmentName: string): Promise<MoveMailToCustomDomainResult> {
  const logs: string[] = [];
  const step = (msg: string) => { logs.push(msg); };
  const environmentsConfig = await configuredEnvironments();
  const env = (environmentsConfig.environments || []).find(item => item.environment === environmentName);
  if (!env) {
    throw new Error(`Environment '${environmentName}' not found`);
  }
  const mongo = env.mongo;
  if (!mongo?.cluster || !mongo?.db || !mongo?.username || !mongo?.password) {
    throw new Error(`Environment '${environmentName}' has no complete Mongo config`);
  }
  const uri = buildMongoUri({
    cluster: mongo.cluster,
    database: mongo.db,
    username: mongo.username,
    password: mongo.password
  });
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const system = (await db.collection("config").findOne({key: ConfigKey.SYSTEM}))?.value as SystemConfig;
  const attached = (env.customDomains || []).filter(domain =>
    domain.status === CustomDomainStatus.ATTACHED || domain.status === CustomDomainStatus.PENDING);
  const preferredCustom = attached.find(domain => domain.hostname === apexHost(domain.hostname)) || attached[0];
  const fromSiteUrl = mailDomainForSiteHost(system?.group?.href || "");
  const fromCustom = preferredCustom ? mailDomainForSiteHost(preferredCustom.hostname) : "";
  const newDomain = fromSiteUrl || fromCustom;
  const oldDomain = ngxRamblersMailDomain(environmentName);
  if (!newDomain || newDomain === oldDomain || newDomain.endsWith(".ngx-ramblers.org.uk")) {
    await client.close();
    throw new Error(`Environment '${environmentName}' has no group website domain to move mail onto. Set Group Web URL first.`);
  }
  step(`Moving mail for ${environmentName} from @${oldDomain} to @${newDomain}`);
  const committeeDoc = await db.collection("config").findOne({key: ConfigKey.COMMITTEE});
  const before = committeeDoc?.value as CommitteeConfig;
  const sourceDomains = before
    ? committeeMailboxDomains(before).filter(domain => domain !== newDomain)
    : [];
  const domainsToRewrite = sourceDomains.includes(oldDomain) ? sourceDomains : [oldDomain, ...sourceDomains];
  const after = domainsToRewrite.reduce(
    (committee, domain) => committee ? rewriteCommitteeMailAddresses(committee, domain, newDomain) : committee,
    before
  );
  const committeeRolesRewritten = before && after ? committeeMailRewriteCount(before, after) : 0;
  if (committeeRolesRewritten > 0) {
    await db.collection("config").updateOne({key: ConfigKey.COMMITTEE}, {$set: {value: after}});
    step(`  ✓ Updated ${committeeRolesRewritten} committee role mailbox(es)`);
  } else {
    step("  - Committee role mailboxes already on the new domain or not present");
  }
  const mail = (await db.collection("config").findOne({key: ConfigKey.BREVO}))?.value as MailConfig;
  await client.close();

  if (mail?.apiKey) {
    const switchResult = await switchBrevoSendingDomain({
      newHostname: newDomain,
      oldHostname: oldDomain,
      rewriteSenders: true,
      rewriteCommittee: false,
      apiKey: mail.apiKey
    });
    logs.push(...switchResult.logs);
  } else {
    step("  - No Brevo API key on this environment, senders were not rewritten");
  }

  step(`Done: mail domain ${oldDomain} -> ${newDomain}`);
  return { environmentName, oldDomain, newDomain, committeeRolesRewritten, logs };
}


