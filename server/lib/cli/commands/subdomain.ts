import { Command } from "commander";
import debug from "debug";
import { log, error as logError } from "../cli-logger";
import { envConfig } from "../../env-config/env-config";
import { createDnsRecord, listDnsRecords, deleteDnsRecord, verifyToken, CloudflareConfig } from "../../cloudflare/cloudflare-dns";
import { appIpAddresses, addCertificate, getCertificates, FlyConfig } from "../../fly/fly-certificates";
import { findEnvironmentFromDatabase, getEnvironmentsConfig } from "../../environments/environments-config";

const debugLog = debug(envConfig.logNamespace("cli:subdomain"));

export async function setupSubdomainForEnvironment(environmentName: string): Promise<void> {
  log(`Setting up subdomain for environment: ${environmentName}`);

  const envConfig = await findEnvironmentFromDatabase(environmentName);
  if (!envConfig) {
    throw new Error(`Environment '${environmentName}' not found in database`);
  }

  const environmentsConfig = await getEnvironmentsConfig();
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
  const ips = await appIpAddresses(appName);
  if (!ips.ipv4 && !ips.ipv6) {
    throw new Error(`Could not resolve IP addresses for ${appName}.fly.dev`);
  }
  if (ips.ipv4) log(`   ✓ IPv4: ${ips.ipv4}`);
  if (ips.ipv6) log(`   ✓ IPv6: ${ips.ipv6}`);

  const cloudflareConfig: CloudflareConfig = {
    apiToken: environmentsConfig.cloudflare.apiToken,
    zoneId: environmentsConfig.cloudflare.zoneId
  };

  log("\n3. Checking existing DNS records...");
  const existingRecords = await listDnsRecords(cloudflareConfig, fullHostname);
  const existingA = existingRecords.find(r => r.type === "A");
  const existingAAAA = existingRecords.find(r => r.type === "AAAA");

  if (existingA) log(`   ⚠ A record exists: ${existingA.content}`);
  if (existingAAAA) log(`   ⚠ AAAA record exists: ${existingAAAA.content}`);

  log("\n4. Creating DNS records...");
  if (ips.ipv4 && !existingA) {
    await createDnsRecord(cloudflareConfig, { type: "A", name: subdomain, content: ips.ipv4 });
    log(`   ✓ A record created: ${subdomain} -> ${ips.ipv4}`);
  } else if (existingA) {
    log(`   - Skipping A record (already exists)`);
  }

  if (ips.ipv6 && !existingAAAA) {
    await createDnsRecord(cloudflareConfig, { type: "AAAA", name: subdomain, content: ips.ipv6 });
    log(`   ✓ AAAA record created: ${subdomain} -> ${ips.ipv6}`);
  } else if (existingAAAA) {
    log(`   - Skipping AAAA record (already exists)`);
  }

  log("\n5. Adding Fly.io certificate...");
  const flyConfig: FlyConfig = { apiToken: flyApiToken, appName };
  const certResult = await addCertificate(flyConfig, fullHostname);
  if (certResult) {
    log(`   ✓ Certificate added for ${fullHostname}`);
  } else {
    log(`   - Certificate already exists for ${fullHostname}`);
  }

  log("\n6. Verifying certificate status...");
  const certs = await getCertificates(flyConfig);
  const cert = certs.find(c => c.hostname === fullHostname);
  if (cert) {
    log(`   ✓ Status: ${cert.clientStatus}`);
    cert.issued.forEach(i => log(`   ✓ ${i.type} cert expires: ${i.expiresAt}`));
  }

  log(`\n✓ Subdomain setup complete: https://${fullHostname}`);
}

export async function removeSubdomainForEnvironment(environmentName: string): Promise<void> {
  log(`Removing subdomain for environment: ${environmentName}`);

  const environmentsConfig = await getEnvironmentsConfig();
  if (!environmentsConfig?.cloudflare?.apiToken || !environmentsConfig?.cloudflare?.zoneId) {
    throw new Error("Cloudflare not configured in environments config");
  }
  if (!environmentsConfig?.cloudflare?.baseDomain) {
    throw new Error("Cloudflare baseDomain not configured. Add cloudflare.baseDomain to environments config.");
  }

  const baseDomain = environmentsConfig.cloudflare.baseDomain;
  const fullHostname = `${environmentName}.${baseDomain}`;

  const cloudflareConfig: CloudflareConfig = {
    apiToken: environmentsConfig.cloudflare.apiToken,
    zoneId: environmentsConfig.cloudflare.zoneId
  };

  log("\n1. Finding DNS records...");
  const records = await listDnsRecords(cloudflareConfig, fullHostname);

  if (records.length === 0) {
    log("   No DNS records found");
  } else {
    log("\n2. Deleting DNS records...");
    for (const record of records) {
      await deleteDnsRecord(cloudflareConfig, record.id);
      log(`   ✓ Deleted ${record.type} record`);
    }
  }

  log(`\n✓ Subdomain removed: ${fullHostname}`);
}

export async function checkSubdomainStatus(environmentName: string): Promise<void> {
  const envConfig = await findEnvironmentFromDatabase(environmentName);
  if (!envConfig) {
    throw new Error(`Environment '${environmentName}' not found`);
  }

  const environmentsConfig = await getEnvironmentsConfig();
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
    const certs = await getCertificates(flyConfig);
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

export function createSubdomainCommand(): Command {
  const subdomain = new Command("subdomain")
    .description("Manage subdomains on ngx-ramblers.org.uk");

  subdomain
    .command("setup <environment>")
    .description("Setup DNS and certificate for an environment's subdomain")
    .action(async (environment) => {
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
    .action(async (environment) => {
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
    .action(async (environment) => {
      try {
        await checkSubdomainStatus(environment);
      } catch (err: unknown) {
        if (err instanceof Error) logError(err.message);
        process.exit(1);
      }
    });

  return subdomain;
}
