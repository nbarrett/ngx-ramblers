import { Command } from "commander";
import debug from "debug";
import { log, error as logError } from "../cli-logger";
import { envConfig } from "../../env-config/env-config";
import { CloudflareDnsConfig, CloudflareZone, DnsRecordResult, DnsRecordType } from "../../cloudflare/cloudflare.model";
import {
  createDnsRecord,
  listDnsRecords,
  deleteDnsRecord,
  updateDnsRecord,
  verifyToken,
  zoneForHostname
} from "../../cloudflare/cloudflare-dns";
import { ensureHostRedirectRule, removeHostRedirectRule } from "../../cloudflare/cloudflare-redirect-rules";
import { AppIpAddresses, CertificateInfo, FlyConfig, IpAddressType } from "../../fly/fly.model";
import { appIpAddresses, allocateIpAddress, addCertificate, deleteCertificate, queryCertificates } from "../../fly/fly-certificates";
import { findEnvironmentFromDatabase, environmentsConfigFromDatabase } from "../../environments/environments-config";
import { connectToDatabase } from "../../environment-setup/database-initialiser";
import { buildMongoUri } from "../../shared/mongodb-uri";
import * as configController from "../../mongo/controllers/config";
import { ConfigKey } from "../../../../projects/ngx-ramblers/src/app/models/config.model";
import {
  CustomDomainEntry,
  CustomDomainStatus,
  EnvironmentsConfig
} from "../../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { ApexRedirectOperationResult, ApexRedirectRemovalResult, CustomDomainOperationResult, SubdomainRemovalResult } from "../cli.model";
import { apexWwwSibling } from "../../cloudflare/hostname-siblings";
import { dateTimeNowAsValue } from "../../shared/dates";

const debugLog = debug(envConfig.logNamespace("cli:subdomain"));

export async function setupSubdomainForEnvironment(environmentName: string): Promise<void> {
  log(`Setting up subdomain for environment: ${environmentName}`);

  const envConfig = await findEnvironmentFromDatabase(environmentName);
  if (!envConfig) {
    throw new Error(`Environment '${environmentName}' not found in database`);
  }

  const environmentsConfig = await environmentsConfigFromDatabase();
  if (!environmentsConfig?.cloudflare?.apiToken) {
    throw new Error("Cloudflare API token not configured. Add cloudflare.apiToken to environments config.");
  }
  if (!environmentsConfig?.cloudflare?.zoneId) {
    throw new Error("Cloudflare Zone ID not configured. Add cloudflare.zoneId to environments config.");
  }
  if (!environmentsConfig?.cloudflare?.baseDomain) {
    throw new Error("Cloudflare baseDomain not configured. Add cloudflare.baseDomain to environments config.");
  }

  const flyApiToken = envConfig.apiKey;
  if (!flyApiToken) {
    throw new Error(`No Fly.io API token found for environment '${environmentName}'`);
  }

  const appName = envConfig.appName || `ngx-ramblers-${environmentName}`;
  const subdomain = environmentName;
  const baseDomain = environmentsConfig.cloudflare.baseDomain;
  const fullHostname = `${subdomain}.${baseDomain}`;

  log(`\nSubdomain: ${fullHostname}`);
  log(`Fly app: ${appName}`);

  log("\n1. Verifying Cloudflare token...");
  const tokenValid = await verifyToken(environmentsConfig.cloudflare.apiToken);
  if (!tokenValid) {
    throw new Error("Cloudflare token is invalid");
  }
  log("   ✓ Token valid");

  log("\n2. Getting Fly.io IP addresses...");
  const flyConfig: FlyConfig = { apiToken: flyApiToken, appName };
  const ips = await appIpAddresses(flyConfig);
  if (!ips.ipv4 && !ips.ipv6) {
    throw new Error(`No IP addresses allocated for app ${appName}. Ensure the app is deployed first.`);
  }
  if (!ips.ipv4) {
    log("   ⚠ No IPv4 address found — allocating shared IPv4...");
    const allocated = await allocateIpAddress(flyConfig, IpAddressType.SharedV4);
    ips.ipv4 = allocated.address;
    log(`   ✓ Allocated shared IPv4: ${ips.ipv4}`);
  } else {
    log(`   ✓ IPv4: ${ips.ipv4}`);
  }
  if (ips.ipv6) log(`   ✓ IPv6: ${ips.ipv6}`);

  const cloudflareConfig: CloudflareDnsConfig = {
    apiToken: environmentsConfig.cloudflare.apiToken,
    zoneId: environmentsConfig.cloudflare.zoneId
  };

  log("\n3. Checking existing DNS records...");
  const existingRecords = await listDnsRecords(cloudflareConfig, fullHostname);
  const existingA = existingRecords.find(r => r.type === "A");
  const existingAAAA = existingRecords.find(r => r.type === "AAAA");
  const existingMx = existingRecords.filter(r => r.type === "MX");

  if (existingA) log(`   ⚠ A record exists: ${existingA.content}`);
  if (existingAAAA) log(`   ⚠ AAAA record exists: ${existingAAAA.content}`);
  if (existingMx.length > 0) log(`   ⚠ ${existingMx.length} MX record(s) exist`);

  log("\n4. Creating DNS records...");
  if (ips.ipv4 && !existingA) {
    await createDnsRecord(cloudflareConfig, { type: DnsRecordType.A, name: subdomain, content: ips.ipv4 });
    log(`   ✓ A record created: ${subdomain} -> ${ips.ipv4}`);
  } else if (existingA) {
    log(`   - Skipping A record (already exists)`);
  }

  if (ips.ipv6 && !existingAAAA) {
    await createDnsRecord(cloudflareConfig, { type: DnsRecordType.AAAA, name: subdomain, content: ips.ipv6 });
    log(`   ✓ AAAA record created: ${subdomain} -> ${ips.ipv6}`);
  } else if (existingAAAA) {
    log(`   - Skipping AAAA record (already exists)`);
  }

  const requiredMxRecords = [
    {content: "route1.mx.cloudflare.net", priority: 16},
    {content: "route2.mx.cloudflare.net", priority: 99},
    {content: "route3.mx.cloudflare.net", priority: 2}
  ];

  for (const mx of requiredMxRecords) {
    const existing = existingMx.find(r => r.content === mx.content);
    if (!existing) {
      await createDnsRecord(cloudflareConfig, {type: DnsRecordType.MX, name: subdomain, content: mx.content, priority: mx.priority});
      log(`   ✓ MX record created: ${subdomain} -> ${mx.content} (priority ${mx.priority})`);
    } else {
      log(`   - Skipping MX record ${mx.content} (already exists)`);
    }
  }

  log("\n5. Adding Fly.io certificate...");
  const certResult = await addCertificate(flyConfig, fullHostname);
  if (certResult) {
    log(`   ✓ Certificate added for ${fullHostname}`);
  } else {
    log(`   - Certificate already exists for ${fullHostname}`);
  }

  log("\n6. Verifying certificate status...");
  const certs = await queryCertificates(flyConfig);
  const cert = certs.find(c => c.hostname === fullHostname);
  if (cert) {
    log(`   ✓ Status: ${cert.clientStatus}`);
    cert.issued.forEach(i => log(`   ✓ ${i.type} cert expires: ${i.expiresAt}`));
  }

  log("\n7. Updating Web URL in target environment...");
  if (envConfig.mongo?.cluster && envConfig.mongo?.db) {
    const mongoUri = buildMongoUri({
      cluster: envConfig.mongo.cluster,
      username: envConfig.mongo.username || "",
      password: envConfig.mongo.password || "",
      database: envConfig.mongo.db
    });
    const { client, db } = await connectToDatabase({ uri: mongoUri, database: envConfig.mongo.db });
    try {
      const newHref = `https://${fullHostname}`;
      const result = await db.collection("config").updateOne(
        { key: "system" },
        { $set: { "value.group.href": newHref } }
      );
      if (result.modifiedCount > 0) {
        log(`   ✓ Updated group.href to ${newHref}`);
      } else {
        log(`   - group.href already set or system config not found`);
      }
    } finally {
      await client.close();
    }
  } else {
    log("   - Skipping (no MongoDB config for target environment)");
  }

  log(`\n✓ Subdomain setup complete: https://${fullHostname}`);
}

