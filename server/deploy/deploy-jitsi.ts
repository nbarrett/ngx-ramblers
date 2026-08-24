import { dateTimeNowAsValue } from "../lib/shared/dates";
import crypto from "crypto";
import debug from "debug";
import fs from "fs";
import os from "os";
import path from "path";
import { entries } from "../../projects/ngx-ramblers/src/app/functions/object-utils";
import { envConfig } from "../lib/env-config/env-config";
import { Environment } from "../../projects/ngx-ramblers/src/app/models/environment.model";
import { configuredEnvironments } from "../lib/environments/environments-config";
import { FlyioMemory, FLYIO_DEFAULTS } from "../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { runCommand } from "../lib/fly/fly-commands";
import { autoDeployEnvFrom } from "./auto-deploy-target";

const debugLog = debug(envConfig.logNamespace("deploy-jitsi"));
debugLog.enabled = true;

const DEFAULT_MEMORY = FlyioMemory.MB_4096;

void deployJitsi().then(() => process.exit(0)).catch(error => {
  debugLog("Jitsi deployment failed:", error);
  process.exit(1);
});

async function deployJitsi(): Promise<void> {
  if (process.env[Environment.ADMIN_MONGODB_URI]) {
    process.env[Environment.MONGODB_URI] = process.env[Environment.ADMIN_MONGODB_URI];
  }

  const dbConfig = await configuredEnvironments();
  const jitsi = dbConfig?.jitsi;
  if (!jitsi?.appName) {
    throw new Error("No jitsi.appName in database. Populate Global Settings → Video Meetings first.");
  } else if (!jitsi.enabled) {
    debugLog(`Video meetings are disabled (jitsi.enabled is false) - skipping deploy of ${jitsi.appName}. Enable it in Global Settings → Video Meetings to deploy.`);
  } else {
    const flyApiKey = jitsi.apiKey || autoDeployEnvFrom(dbConfig)?.flyio?.apiKey;
    if (!flyApiKey) {
      throw new Error("No Fly API token available for Jitsi: set the Fly Deploy Token in Global Settings → Video Meetings, or configure the auto-deploy environment's Fly API key.");
    }
    process.env[Environment.FLY_API_TOKEN] = flyApiKey;
    const appName = jitsi.appName;
    const org = FLYIO_DEFAULTS.ORGANISATION;
    const memory = jitsi.memory || DEFAULT_MEMORY;
    const publicUrl = jitsi.hostUrl || `https://${appName}.fly.dev`;
    const flyTomlPath = path.resolve(__dirname, "../../fly.jitsi.toml");
    if (!fs.existsSync(flyTomlPath)) {
      throw new Error(`Jitsi Fly config not found at ${flyTomlPath}`);
    } else {
      ensureApp(appName, org);
      const advertiseIp = ensureDedicatedIpv4(appName);
      importJitsiSecrets(appName, dbConfig.secrets, {
        JWT_APP_ID: jitsi.jwtAppId,
        JWT_APP_SECRET: jitsi.jwtAppSecret,
        PUBLIC_URL: publicUrl,
        JVB_ADVERTISE_IPS: advertiseIp,
        DOCKER_HOST_ADDRESS: advertiseIp,
        JICOFO_COMPONENT_SECRET: internalComponentSecret(jitsi.jwtAppSecret, "jicofo-component"),
        JICOFO_AUTH_PASSWORD: internalComponentSecret(jitsi.jwtAppSecret, "jicofo-auth"),
        JVB_AUTH_PASSWORD: internalComponentSecret(jitsi.jwtAppSecret, "jvb-auth")
      });
      runCommand(`flyctl config validate --config ${flyTomlPath} --app ${appName}`);
      runCommand(`flyctl deploy --app ${appName} --config ${flyTomlPath} --strategy immediate --ha=false --wait-timeout 600`);
      runCommand(`flyctl scale memory ${memory} --app ${appName}`);
      runCommand(`flyctl scale count 1 --app ${appName} --yes`);
      debugLog(`Deployed self-hosted Jitsi ${appName} (public ${publicUrl}, media IP ${advertiseIp || "unset"}) - pinned to a single machine`);
    }
  }
}

function internalComponentSecret(base: string, purpose: string): string {
  return crypto.createHash("sha256").update(`${base || "ngx-ramblers-jitsi"}:${purpose}`).digest("hex");
}

function ensureApp(appName: string, org: string): void {
  let exists = false;
  try {
    const listed = runCommand("flyctl apps list --json", true);
    const apps: { Name?: string; name?: string }[] = JSON.parse(listed || "[]");
    exists = apps.some(app => (app.Name || app.name) === appName);
  } catch (error) {
    debugLog("Could not list Fly apps, will attempt to create:", error);
  }
  if (exists) {
    debugLog(`Fly app ${appName} already exists`);
  } else {
    debugLog(`Creating Fly app ${appName} in org ${org}`);
    runCommand(`flyctl apps create ${appName} --org ${org}`);
  }
}

function ensureDedicatedIpv4(appName: string): string {
  const existing = dedicatedIpv4(appName);
  let advertiseIp: string;
  if (existing) {
    debugLog(`Dedicated IPv4 already allocated for ${appName}: ${existing}`);
    advertiseIp = existing;
  } else {
    debugLog(`Allocating a dedicated IPv4 for ${appName} (needed for the video bridge)`);
    runCommand(`flyctl ips allocate-v4 --app ${appName} --yes`);
    const allocated = dedicatedIpv4(appName);
    if (!allocated) {
      debugLog(`Warning: could not read back a dedicated IPv4 for ${appName}; JVB_ADVERTISE_IPS will be unset`);
    }
    advertiseIp = allocated || "";
  }
  return advertiseIp;
}

function dedicatedIpv4(appName: string): string {
  try {
    const output = runCommand(`flyctl ips list --app ${appName} --json`, true);
    const ips: { Type?: string; type?: string; Address?: string; address?: string }[] = JSON.parse(output || "[]");
    const v4 = ips.find(ip => (ip.Type || ip.type || "").toLowerCase() === "v4");
    return v4 ? (v4.Address || v4.address || "") : "";
  } catch (error) {
    debugLog(`Could not read IPs for ${appName}:`, error);
    return "";
  }
}

function importJitsiSecrets(
  appName: string,
  globalSecrets: Record<string, string> | undefined,
  jitsiSecrets: Record<string, string | undefined>
): void {
  const secrets: Record<string, string> = {};

  if (globalSecrets) {
    entries(globalSecrets).forEach(([key, value]) => {
      if (value) {
        secrets[key] = value;
      }
    });
  }

  entries(jitsiSecrets).forEach(([key, value]) => {
    if (value) {
      secrets[key] = value;
    }
  });

  if (entries(secrets).length === 0) {
    debugLog("No secrets to import for Jitsi app");
  } else {
    const tempFile = path.join(os.tmpdir(), `jitsi-secrets-${dateTimeNowAsValue()}.env`);
    const lines = entries(secrets).map(([key, value]) => `${key}=${value}`);
    try {
      fs.writeFileSync(tempFile, lines.join("\n"), { encoding: "utf-8" });
      runCommand(`flyctl secrets import --app ${appName} < ${tempFile}`);
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  }
}