export async function removeSubdomainForEnvironment(environmentName: string): Promise<SubdomainRemovalResult> {
  const logs: string[] = [];
  const step = (msg: string) => { logs.push(msg); log(msg); };

  step(`Removing NGX subdomain for environment ${environmentName}`);

  const environmentsConfig = await environmentsConfigFromDatabase();
  if (!environmentsConfig?.cloudflare?.apiToken || !environmentsConfig?.cloudflare?.zoneId) {
    throw new Error("Cloudflare not configured in environments config");
  }
  if (!environmentsConfig?.cloudflare?.baseDomain) {
    throw new Error("Cloudflare baseDomain not configured. Add cloudflare.baseDomain to environments config.");
  }

  const baseDomain = environmentsConfig.cloudflare.baseDomain;
  const fullHostname = `${environmentName}.${baseDomain}`;

  const cloudflareConfig: CloudflareDnsConfig = {
    apiToken: environmentsConfig.cloudflare.apiToken,
    zoneId: environmentsConfig.cloudflare.zoneId
  };

  step("Finding DNS records...");
  const records = await listDnsRecords(cloudflareConfig, fullHostname);

  if (records.length === 0) {
    step("  - No DNS records found");
  } else {
    for (const record of records) {
      await deleteDnsRecord(cloudflareConfig, record.id);
      step(`  ✓ Deleted ${record.type} record for ${fullHostname}`);
    }
  }

  const envConfig = await findEnvironmentFromDatabase(environmentName);
  const flyApiToken = envConfig?.apiKey;
  if (flyApiToken) {
    const appName = envConfig.appName || `ngx-ramblers-${environmentName}`;
    const flyConfig: FlyConfig = { apiToken: flyApiToken, appName };
    step("Deleting Fly.io certificate...");
    try {
      await deleteCertificate(flyConfig, fullHostname);
      step(`  ✓ Certificate deleted for ${fullHostname}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      step(`  - Certificate delete skipped: ${message}`);
    }
  } else {
    step("  - No Fly.io API token — skipping certificate deletion");
  }

  step(`Done: NGX subdomain ${fullHostname} removed`);
  return { hostname: fullHostname, logs };
}

export async function checkSubdomainStatus(environmentName: string): Promise<void> {
  const envConfig = await findEnvironmentFromDatabase(environmentName);
  if (!envConfig) {
    throw new Error(`Environment '${environmentName}' not found`);
  }

  const environmentsConfig = await environmentsConfigFromDatabase();
  const baseDomain = environmentsConfig?.cloudflare?.baseDomain;
  if (!baseDomain) {
    throw new Error("Cloudflare baseDomain not configured. Add cloudflare.baseDomain to environments config.");
  }
  const fullHostname = `${environmentName}.${baseDomain}`;
  const appName = envConfig.appName || `ngx-ramblers-${environmentName}`;
  const flyApiToken = envConfig.apiKey;

  log(`\nSubdomain: ${fullHostname}`);

  if (flyApiToken) {
    const flyConfig: FlyConfig = { apiToken: flyApiToken, appName };
    const certs = await queryCertificates(flyConfig);
    const cert = certs.find(c => c.hostname === fullHostname);

    if (cert) {
      log(`Certificate status: ${cert.clientStatus}`);
      cert.issued.forEach(i => log(`  ${i.type}: expires ${i.expiresAt}`));
    } else {
      log("No certificate found");
    }
  } else {
    log("No Fly.io API token - cannot check certificate status");
  }
}

const HOSTNAME_PATTERN = /^(?=.{1,253}$)(?!-)([a-z0-9-]{1,63}(?<!-)\.)+[a-z]{2,}$/i;

function normaliseHostname(hostname: string): string {
  return (hostname || "").trim().toLowerCase().replace(/\.$/, "").replace(/^https?:\/\//, "");
}

function validateHostname(hostname: string): string {
  const normalised = normaliseHostname(hostname);
  if (!normalised) {
    throw new Error("Hostname is required");
  }
  if (normalised.includes("/")) {
    throw new Error(`Invalid hostname: ${hostname}. Provide a plain FQDN without scheme or path.`);
  }
  if (!HOSTNAME_PATTERN.test(normalised)) {
    throw new Error(`Invalid hostname: ${hostname}. Provide a fully-qualified domain name.`);
  }
  return normalised;
}

async function loadEnvironmentsConfigDocument(): Promise<EnvironmentsConfig> {
  const configDocument = await configController.queryKey(ConfigKey.ENVIRONMENTS);
  const value: EnvironmentsConfig = configDocument?.value;
  if (!value) {
    throw new Error("Environments configuration not found");
  }
  return value;
}

async function saveEnvironmentsConfigDocument(value: EnvironmentsConfig): Promise<void> {
  await configController.createOrUpdateKey(ConfigKey.ENVIRONMENTS, value);
}

function assertHostnameNotUsedElsewhere(environmentsConfig: EnvironmentsConfig, hostname: string, environmentName: string): void {
  const conflict = (environmentsConfig.environments || []).find(env =>
    env.environment !== environmentName
    && (env.customDomains || []).some(entry => entry.hostname === hostname));
  if (conflict) {
    throw new Error(`Hostname ${hostname} is already attached to environment '${conflict.environment}'`);
  }
}

function upsertCustomDomainEntry(existing: CustomDomainEntry[] | undefined, entry: CustomDomainEntry): CustomDomainEntry[] {
  const current = existing || [];
  const index = current.findIndex(item => item.hostname === entry.hostname);
  if (index >= 0) {
    const merged = [...current];
    merged[index] = { ...merged[index], ...entry };
    return merged;
  }
  return [...current, entry];
}

function removeCustomDomainEntry(existing: CustomDomainEntry[] | undefined, hostname: string): CustomDomainEntry[] {
  return (existing || []).filter(item => item.hostname !== hostname);
}

async function persistCustomDomainEntry(environmentName: string, entry: CustomDomainEntry): Promise<void> {
  const environmentsConfig = await loadEnvironmentsConfigDocument();
  const environments = (environmentsConfig.environments || []).map(env =>
    env.environment === environmentName
      ? { ...env, customDomains: upsertCustomDomainEntry(env.customDomains, entry) }
      : env);
  await saveEnvironmentsConfigDocument({ ...environmentsConfig, environments });
}

async function persistCustomDomainRemoval(environmentName: string, hostname: string): Promise<void> {
  const environmentsConfig = await loadEnvironmentsConfigDocument();
  const environments = (environmentsConfig.environments || []).map(env =>
    env.environment === environmentName
      ? { ...env, customDomains: removeCustomDomainEntry(env.customDomains, hostname) }
      : env);
  await saveEnvironmentsConfigDocument({ ...environmentsConfig, environments });
}

function subdomainLabelForHostname(hostname: string, zone: CloudflareZone): string {
  if (hostname === zone.name) {
    return "@";
  }
  const suffix = `.${zone.name}`;
  if (hostname.endsWith(suffix)) {
    return hostname.slice(0, hostname.length - suffix.length);
  }
  return hostname;
}

export async function addCustomDomainForEnvironment(environmentName: string, hostnameInput: string): Promise<CustomDomainOperationResult> {
  const logs: string[] = [];
  const step = (msg: string) => { logs.push(msg); log(msg); };

  const hostname = validateHostname(hostnameInput);
  step(`Adding custom domain ${hostname} to environment ${environmentName}`);

  const envConfig = await findEnvironmentFromDatabase(environmentName);
  if (!envConfig) {
    throw new Error(`Environment '${environmentName}' not found in database`);
  }

  const environmentsConfig = await environmentsConfigFromDatabase();
  if (!environmentsConfig?.cloudflare?.apiToken) {
    throw new Error("Cloudflare API token not configured. Add cloudflare.apiToken to environments config.");
  }
  assertHostnameNotUsedElsewhere(environmentsConfig, hostname, environmentName);

  const flyApiToken = envConfig.apiKey;
  if (!flyApiToken) {
    throw new Error(`No Fly.io API token found for environment '${environmentName}'`);
  }

  const appName = envConfig.appName || `ngx-ramblers-${environmentName}`;

  step("Verifying Cloudflare token...");
  const tokenValid = await verifyToken(environmentsConfig.cloudflare.apiToken);
  if (!tokenValid) {
    throw new Error("Cloudflare token is invalid");
  }
  step("  ✓ Token valid");

  step("Resolving Cloudflare zone for hostname...");
  const zone = await zoneForHostname(environmentsConfig.cloudflare.apiToken, hostname);
  if (!zone) {
    throw new Error(`No Cloudflare zone found that covers hostname ${hostname}. Add the zone in Cloudflare first.`);
  }
  step(`  ✓ Zone ${zone.name} (${zone.id})`);

  step("Getting Fly.io IP addresses...");
  const flyConfig: FlyConfig = { apiToken: flyApiToken, appName };
  const ips = await appIpAddresses(flyConfig);
  if (!ips.ipv4) {
    step("  ⚠ No IPv4 address found — allocating shared IPv4...");
    const allocated = await allocateIpAddress(flyConfig, IpAddressType.SharedV4);
    ips.ipv4 = allocated.address;
    step(`  ✓ Allocated shared IPv4: ${ips.ipv4}`);
  } else {
    step(`  ✓ Fly IPv4: ${ips.ipv4}`);
  }
  if (ips.ipv6) step(`  ✓ Fly IPv6: ${ips.ipv6}`);

  const cloudflareConfig: CloudflareDnsConfig = {
    apiToken: environmentsConfig.cloudflare.apiToken,
    zoneId: zone.id
  };

  const recordName = subdomainLabelForHostname(hostname, zone);

  step("Reconciling DNS records to point at Fly...");
  const existingRecords = await listDnsRecords(cloudflareConfig, hostname);
  const isApex = hostname === zone.name;
  const flyCnameTarget = `${appName}.fly.dev`;

  if (isApex) {
    for (const stale of existingRecords.filter(record => record.type === "CNAME")) {
      await deleteDnsRecord(cloudflareConfig, stale.id);
      step(`  ✓ Removed stale CNAME ${hostname} -> ${stale.content} (apex needs A/AAAA)`);
    }
    await reconcileAddressRecord(step, cloudflareConfig, recordName, hostname, DnsRecordType.A, ips.ipv4, existingRecords);
    await reconcileAddressRecord(step, cloudflareConfig, recordName, hostname, DnsRecordType.AAAA, ips.ipv6, existingRecords);
  } else {
    for (const stale of existingRecords.filter(record => record.type === "A" || record.type === "AAAA")) {
      await deleteDnsRecord(cloudflareConfig, stale.id);
      step(`  ✓ Removed stale ${stale.type} ${hostname} -> ${stale.content} (subdomain uses CNAME)`);
    }
    await reconcileCnameRecord(step, cloudflareConfig, recordName, hostname, flyCnameTarget, existingRecords);
  }

  step("Requesting Fly certificate...");
  let status: CustomDomainStatus = CustomDomainStatus.PENDING;
  let statusMessage: string | undefined;
  try {
    const certResult = await addCertificate(flyConfig, hostname);
    if (certResult) {
      step(`  ✓ Certificate requested for ${hostname}`);
    } else {
      step(`  - Certificate already present for ${hostname}`);
    }

    const certs = await queryCertificates(flyConfig);
    const cert = certs.find(item => item.hostname === hostname);
    if (cert) {
      step(`  ✓ Fly certificate status: ${cert.clientStatus}`);
      await reconcileFlyValidationRecords(step, cloudflareConfig, zone, hostname, cert);

      const certsAfter = await queryCertificates(flyConfig);
      const certRefreshed = certsAfter.find(item => item.hostname === hostname) || cert;
      if (certRefreshed.clientStatus !== cert.clientStatus) {
        step(`  ✓ Fly certificate status now: ${certRefreshed.clientStatus}`);
      }
      statusMessage = certRefreshed.clientStatus?.toLowerCase() === "ready" ? undefined : "Fly is validating — DNS propagation usually takes 1–5 minutes";
      status = certRefreshed.clientStatus?.toLowerCase() === "ready" ? CustomDomainStatus.ATTACHED : CustomDomainStatus.PENDING;
    }
  } catch (error) {
    status = CustomDomainStatus.FAILED;
    statusMessage = error instanceof Error ? error.message : "Fly certificate request failed";
    step(`  ✗ ${statusMessage}`);
    throw error;
  } finally {
    const entry: CustomDomainEntry = {
      hostname,
      addedAt: dateTimeNowAsValue(),
      status,
      zoneId: zone.id,
      message: statusMessage
    };
    await persistCustomDomainEntry(environmentName, entry);
  }

  const finalEntry: CustomDomainEntry = {
    hostname,
    addedAt: dateTimeNowAsValue(),
    status,
    zoneId: zone.id,
    message: statusMessage
  };

  const existingDomains = (environmentsConfig.environments || []).find(env => env.environment === environmentName)?.customDomains || [];
  const attachedApex = existingDomains.find(entry =>
    entry.hostname !== hostname && entry.status === CustomDomainStatus.ATTACHED && entry.hostname === zone.name);
  const shouldUpdateHref = isApex || !attachedApex;

  if (shouldUpdateHref && envConfig.mongo?.cluster && envConfig.mongo?.db) {
    await updateGroupHref(step, envConfig, hostname);
  } else if (attachedApex) {
    step(`  - Group Web URL kept at https://${attachedApex.hostname} (apex takes precedence over companion)`);
  } else if (!envConfig.mongo?.cluster || !envConfig.mongo?.db) {
    step("  ⚠ Could not update Group Web URL automatically (no MongoDB config on this env). Set it manually in Admin → System Settings → Group → Web URL.");
  }

  try {
    await applyDomainRedirectHygiene(step, environmentsConfig, environmentName, hostname, zone);
  } catch (error) {
    step(`  ⚠ Apex/www redirect reconciliation skipped: ${redirectErrorDetail(error)}`);
  }

  step(`Done: https://${hostname}`);
  return { hostname, zoneId: zone.id, appName, entry: finalEntry, logs };
}

async function updateGroupHref(
  step: (msg: string) => void,
  envConfig: { mongo?: { cluster?: string; db?: string; username?: string; password?: string } },
  hostname: string
): Promise<void> {
  if (!envConfig.mongo?.cluster || !envConfig.mongo?.db) return;
  step(`Updating target env group.href to https://${hostname}...`);
  const mongoUri = buildMongoUri({
    cluster: envConfig.mongo.cluster,
    username: envConfig.mongo.username || "",
    password: envConfig.mongo.password || "",
    database: envConfig.mongo.db
  });
  const { client, db } = await connectToDatabase({ uri: mongoUri, database: envConfig.mongo.db });
  try {
    const newHref = `https://${hostname}`;
    const result = await db.collection("config").updateOne(
      { key: "system" },
      { $set: { "value.group.href": newHref } }
    );
    if (result.modifiedCount > 0) {
      step(`  ✓ group.href updated to ${newHref}`);
    } else {
      step(`  - group.href already set to ${newHref} or system config not found`);
    }
  } finally {
    await client.close();
  }
}

async function reconcileAddressRecord(
  step: (msg: string) => void,
  cloudflareConfig: CloudflareDnsConfig,
  recordName: string,
  hostname: string,
  type: DnsRecordType.A | DnsRecordType.AAAA,
  flyAddress: string | undefined,
  existingRecords: { id: string; type: string; content: string }[]
): Promise<void> {
  const existing = existingRecords.find(record => record.type === type);
  if (!flyAddress) {
    if (existing) {
      step(`  - ${type} record present (${existing.content}) but Fly has no ${type === DnsRecordType.A ? "IPv4" : "IPv6"} — leaving as is`);
    }
    return;
  }
  if (!existing) {
    await createDnsRecord(cloudflareConfig, { type, name: recordName, content: flyAddress, proxied: false });
    step(`  ✓ ${type} record created (DNS only): ${hostname} -> ${flyAddress}`);
    return;
  }
  if (existing.content === flyAddress) {
    step(`  - ${type} record already correct (${flyAddress})`);
    return;
  }
  await updateDnsRecord(cloudflareConfig, existing.id, { type, name: recordName, content: flyAddress, proxied: false });
  step(`  ✓ ${type} record updated (DNS only): ${hostname} ${existing.content} -> ${flyAddress}`);
}

async function reconcileCnameRecord(
  step: (msg: string) => void,
  cloudflareConfig: CloudflareDnsConfig,
  recordName: string,
  hostname: string,
  target: string,
  existingRecords: { id: string; type: string; content: string }[]
): Promise<void> {
  const existing = existingRecords.find(record => record.type === "CNAME");
  if (!existing) {
    await createDnsRecord(cloudflareConfig, { type: DnsRecordType.CNAME, name: recordName, content: target, proxied: false });
    step(`  ✓ CNAME created (DNS only): ${hostname} -> ${target}`);
    return;
  }
  if (existing.content === target) {
    step(`  - CNAME already correct (${target})`);
    return;
  }
  await updateDnsRecord(cloudflareConfig, existing.id, { type: DnsRecordType.CNAME, name: recordName, content: target, proxied: false });
  step(`  ✓ CNAME updated (DNS only): ${hostname} ${existing.content} -> ${target}`);
}

const REDIRECT_PLACEHOLDER_IPV4 = "192.0.2.1";

function redirectErrorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function reconcileRedirectPlaceholderRecord(
  step: (msg: string) => void,
  cloudflareConfig: CloudflareDnsConfig,
  recordName: string,
  hostname: string,
  existingRecords: DnsRecordResult[]
): Promise<void> {
  const existingCname = existingRecords.find(record => record.type === "CNAME");
  if (existingCname) {
    step(`  - ${hostname} already has a CNAME (${existingCname.content}); leaving DNS as is`);
    if (!existingCname.proxied) {
      step(`  ⚠ that CNAME is DNS-only — the redirect rule only fires for proxied records`);
    }
    return;
  }
  const existingA = existingRecords.find(record => record.type === "A");
  if (!existingA) {
    await createDnsRecord(cloudflareConfig, { type: DnsRecordType.A, name: recordName, content: REDIRECT_PLACEHOLDER_IPV4, proxied: true });
    step(`  ✓ Proxied A record created: ${hostname} -> ${REDIRECT_PLACEHOLDER_IPV4} (redirect-only placeholder)`);
    return;
  }
  if (existingA.proxied) {
    step(`  - ${hostname} already has a proxied A record (${existingA.content})`);
    return;
  }
  await updateDnsRecord(cloudflareConfig, existingA.id, { type: DnsRecordType.A, name: recordName, content: existingA.content, proxied: true });
  step(`  ✓ A record for ${hostname} set to proxied so the redirect rule applies`);
}

function siblingAttachedToEnvironment(environmentsConfig: EnvironmentsConfig, environmentName: string, sibling: string): boolean {
  const customDomains = (environmentsConfig.environments || [])
    .find(env => env.environment === environmentName)?.customDomains || [];
  return customDomains.some(entry => entry.hostname === sibling && entry.status === CustomDomainStatus.ATTACHED);
}

async function applyDomainRedirectHygiene(
  step: (msg: string) => void,
  environmentsConfig: EnvironmentsConfig,
  environmentName: string,
  attachedHostname: string,
  zone: CloudflareZone
): Promise<void> {
  const cloudflareConfig: CloudflareDnsConfig = { apiToken: environmentsConfig.cloudflare.apiToken, zoneId: zone.id };

  step("Reconciling apex/www redirect rules...");
  try {
    const removed = await removeHostRedirectRule(cloudflareConfig, attachedHostname);
    if (removed) {
      step(`  ✓ Removed a stale redirect rule that pointed ${attachedHostname} elsewhere (it now serves the site)`);
    }
  } catch (error) {
    step(`  ⚠ Could not check redirect rules for ${attachedHostname}: ${redirectErrorDetail(error)}`);
  }

  const sibling = apexWwwSibling(attachedHostname, zone);
  if (!sibling) {
    step(`  - ${attachedHostname} is not the apex or www of ${zone.name} — no apex/www redirect applies`);
    return;
  }
  if (siblingAttachedToEnvironment(environmentsConfig, environmentName, sibling)) {
    step(`  - ${sibling} is attached as its own custom domain — no redirect created`);
    return;
  }
  try {
    const result = await ensureHostRedirectRule(cloudflareConfig, { fromHost: sibling, toHost: attachedHostname });
    const recordName = subdomainLabelForHostname(sibling, zone);
    const existingRecords = await listDnsRecords(cloudflareConfig, sibling);
    await reconcileRedirectPlaceholderRecord(step, cloudflareConfig, recordName, sibling, existingRecords);
    step(`  ✓ Redirect rule ${result.action}: ${sibling} -> https://${attachedHostname} (302, path + query preserved)`);
  } catch (error) {
    step(`  ⚠ Could not set up the ${sibling} redirect: ${redirectErrorDetail(error)}`);
  }
}

async function removeSiblingRedirect(
  step: (msg: string) => void,
  cloudflareConfig: CloudflareDnsConfig,
  zone: CloudflareZone,
  removedHostname: string
): Promise<void> {
  const sibling = apexWwwSibling(removedHostname, zone);
  if (!sibling) {
    return;
  }
  try {
    const removed = await removeHostRedirectRule(cloudflareConfig, sibling);
    if (removed) {
      step(`  ✓ Removed redirect rule ${sibling} -> ${removedHostname}`);
    }
    const siblingRecords = await listDnsRecords(cloudflareConfig, sibling);
    for (const placeholder of siblingRecords.filter(record => record.type === "A" && record.content === REDIRECT_PLACEHOLDER_IPV4)) {
      await deleteDnsRecord(cloudflareConfig, placeholder.id);
      step(`  ✓ Removed redirect-only placeholder A record for ${sibling}`);
    }
  } catch (error) {
    step(`  ⚠ Could not clean up the ${sibling} redirect: ${redirectErrorDetail(error)}`);
  }
}

export async function setupApexRedirectForEnvironment(environmentName: string, primaryHostnameInput: string): Promise<ApexRedirectOperationResult> {
  const logs: string[] = [];
  const step = (msg: string) => { logs.push(msg); log(msg); };

  const primaryHostname = validateHostname(primaryHostnameInput);
  step(`Setting up apex/www redirect to ${primaryHostname} for environment ${environmentName}`);

  const envConfig = await findEnvironmentFromDatabase(environmentName);
  if (!envConfig) {
    throw new Error(`Environment '${environmentName}' not found in database`);
  }

  const environmentsConfig = await environmentsConfigFromDatabase();
  if (!environmentsConfig?.cloudflare?.apiToken) {
    throw new Error("Cloudflare API token not configured. Add cloudflare.apiToken to environments config.");
  }

  step("Verifying Cloudflare token...");
  const tokenValid = await verifyToken(environmentsConfig.cloudflare.apiToken);
  if (!tokenValid) {
    throw new Error("Cloudflare token is invalid");
  }
  step("  ✓ Token valid");

  step("Resolving Cloudflare zone for hostname...");
  const zone = await zoneForHostname(environmentsConfig.cloudflare.apiToken, primaryHostname);
  if (!zone) {
    throw new Error(`No Cloudflare zone found that covers hostname ${primaryHostname}. Add the zone in Cloudflare first.`);
  }
  step(`  ✓ Zone ${zone.name} (${zone.id})`);

  const cloudflareConfig: CloudflareDnsConfig = { apiToken: environmentsConfig.cloudflare.apiToken, zoneId: zone.id };

  const redirectFrom = apexWwwSibling(primaryHostname, zone);
  if (!redirectFrom) {
    throw new Error(`${primaryHostname} is not the apex or www of zone ${zone.name}, so there is no apex/www pair to redirect. Only ${zone.name} and www.${zone.name} can be paired this way.`);
  }
  step(`  ✓ Redirect pair: ${redirectFrom} -> ${primaryHostname}`);

  step(`Checking ${primaryHostname} can serve the site before redirecting to it...`);
  const primaryRecords = await listDnsRecords(cloudflareConfig, primaryHostname);
  const primaryServingRecord = primaryRecords.find(record => ["A", "AAAA", "CNAME"].includes(record.type));
  if (!primaryServingRecord) {
    throw new Error(`${primaryHostname} has no A, AAAA or CNAME record, so it does not resolve. Redirecting ${redirectFrom} to it would take the site offline. Attach ${primaryHostname} as a custom domain first.`);
  }
  if (primaryServingRecord.content === REDIRECT_PLACEHOLDER_IPV4) {
    throw new Error(`${primaryHostname} points at the redirect placeholder ${REDIRECT_PLACEHOLDER_IPV4}, so it cannot serve the site. Redirecting ${redirectFrom} to it would take the site offline.`);
  }
  step(`  ✓ ${primaryHostname} resolves (${primaryServingRecord.type} ${primaryServingRecord.content})`);

  if (siblingAttachedToEnvironment(environmentsConfig, environmentName, redirectFrom)) {
    step(`  - ${redirectFrom} is attached as its own custom domain — it serves the site directly, no redirect created`);
    return { primaryHostname, redirectFrom, zoneId: zone.id, redirectCreated: false, logs };
  }

  step(`Creating Cloudflare redirect rule ${redirectFrom} -> https://${primaryHostname}...`);
  const result = await ensureHostRedirectRule(cloudflareConfig, { fromHost: redirectFrom, toHost: primaryHostname });
  step(`  ✓ Redirect rule ${result.action} (302, path + query preserved)`);

  step(`Ensuring ${redirectFrom} reaches Cloudflare's edge...`);
  const recordName = subdomainLabelForHostname(redirectFrom, zone);
  const existingRecords = await listDnsRecords(cloudflareConfig, redirectFrom);
  await reconcileRedirectPlaceholderRecord(step, cloudflareConfig, recordName, redirectFrom, existingRecords);

  step(`Done: https://${redirectFrom} now redirects to https://${primaryHostname}`);
  return { primaryHostname, redirectFrom, zoneId: zone.id, redirectCreated: true, logs };
}

export async function removeApexRedirectForEnvironment(environmentName: string, redirectFromInput: string): Promise<ApexRedirectRemovalResult> {
  const logs: string[] = [];
  const step = (msg: string) => { logs.push(msg); log(msg); };

  const redirectFrom = validateHostname(redirectFromInput);
  step(`Removing redirect rule for ${redirectFrom} in environment ${environmentName}`);

  const environmentsConfig = await environmentsConfigFromDatabase();
  if (!environmentsConfig?.cloudflare?.apiToken) {
    throw new Error("Cloudflare API token not configured. Add cloudflare.apiToken to environments config.");
  }

  const zone = await zoneForHostname(environmentsConfig.cloudflare.apiToken, redirectFrom);
  if (!zone) {
    throw new Error(`No Cloudflare zone found that covers hostname ${redirectFrom}`);
  }
  step(`  ✓ Zone ${zone.name} (${zone.id})`);

  const cloudflareConfig: CloudflareDnsConfig = { apiToken: environmentsConfig.cloudflare.apiToken, zoneId: zone.id };

  const redirectRemoved = await removeHostRedirectRule(cloudflareConfig, redirectFrom);
  if (redirectRemoved) {
    step(`  ✓ Removed redirect rule for ${redirectFrom}`);
  } else {
    step(`  - No redirect rule found for ${redirectFrom}`);
  }

  const existingRecords = await listDnsRecords(cloudflareConfig, redirectFrom);
  const placeholders = existingRecords.filter(record => record.type === "A" && record.content === REDIRECT_PLACEHOLDER_IPV4);
  await Promise.all(placeholders.map(async placeholder => {
    await deleteDnsRecord(cloudflareConfig, placeholder.id);
    step(`  ✓ Removed redirect-only placeholder A record for ${redirectFrom}`);
  }));

  if (redirectRemoved && placeholders.length === existingRecords.filter(record => record.type === "A").length && placeholders.length > 0) {
    step(`  ⚠ ${redirectFrom} now has no A record, so it will stop resolving. Attach it as a custom domain if it should serve the site.`);
  }

  step(`Done: ${redirectFrom} no longer redirects`);
  return { redirectFrom, zoneId: zone.id, redirectRemoved, placeholderRecordsRemoved: placeholders.length, logs };
}

function extractCertId(dnsValidationTarget: string | undefined): string | undefined {
  if (!dnsValidationTarget) return undefined;
  const match = dnsValidationTarget.match(/\.([^.]+)\.flydns\.net\.?$/);
  return match?.[1];
}

async function reconcileFlyValidationRecords(
  step: (msg: string) => void,
  cloudflareConfig: CloudflareDnsConfig,
  zone: CloudflareZone,
  hostname: string,
  cert: { dnsValidationHostname?: string; dnsValidationTarget?: string } | undefined
): Promise<void> {
  if (!cert?.dnsValidationHostname || !cert?.dnsValidationTarget) {
    step("  - Fly did not return validation records (cert may already be issued)");
    return;
  }

  const acmeName = subdomainLabelForHostname(cert.dnsValidationHostname.replace(/\.$/, ""), zone);
  const acmeTarget = cert.dnsValidationTarget.replace(/\.$/, "");

  step(`Reconciling Fly ACME CNAME: ${cert.dnsValidationHostname} -> ${acmeTarget}`);
  const acmeRecords = await listDnsRecords(cloudflareConfig, cert.dnsValidationHostname.replace(/\.$/, ""));
  const existingAcme = acmeRecords.find(record => record.type === "CNAME");
  if (!existingAcme) {
    await createDnsRecord(cloudflareConfig, { type: DnsRecordType.CNAME, name: acmeName, content: acmeTarget, proxied: false });
    step(`  ✓ ACME CNAME created`);
  } else if (existingAcme.content !== acmeTarget) {
    await updateDnsRecord(cloudflareConfig, existingAcme.id, { type: DnsRecordType.CNAME, name: acmeName, content: acmeTarget, proxied: false });
    step(`  ✓ ACME CNAME updated ${existingAcme.content} -> ${acmeTarget}`);
  } else {
    step(`  - ACME CNAME already correct`);
  }

  const certId = extractCertId(cert.dnsValidationTarget);
  if (!certId) {
    step("  - Could not derive Fly app id from dnsValidationTarget; skipping ownership TXT");
    return;
  }
  const ownershipName = `_fly-ownership.${hostname}`;
  const ownershipValue = `app-${certId}`;
  const ownershipLabel = subdomainLabelForHostname(ownershipName, zone);

  step(`Reconciling Fly ownership TXT: ${ownershipName} -> ${ownershipValue}`);
  const ownershipRecords = await listDnsRecords(cloudflareConfig, ownershipName);
  const existingTxt = ownershipRecords.find(record => record.type === "TXT");
  if (!existingTxt) {
    await createDnsRecord(cloudflareConfig, { type: DnsRecordType.TXT, name: ownershipLabel, content: ownershipValue });
    step(`  ✓ Ownership TXT created`);
  } else if (existingTxt.content.replace(/^"|"$/g, "") !== ownershipValue) {
    await updateDnsRecord(cloudflareConfig, existingTxt.id, { type: DnsRecordType.TXT, name: ownershipLabel, content: ownershipValue });
    step(`  ✓ Ownership TXT updated`);
  } else {
    step(`  - Ownership TXT already correct`);
  }
}

export async function removeCustomDomainForEnvironment(environmentName: string, hostnameInput: string): Promise<CustomDomainOperationResult> {
  const logs: string[] = [];
  const step = (msg: string) => { logs.push(msg); log(msg); };

  const hostname = validateHostname(hostnameInput);
  step(`Removing custom domain ${hostname} from environment ${environmentName}`);

  const envConfig = await findEnvironmentFromDatabase(environmentName);
  if (!envConfig) {
    throw new Error(`Environment '${environmentName}' not found in database`);
  }

  const environmentsConfig = await environmentsConfigFromDatabase();
  if (!environmentsConfig?.cloudflare?.apiToken) {
    throw new Error("Cloudflare API token not configured. Add cloudflare.apiToken to environments config.");
  }

  const appName = envConfig.appName || `ngx-ramblers-${environmentName}`;

  step("Resolving Cloudflare zone for hostname...");
  const zone = await zoneForHostname(environmentsConfig.cloudflare.apiToken, hostname);
  if (zone) {
    step(`  ✓ Zone ${zone.name} (${zone.id})`);
    const cloudflareConfig: CloudflareDnsConfig = {
      apiToken: environmentsConfig.cloudflare.apiToken,
      zoneId: zone.id
    };
    step("Deleting DNS records...");
    const records = await listDnsRecords(cloudflareConfig, hostname);
    if (records.length === 0) {
      step("  - No DNS records found");
    } else {
      for (const record of records) {
        await deleteDnsRecord(cloudflareConfig, record.id);
        step(`  ✓ Deleted ${record.type} record for ${hostname}`);
      }
    }
    await removeSiblingRedirect(step, cloudflareConfig, zone, hostname);
  } else {
    step("  - Zone not found in Cloudflare, skipping DNS cleanup");
  }

  if (envConfig.apiKey) {
    step("Deleting Fly.io certificate...");
    const flyConfig: FlyConfig = { apiToken: envConfig.apiKey, appName };
    try {
      await deleteCertificate(flyConfig, hostname);
      step(`  ✓ Certificate deleted for ${hostname}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      step(`  - Certificate delete skipped: ${message}`);
    }
  } else {
    step("  - No Fly.io API token — skipping certificate deletion");
  }

  await persistCustomDomainRemoval(environmentName, hostname);
  step(`Done: ${hostname} removed`);
  return { hostname, zoneId: zone?.id, appName, logs };
}

export async function checkCustomDomainStatus(environmentName: string, hostnameInput: string): Promise<CustomDomainOperationResult> {
  const logs: string[] = [];
  const step = (msg: string) => { logs.push(msg); log(msg); };

  const hostname = validateHostname(hostnameInput);
  step(`Checking custom domain ${hostname} on environment ${environmentName}`);

  const envConfig = await findEnvironmentFromDatabase(environmentName);
  if (!envConfig) {
    throw new Error(`Environment '${environmentName}' not found in database`);
  }

  const environmentsConfig = await environmentsConfigFromDatabase();
  if (!environmentsConfig?.cloudflare?.apiToken) {
    throw new Error("Cloudflare API token not configured. Add cloudflare.apiToken to environments config.");
  }

  const flyApiToken = envConfig.apiKey;
  if (!flyApiToken) {
    throw new Error(`No Fly.io API token found for environment '${environmentName}'`);
  }

  const appName = envConfig.appName || `ngx-ramblers-${environmentName}`;
  const flyConfig: FlyConfig = { apiToken: flyApiToken, appName };

  step("Looking up Fly IPs...");
  const ips = await appIpAddresses(flyConfig);
  step(`  ✓ Fly IPv4: ${ips.ipv4 || "none"}, IPv6: ${ips.ipv6 || "none"}`);

  step("Resolving Cloudflare zone...");
  const zone = await zoneForHostname(environmentsConfig.cloudflare.apiToken, hostname);
  const dnsProblem = await reconcileCustomDomainDns(step, environmentsConfig, flyConfig, zone, hostname, appName, ips);

  step("Querying Fly certificate status...");
  const certs = await queryCertificates(flyConfig);
  const cert = certs.find(item => item.hostname === hostname);
  if (!cert) {
    step(`  ✗ No Fly certificate found for ${hostname}`);
  } else {
    step(`  ✓ Fly certificate status: ${cert.clientStatus}`);
    if (cert.issued?.length) {
      cert.issued.forEach(i => step(`  ✓ ${i.type} cert expires: ${i.expiresAt}`));
    }
  }
  const { status, message } = classifyCertStatus(cert, dnsProblem);

  const existingEnv = (environmentsConfig.environments || []).find(item => item.environment === environmentName);
  const existingEntry = (existingEnv?.customDomains || []).find(item => item.hostname === hostname);
  const entry: CustomDomainEntry = {
    hostname,
    addedAt: existingEntry?.addedAt ?? dateTimeNowAsValue(),
    status,
    zoneId: zone?.id,
    message
  };
  await persistCustomDomainEntry(environmentName, entry);

  step(`Done: ${hostname} — ${message}`);
  return { hostname, zoneId: zone?.id, appName, entry, logs };
}

export function createSubdomainCommand(): Command {
  const subdomain = new Command("subdomain")
    .description("Manage subdomains on ngx-ramblers.org.uk");

  subdomain
    .command("setup <environment>")
    .description("Setup DNS and certificate for an environment's subdomain")
    .action(async environment => {
      try {
        await setupSubdomainForEnvironment(environment);
      } catch (err: unknown) {
        if (err instanceof Error) logError(err.message);
        process.exit(1);
      }
    });

  subdomain
    .command("remove <environment>")
    .description("Remove DNS records for an environment's subdomain")
    .action(async environment => {
      try {
        await removeSubdomainForEnvironment(environment);
      } catch (err: unknown) {
        if (err instanceof Error) logError(err.message);
        process.exit(1);
      }
    });

  subdomain
    .command("status <environment>")
    .description("Check subdomain and certificate status")
    .action(async environment => {
      try {
        await checkSubdomainStatus(environment);
      } catch (err: unknown) {
        if (err instanceof Error) logError(err.message);
        process.exit(1);
      }
    });

  subdomain
    .command("apex-redirect <environment> <hostname>")
    .description("Redirect the apex/www sibling of a hostname to it via a Cloudflare edge 302")
    .action(async (environment, hostname) => {
      try {
        await setupApexRedirectForEnvironment(environment, hostname);
      } catch (err: unknown) {
        if (err instanceof Error) logError(err.message);
        process.exit(1);
      }
    });

  return subdomain;
}

async function reconcileCustomDomainDns(
  step: (msg: string) => void,
  environmentsConfig: EnvironmentsConfig,
  flyConfig: FlyConfig,
  zone: CloudflareZone | undefined,
  hostname: string,
  appName: string,
  ips: AppIpAddresses
): Promise<string | undefined> {
  if (!zone) {
    step(`  ✗ Zone not found in Cloudflare for ${hostname}`);
    return "Cloudflare zone not found — domain nameserver delegation may be incomplete";
  }
  step(`  ✓ Zone ${zone.name} (${zone.id})`);
  const cloudflareConfig: CloudflareDnsConfig = {
    apiToken: environmentsConfig.cloudflare.apiToken,
    zoneId: zone.id
  };
  const isApex = hostname === zone.name;
  const recordName = subdomainLabelForHostname(hostname, zone);

  step("Reconciling DNS records to point at Fly...");
  const existingRecords = await listDnsRecords(cloudflareConfig, hostname);
  if (isApex) {
    for (const stale of existingRecords.filter(record => record.type === "CNAME")) {
      await deleteDnsRecord(cloudflareConfig, stale.id);
      step(`  ✓ Removed stale CNAME ${hostname} -> ${stale.content} (apex needs A/AAAA)`);
    }
    await reconcileAddressRecord(step, cloudflareConfig, recordName, hostname, DnsRecordType.A, ips.ipv4, existingRecords);
    await reconcileAddressRecord(step, cloudflareConfig, recordName, hostname, DnsRecordType.AAAA, ips.ipv6, existingRecords);
  } else {
    for (const stale of existingRecords.filter(record => record.type === "A" || record.type === "AAAA")) {
      await deleteDnsRecord(cloudflareConfig, stale.id);
      step(`  ✓ Removed stale ${stale.type} ${hostname} -> ${stale.content} (subdomain uses CNAME)`);
    }
    await reconcileCnameRecord(step, cloudflareConfig, recordName, hostname, `${appName}.fly.dev`, existingRecords);
  }

  const certsPreview = await queryCertificates(flyConfig);
  const certPreview = certsPreview.find(item => item.hostname === hostname);
  if (certPreview) {
    await reconcileFlyValidationRecords(step, cloudflareConfig, zone, hostname, certPreview);
  }
  return undefined;
}

function classifyCertStatus(cert: CertificateInfo | undefined, dnsProblem: string | undefined): { status: CustomDomainStatus; message: string | undefined } {
  if (!cert) {
    return { status: CustomDomainStatus.FAILED, message: dnsProblem || "No Fly certificate found" };
  }
  if (cert.clientStatus?.toLowerCase() === "ready" && !dnsProblem) {
    return { status: CustomDomainStatus.ATTACHED, message: undefined };
  }
  return { status: CustomDomainStatus.PENDING, message: dnsProblem || "Fly is validating — DNS propagation usually takes 1–5 minutes" };
}
