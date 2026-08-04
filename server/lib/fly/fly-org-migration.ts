import debug from "debug";
import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { envConfig } from "../env-config/env-config";
import {
  findEnvironmentFromDatabase,
  upsertEnvironmentInDatabase,
  environmentsConfigFromDatabase
} from "../environments/environments-config";
import { flyTomlAbsolutePath, runCommand, runCommandStreaming } from "./fly-commands";
import { resolveSecretsForDeploy, writeSecretsFile } from "../shared/secrets";
import { normaliseMemory } from "../shared/spelling";
import { dateTimeNowAsValue } from "../shared/dates";
import { DEPLOYMENT_DEFAULTS } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import {
  FlyOrgMigrationPhase,
  FlyOrgMigrationStatus,
  SetupStepStatus
} from "../../../projects/ngx-ramblers/src/app/models/environment-setup.model";
import { addCustomDomainForEnvironment, setupSubdomainForEnvironment } from "../cli/commands/subdomain";
import { baseDomainFrom } from "../environment-setup/environment-context";
import { appIpAddresses, queryCertificates } from "./fly-certificates";

const debugLog = debug(envConfig.logNamespace("fly-org-migration"));
debugLog.enabled = true;

export type FlyOrgMigrateProgress = (message: string, status?: SetupStepStatus) => void;

export interface FlyOrgMigrateOptions {
  destroyOldApp?: boolean;
  reattachSubdomain?: boolean;
  previousApiKey?: string;
  previousOrganisation?: string;
  previousAppName?: string;
  newApiKey?: string;
  newOrganisation?: string;
  newAppName?: string;
  onDeployOutput?: (line: string) => void;
}

export interface FlyOrgMigrateResult {
  success: boolean;
  environmentName: string;
  appName: string;
  appUrl: string;
  oldAppDestroyed: boolean;
  usedTemporaryAppName: boolean;
  temporaryAppName?: string;
  messages: string[];
}

export interface FlyOrgMigrationProbeInput {
  environmentName: string;
  previousApiKey?: string;
  previousOrganisation?: string;
  previousAppName?: string;
  newApiKey?: string;
  newOrganisation?: string;
  newAppName?: string;
}

function setFlyApiToken(apiKey?: string): void {
  if (apiKey) {
    process.env.FLY_API_TOKEN = apiKey;
  }
}

function appExistsWithToken(appName: string, apiKey: string): boolean {
  if (!appName || !apiKey) {
    return false;
  } else {
    try {
      execSync(`flyctl scale show --app ${appName} --json`, {
        stdio: "pipe",
        encoding: "utf-8",
        env: { ...process.env, FLY_API_TOKEN: apiKey }
      });
      return true;
    } catch {
      return false;
    }
  }
}

async function appDeployedWithToken(appName: string, apiKey: string): Promise<boolean> {
  if (!appName || !apiKey) {
    return false;
  } else {
    try {
      const ips = await appIpAddresses({ apiToken: apiKey, appName });
      return !!(ips.ipv4 || ips.ipv6);
    } catch {
      return false;
    }
  }
}

function appNameTakenError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.message} ${(error as any).stderr || ""}` : String(error);
  return /already been taken|already exists|Name is already taken|is not available/i.test(message);
}

function destroyFlyApp(appName: string, apiKey: string, report: FlyOrgMigrateProgress): boolean {
  try {
    setFlyApiToken(apiKey);
    runCommand(`flyctl apps destroy ${appName} --yes`, true);
    report(`Destroyed Fly app ${appName}`, SetupStepStatus.Completed);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const alreadyGone = /Could not find App|could not find app|not found/i.test(message);
    if (alreadyGone) {
      report(`Fly app ${appName} already absent`, SetupStepStatus.Completed);
    } else {
      report(`Failed to destroy Fly app ${appName}: ${message}`, SetupStepStatus.Failed);
    }
    return alreadyGone;
  }
}

async function publicHostLooksHealthy(url: string, report: FlyOrgMigrateProgress): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal });
      const ok = response.status >= 200 && response.status < 500;
      report(`Health check ${url} → HTTP ${response.status}`, ok ? SetupStepStatus.Completed : SetupStepStatus.Failed);
      return ok;
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    report(`Health check failed for ${url}: ${message}`, SetupStepStatus.Failed);
    return false;
  }
}

async function importSecretsAndDeploy(
  appName: string,
  secrets: Record<string, string>,
  flyTomlPath: string,
  dockerImage: string,
  memory: string,
  scaleCount: number,
  options: FlyOrgMigrateOptions,
  report: FlyOrgMigrateProgress,
  skipDeployIfAlreadyLive: boolean,
  apiKey: string
): Promise<void> {
  const alreadyDeployed = skipDeployIfAlreadyLive ? await appDeployedWithToken(appName, apiKey) : false;
  setFlyApiToken(apiKey);
  if (alreadyDeployed) {
    report(
      `App ${appName} already deployed under destination token — skipping secrets import and redeploy (avoids machine restart)`,
      SetupStepStatus.Completed
    );
  } else {
    report(`Importing secrets to ${appName}`);
    const tempSecretsPath = path.join(os.tmpdir(), `secrets-migrate-${appName}-${dateTimeNowAsValue()}.env`);
    try {
      writeSecretsFile(tempSecretsPath, secrets);
      runCommand(`flyctl secrets import --app ${appName} < ${tempSecretsPath}`);
    } finally {
      if (fs.existsSync(tempSecretsPath)) {
        fs.unlinkSync(tempSecretsPath);
      }
    }
    report(`Deploying image to ${appName}`);
    const deployCommand =
      `flyctl deploy --app ${appName} --config ${flyTomlPath} --image ${dockerImage} --strategy rolling --wait-timeout 600`;
    if (options.onDeployOutput) {
      await runCommandStreaming(deployCommand, options.onDeployOutput);
    } else {
      runCommand(deployCommand);
    }
    report(`Scaling ${appName}`);
    runCommand(`flyctl scale count ${scaleCount} --app ${appName} --yes`);
    runCommand(`flyctl scale memory ${memory} --app ${appName}`);
    report(`Deployed ${appName}`, SetupStepStatus.Completed);
  }
}

async function finalisePreferredAppConfig(
  environmentName: string,
  preferredAppName: string,
  newApiKey: string,
  newOrg: string,
  memory: string,
  scaleCount: number,
  report: FlyOrgMigrateProgress
): Promise<void> {
  await upsertEnvironmentInDatabase({
    environment: environmentName,
    flyio: {
      apiKey: newApiKey,
      appName: preferredAppName,
      memory,
      scaleCount,
      organisation: newOrg,
      previous: null
    } as any
  });
  report("Cleared previous Fly credentials after successful cutover", SetupStepStatus.Completed);
}

function hostnameFromHref(href: string | undefined): string | null {
  if (!href) {
    return null;
  } else {
    try {
      const withScheme = /^https?:\/\//i.test(href) ? href : `https://${href}`;
      const host = new URL(withScheme).hostname.toLowerCase();
      return host || null;
    } catch {
      return null;
    }
  }
}

async function groupHrefForEnvironment(environmentName: string): Promise<string | null> {
  try {
    const env = await findEnvironmentFromDatabase(environmentName);
    if (!env?.mongo?.cluster || !env.mongo?.db) {
      return null;
    } else {
      const { buildMongoUri } = await import("../shared/mongodb-uri");
      const { connectToDatabase } = await import("../environment-setup/database-initialiser");
      const mongoUri = buildMongoUri({
        cluster: env.mongo.cluster,
        username: env.mongo.username || "",
        password: env.mongo.password || "",
        database: env.mongo.db
      });
      const { client, db } = await connectToDatabase({ uri: mongoUri, database: env.mongo.db });
      try {
        const systemDoc = await db.collection("config").findOne({ key: "system" });
        const href = String(systemDoc?.value?.group?.href || "").trim();
        return href || null;
      } finally {
        await client.close();
      }
    }
  } catch {
    return null;
  }
}

async function publicAppUrlForEnvironment(
  environmentName: string,
  freeHostFallback: string
): Promise<string> {
  const href = await groupHrefForEnvironment(environmentName);
  if (href) {
    return href.replace(/\/$/, "");
  } else {
    return freeHostFallback;
  }
}

async function customDomainHostnamesForEnvironment(
  environmentName: string,
  freeBaseDomain: string
): Promise<string[]> {
  const environmentsConfig = await environmentsConfigFromDatabase();
  const rawEnv = (environmentsConfig?.environments || []).find(item => item.environment === environmentName);
  const freeHost = `${environmentName}.${freeBaseDomain}`.toLowerCase();
  const fromConfig = (rawEnv?.customDomains || [])
    .map(entry => (entry.hostname || "").toLowerCase().trim())
    .filter(hostname => !!hostname);
  const hrefHost = hostnameFromHref(await groupHrefForEnvironment(environmentName) || undefined);
  const candidates = [...fromConfig, hrefHost].filter((hostname): hostname is string => !!hostname);
  const unique = candidates.filter((hostname, index) => candidates.indexOf(hostname) === index);
  return unique.filter(hostname =>
    hostname !== freeHost &&
    !hostname.endsWith(".fly.dev") &&
    !hostname.endsWith(`.${freeBaseDomain}`)
  );
}

async function customDomainsNeedReattach(
  hostnames: string[],
  preferredAppName: string,
  newApiKey: string
): Promise<boolean> {
  if (hostnames.length === 0 || !preferredAppName || !newApiKey) {
    return false;
  } else {
    try {
      const certs = await queryCertificates({ apiToken: newApiKey, appName: preferredAppName });
      const covered = hostnames.every(hostname =>
        certs.some(cert => (cert.hostname || "").toLowerCase() === hostname)
      );
      return !covered;
    } catch {
      return true;
    }
  }
}

async function reattachCustomDomainsForEnvironment(
  environmentName: string,
  freeBaseDomain: string,
  report: FlyOrgMigrateProgress
): Promise<void> {
  const hostnames = await customDomainHostnamesForEnvironment(environmentName, freeBaseDomain);
  if (hostnames.length === 0) {
    report("No custom domains or custom Site URL host to re-point");
  } else {
    report(`Re-pointing custom domain DNS/SSL on destination app: ${hostnames.join(", ")}`);
    await hostnames.reduce(async (previous, hostname) => {
      await previous;
      try {
        report(`Re-attaching custom domain ${hostname}`);
        const result = await addCustomDomainForEnvironment(environmentName, hostname);
        (result.logs || []).forEach(line => report(`  ${line}`));
        report(`Custom domain ${hostname} re-attached`, SetupStepStatus.Completed);
      } catch (error) {
        report(
          `Custom domain ${hostname} failed: ${error instanceof Error ? error.message : String(error)}`,
          SetupStepStatus.Failed
        );
      }
    }, Promise.resolve());
  }
}

async function cleanupCutoverAndFinalise(input: {
  environmentName: string;
  preferredAppName: string;
  cutoverAppName: string;
  newApiKey: string;
  newOrg: string;
  memory: string;
  scaleCount: number;
  reattachSubdomain: boolean;
  report: FlyOrgMigrateProgress;
}): Promise<void> {
  const {
    environmentName,
    preferredAppName,
    cutoverAppName,
    newApiKey,
    newOrg,
    memory,
    scaleCount,
    reattachSubdomain,
    report
  } = input;
  setFlyApiToken(newApiKey);
  await upsertEnvironmentInDatabase({
    environment: environmentName,
    flyio: {
      apiKey: newApiKey,
      appName: preferredAppName,
      memory,
      scaleCount,
      organisation: newOrg
    }
  });
  report(`Config points at preferred app ${preferredAppName}`);
  if (reattachSubdomain) {
    try {
      report("Re-attaching free NGX subdomain / SSL to preferred app (does not change custom Site URL)");
      await setupSubdomainForEnvironment(environmentName);
      report("Subdomain setup completed", SetupStepStatus.Completed);
    } catch (error) {
      report(
        `Subdomain setup warning: ${error instanceof Error ? error.message : String(error)} — continue and verify DNS manually`,
        SetupStepStatus.Failed
      );
    }
  }
  if (appExistsWithToken(cutoverAppName, newApiKey)) {
    report(`Destroying temporary cutover app ${cutoverAppName}`);
    destroyFlyApp(cutoverAppName, newApiKey, report);
  } else {
    report(`Temporary cutover app ${cutoverAppName} already absent`, SetupStepStatus.Completed);
  }
  await finalisePreferredAppConfig(environmentName, preferredAppName, newApiKey, newOrg, memory, scaleCount, report);
  const environmentsConfig = await environmentsConfigFromDatabase();
  const freeBaseDomain = environmentsConfig ? baseDomainFrom(environmentsConfig) : "ngx-ramblers.org.uk";
  await reattachCustomDomainsForEnvironment(environmentName, freeBaseDomain, report);
}

function derivePhase(input: {
  preferredExistsUnderNew: boolean;
  preferredDeployedUnderNew: boolean;
  cutoverExistsUnderNew: boolean;
  sourceExistsUnderOld: boolean;
  configAppName: string;
  preferredAppName: string;
  cutoverAppName: string;
  hasPreviousCredentials: boolean;
}): FlyOrgMigrationPhase {
  const {
    preferredExistsUnderNew,
    preferredDeployedUnderNew,
    cutoverExistsUnderNew,
    sourceExistsUnderOld,
    configAppName,
    preferredAppName,
    hasPreviousCredentials
  } = input;
  if (
    preferredExistsUnderNew &&
    preferredDeployedUnderNew &&
    !cutoverExistsUnderNew &&
    !sourceExistsUnderOld &&
    configAppName === preferredAppName &&
    !hasPreviousCredentials
  ) {
    return FlyOrgMigrationPhase.COMPLETE;
  } else if (preferredExistsUnderNew && cutoverExistsUnderNew) {
    return FlyOrgMigrationPhase.RENAME_IN_PROGRESS;
  } else if (cutoverExistsUnderNew && (sourceExistsUnderOld || !preferredExistsUnderNew)) {
    return FlyOrgMigrationPhase.CUTOVER_LIVE;
  } else if (preferredExistsUnderNew && preferredDeployedUnderNew && hasPreviousCredentials) {
    return FlyOrgMigrationPhase.RENAME_IN_PROGRESS;
  } else if (preferredExistsUnderNew || cutoverExistsUnderNew || hasPreviousCredentials) {
    return FlyOrgMigrationPhase.PARTIAL;
  } else {
    return FlyOrgMigrationPhase.NOT_STARTED;
  }
}

export async function probeFlyOrgMigrationStatus(
  input: FlyOrgMigrationProbeInput
): Promise<FlyOrgMigrationStatus> {
  const environmentName = input.environmentName;
  const environmentsConfig = await environmentsConfigFromDatabase();
  const rawEnv = (environmentsConfig?.environments || []).find(item => item.environment === environmentName);
  if (!rawEnv) {
    throw new Error(`Environment ${environmentName} not found`);
  }

  const preferredAppName = input.newAppName || rawEnv.flyio?.appName || `ngx-ramblers-${environmentName}`;
  const cutoverAppName = `${preferredAppName}-cutover`;
  const previousApiKey = input.previousApiKey || rawEnv.flyio?.previous?.apiKey || "";
  const previousOrganisation = input.previousOrganisation || rawEnv.flyio?.previous?.organisation || "personal";
  const previousAppName = input.previousAppName || rawEnv.flyio?.previous?.appName || preferredAppName;
  const newApiKey = input.newApiKey || rawEnv.flyio?.apiKey || "";
  const newOrganisation = input.newOrganisation || rawEnv.flyio?.organisation || "personal";
  const configAppName = rawEnv.flyio?.appName || preferredAppName;
  const hasPreviousCredentials = !!(rawEnv.flyio?.previous?.apiKey || input.previousApiKey);

  const preferredExistsUnderNew = appExistsWithToken(preferredAppName, newApiKey);
  const cutoverExistsUnderNew = appExistsWithToken(cutoverAppName, newApiKey);
  const sourceExistsUnderOld = appExistsWithToken(previousAppName, previousApiKey);
  const preferredDeployedUnderNew = preferredExistsUnderNew
    ? await appDeployedWithToken(preferredAppName, newApiKey)
    : false;
  const cutoverDeployedUnderNew = cutoverExistsUnderNew
    ? await appDeployedWithToken(cutoverAppName, newApiKey)
    : false;

  const freeBaseDomain = environmentsConfig ? baseDomainFrom(environmentsConfig) : "ngx-ramblers.org.uk";
  const customDomainHostnames = await customDomainHostnamesForEnvironment(environmentName, freeBaseDomain);
  const needsCustomDomainReattach = preferredDeployedUnderNew
    ? await customDomainsNeedReattach(customDomainHostnames, preferredAppName, newApiKey)
    : customDomainHostnames.length > 0;

  const basePhase = derivePhase({
    preferredExistsUnderNew,
    preferredDeployedUnderNew,
    cutoverExistsUnderNew,
    sourceExistsUnderOld,
    configAppName,
    preferredAppName,
    cutoverAppName,
    hasPreviousCredentials
  });
  const phase =
    basePhase === FlyOrgMigrationPhase.COMPLETE && needsCustomDomainReattach
      ? FlyOrgMigrationPhase.PARTIAL
      : basePhase;

  const configPointsAtPreferred = configAppName === preferredAppName;
  const configPointsAtCutover = configAppName === cutoverAppName;
  const needsPreferredApp = !preferredExistsUnderNew;
  const needsPreferredDeploy = preferredExistsUnderNew && !preferredDeployedUnderNew;
  const needsCutoverCleanup = cutoverExistsUnderNew && preferredDeployedUnderNew;
  const needsSourceDestroy = sourceExistsUnderOld && (preferredDeployedUnderNew || cutoverDeployedUnderNew);
  const needsConfigFinalise =
    phase !== FlyOrgMigrationPhase.COMPLETE &&
    (hasPreviousCredentials || configPointsAtCutover || !configPointsAtPreferred);
  const needsSubdomainOnPreferred =
    preferredDeployedUnderNew && (cutoverExistsUnderNew || configPointsAtCutover || hasPreviousCredentials);

  const resumeAvailable =
    [
      FlyOrgMigrationPhase.CUTOVER_LIVE,
      FlyOrgMigrationPhase.RENAME_IN_PROGRESS,
      FlyOrgMigrationPhase.PARTIAL
    ].includes(phase) || needsCustomDomainReattach;

  const summaryByPhase: Record<FlyOrgMigrationPhase, string> = {
    [FlyOrgMigrationPhase.NOT_STARTED]: "No cutover in progress — ready to start a full move.",
    [FlyOrgMigrationPhase.CUTOVER_LIVE]:
      "Temporary cutover app is live under the destination token; preferred name may still be held by the source.",
    [FlyOrgMigrationPhase.RENAME_IN_PROGRESS]:
      "Preferred name exists under the destination token and a temporary cutover app (or previous credentials) remain — resume to finish rename cleanup.",
    [FlyOrgMigrationPhase.PARTIAL]: needsCustomDomainReattach
      ? `Preferred app is live but custom domain DNS/SSL still needs re-pointing (${customDomainHostnames.join(", ")}).`
      : "Cutover partially applied — probe remaining steps and resume.",
    [FlyOrgMigrationPhase.COMPLETE]: "Preferred app is on the destination organisation and cutover cleanup is complete."
  };

  return {
    environmentName,
    phase,
    preferredAppName,
    cutoverAppName,
    previousAppName,
    previousOrganisation,
    newOrganisation,
    preferredExistsUnderNew,
    preferredDeployedUnderNew,
    cutoverExistsUnderNew,
    cutoverDeployedUnderNew,
    sourceExistsUnderOld,
    configAppName,
    configPointsAtPreferred,
    configPointsAtCutover,
    hasPreviousCredentials,
    needsPreferredApp,
    needsPreferredDeploy,
    needsCutoverCleanup,
    needsSourceDestroy,
    needsSubdomainOnPreferred,
    needsConfigFinalise,
    customDomainHostnames,
    needsCustomDomainReattach,
    resumeAvailable,
    summary: summaryByPhase[phase]
  };
}

export async function migrateFlyOrganisation(
  environmentName: string,
  options: FlyOrgMigrateOptions = {},
  onProgress?: FlyOrgMigrateProgress
): Promise<FlyOrgMigrateResult> {
  const messages: string[] = [];
  const report: FlyOrgMigrateProgress = (message, status = SetupStepStatus.Running) => {
    debugLog(`[${status}] ${message}`);
    messages.push(message);
    if (onProgress) {
      onProgress(message, status);
    }
  };

  const destroyOldApp = options.destroyOldApp !== false;
  const reattachSubdomain = options.reattachSubdomain === true;

  report(`Starting Fly organisation migration for ${environmentName}`);

  const env = await findEnvironmentFromDatabase(environmentName);
  if (!env) {
    throw new Error(`Environment ${environmentName} not found`);
  }

  const environmentsConfig = await environmentsConfigFromDatabase();
  const rawEnv = (environmentsConfig?.environments || []).find(item => item.environment === environmentName);
  const storedPrevious = rawEnv?.flyio?.previous;

  const preferredAppName = options.newAppName || env.appName || `ngx-ramblers-${environmentName}`;
  const cutoverAppName = `${preferredAppName}-cutover`;
  const memory = normaliseMemory(env.memory || "512mb");
  const scaleCount = env.scaleCount || 1;

  const newApiKey = options.newApiKey || env.apiKey || "";
  const newOrg = options.newOrganisation || env.organisation || "personal";
  const previousApiKeyFromStore = options.previousApiKey || storedPrevious?.apiKey || "";
  const previousOrg = options.previousOrganisation || storedPrevious?.organisation || env.organisation || "personal";
  const previousAppName = options.previousAppName || storedPrevious?.appName || preferredAppName;

  if (!newApiKey) {
    throw new Error(
      "Destination Fly API token is required. Enter it under New credentials, or save it on this environment in Settings."
    );
  }

  const probePreviousApiKey = previousApiKeyFromStore || newApiKey;
  const initialStatus = await probeFlyOrgMigrationStatus({
    environmentName,
    previousApiKey: probePreviousApiKey,
    previousOrganisation: previousOrg,
    previousAppName,
    newApiKey,
    newOrganisation: newOrg,
    newAppName: preferredAppName
  });
  report(`Detected cutover phase: ${initialStatus.phase} — ${initialStatus.summary}`);

  const resumeWithoutSourceToken =
    initialStatus.preferredDeployedUnderNew &&
    !initialStatus.sourceExistsUnderOld &&
    (initialStatus.cutoverExistsUnderNew ||
      initialStatus.needsCustomDomainReattach ||
      initialStatus.needsConfigFinalise ||
      initialStatus.resumeAvailable);

  const previousApiKey = previousApiKeyFromStore || (resumeWithoutSourceToken ? newApiKey : "");
  if (!previousApiKey && !resumeWithoutSourceToken) {
    throw new Error(
      "Source Fly API token is required to start a cutover. Enter it under Old credentials (the token that currently owns the app)."
    );
  }
  if (
    previousApiKey === newApiKey &&
    previousOrg === newOrg &&
    !initialStatus.resumeAvailable &&
    initialStatus.phase !== FlyOrgMigrationPhase.COMPLETE
  ) {
    throw new Error("Previous and new Fly credentials are the same — nothing to migrate.");
  }

  const baseDomainEarly = environmentsConfig ? baseDomainFrom(environmentsConfig) : "ngx-ramblers.org.uk";
  const freeHostEarly = `https://${environmentName}.${baseDomainEarly}`;
  let result: FlyOrgMigrateResult = {
    success: true,
    environmentName,
    appName: preferredAppName,
    appUrl: await publicAppUrlForEnvironment(environmentName, freeHostEarly),
    oldAppDestroyed: !initialStatus.sourceExistsUnderOld,
    usedTemporaryAppName: false,
    messages
  };

  if (initialStatus.phase === FlyOrgMigrationPhase.COMPLETE && !initialStatus.needsCustomDomainReattach) {
    report("Cutover already complete — nothing further to do", SetupStepStatus.Completed);
  } else if (
    initialStatus.preferredDeployedUnderNew &&
    !initialStatus.sourceExistsUnderOld &&
    (initialStatus.cutoverExistsUnderNew ||
      initialStatus.needsCustomDomainReattach ||
      initialStatus.needsConfigFinalise)
  ) {
    report(
      initialStatus.cutoverExistsUnderNew
        ? "Resume cleanup: preferred app is live; finishing cutover destroy, config finalise, and custom domain re-point"
        : "Resume cleanup: preferred app is live; re-pointing custom domain DNS/SSL on the destination app"
    );
    setFlyApiToken(newApiKey);
    try {
      const whoami = runCommand("flyctl auth whoami", true).trim();
      report(`Authenticated to Fly as: ${whoami}`);
    } catch (error) {
      throw new Error(`New Fly token authentication failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    await cleanupCutoverAndFinalise({
      environmentName,
      preferredAppName,
      cutoverAppName,
      newApiKey,
      newOrg,
      memory,
      scaleCount,
      reattachSubdomain,
      report
    });
    const baseDomain = environmentsConfig ? baseDomainFrom(environmentsConfig) : "ngx-ramblers.org.uk";
    const freeHost = `https://${environmentName}.${baseDomain}`;
    const appUrl = await publicAppUrlForEnvironment(environmentName, freeHost);
    report(`Fly organisation migration finished for ${environmentName} (app ${preferredAppName})`, SetupStepStatus.Completed);
    result = {
      success: true,
      environmentName,
      appName: preferredAppName,
      appUrl,
      oldAppDestroyed: true,
      usedTemporaryAppName: false,
      temporaryAppName: cutoverAppName,
      messages
    };
  } else {
    if (options.newApiKey || options.newOrganisation || options.previousApiKey) {
      const configAppName =
        initialStatus.preferredExistsUnderNew
          ? preferredAppName
          : initialStatus.cutoverExistsUnderNew
            ? cutoverAppName
            : preferredAppName;
      await upsertEnvironmentInDatabase({
        environment: environmentName,
        flyio: {
          apiKey: newApiKey,
          appName: configAppName,
          memory,
          scaleCount,
          organisation: newOrg,
          previous: {
            apiKey: previousApiKey,
            organisation: previousOrg,
            appName: previousAppName,
            capturedAt: dateTimeNowAsValue()
          }
        }
      });
      report("Saved Fly credentials for cutover");
    }

    report(`New org: ${newOrg}, preferred app: ${preferredAppName}`);
    report(`Previous org: ${previousOrg}, previous app: ${previousAppName}`);

    setFlyApiToken(newApiKey);
    try {
      const whoami = runCommand("flyctl auth whoami", true).trim();
      report(`Authenticated to Fly as: ${whoami}`);
    } catch (error) {
      throw new Error(`New Fly token authentication failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    report("Resolving app secrets for cutover (same path as CLI start)");
    const secrets = await resolveSecretsForDeploy(
      environmentName,
      previousAppName,
      previousApiKey,
      message => report(message)
    );
    report("Secrets ready for cutover", SetupStepStatus.Completed);

    const dockerImage = environmentsConfig?.dockerImage || DEPLOYMENT_DEFAULTS.DOCKER_IMAGE;
    const flyTomlPath = flyTomlAbsolutePath();
    if (!fs.existsSync(flyTomlPath)) {
      throw new Error(`fly.toml not found at ${flyTomlPath}`);
    }

    let workingAppName = preferredAppName;
    let usedTemporaryAppName = false;
    let temporaryAppName: string | undefined;

    if (initialStatus.preferredExistsUnderNew) {
      workingAppName = preferredAppName;
      usedTemporaryAppName = false;
      report(`Preferred app ${preferredAppName} already exists under destination token`);
    } else if (initialStatus.cutoverExistsUnderNew) {
      workingAppName = cutoverAppName;
      usedTemporaryAppName = true;
      temporaryAppName = cutoverAppName;
      report(`Resuming from temporary cutover app ${cutoverAppName}`);
    } else {
      try {
        report(`Creating app ${preferredAppName} in org ${newOrg}`);
        setFlyApiToken(newApiKey);
        runCommand(`flyctl apps create ${preferredAppName} --org ${newOrg}`, true);
        report(`Created ${preferredAppName}`, SetupStepStatus.Completed);
        workingAppName = preferredAppName;
      } catch (error) {
        if (appNameTakenError(error)) {
          temporaryAppName = cutoverAppName;
          usedTemporaryAppName = true;
          workingAppName = temporaryAppName;
          report(
            `Name ${preferredAppName} is still held (likely by the old org). Using temporary app ${temporaryAppName}`,
            SetupStepStatus.Running
          );
          if (!appExistsWithToken(temporaryAppName, newApiKey)) {
            setFlyApiToken(newApiKey);
            runCommand(`flyctl apps create ${temporaryAppName} --org ${newOrg}`, true);
            report(`Created temporary app ${temporaryAppName}`, SetupStepStatus.Completed);
          } else {
            report(`Temporary app ${temporaryAppName} already exists`, SetupStepStatus.Completed);
          }
        } else {
          throw error;
        }
      }
    }

    await importSecretsAndDeploy(
      workingAppName,
      secrets,
      flyTomlPath,
      dockerImage,
      memory,
      scaleCount,
      options,
      report,
      true,
      newApiKey
    );

    await upsertEnvironmentInDatabase({
      environment: environmentName,
      flyio: {
        apiKey: newApiKey,
        appName: workingAppName,
        memory,
        scaleCount,
        organisation: newOrg,
        previous: {
          apiKey: previousApiKey,
          organisation: previousOrg,
          appName: previousAppName
        }
      }
    });
    report(`Updated environment config to use app ${workingAppName}`);

    if (reattachSubdomain) {
      try {
        report("Re-attaching subdomain / SSL to the working app");
        await setupSubdomainForEnvironment(environmentName);
        report("Subdomain setup completed", SetupStepStatus.Completed);
      } catch (error) {
        report(
          `Subdomain setup warning: ${error instanceof Error ? error.message : String(error)} — continue and verify DNS manually`,
          SetupStepStatus.Failed
        );
      }
    }

    const baseDomain = environmentsConfig ? baseDomainFrom(environmentsConfig) : "ngx-ramblers.org.uk";
    const publicUrl = `https://${environmentName}.${baseDomain}`;
    const flyDevUrl = `https://${workingAppName}.fly.dev`;
    const publicHealthy = await publicHostLooksHealthy(publicUrl, report);
    if (!publicHealthy) {
      await publicHostLooksHealthy(flyDevUrl, report);
    }

    let oldAppDestroyed = !appExistsWithToken(previousAppName, previousApiKey);
    if (destroyOldApp) {
      if (previousAppName === workingAppName && !usedTemporaryAppName) {
        report("Previous and working app names match and app is in the new account — skip destroy of previous name");
        oldAppDestroyed = true;
      } else if (oldAppDestroyed) {
        report(`Source app ${previousAppName} already absent under previous token`, SetupStepStatus.Completed);
      } else {
        report(`Destroying previous app ${previousAppName} in old organisation ${previousOrg}`);
        oldAppDestroyed = destroyFlyApp(previousAppName, previousApiKey, report);
      }
    } else {
      report("Skipping destroy of previous app (destroyOldApp=false)");
    }

    const cutoverStillPresent = appExistsWithToken(cutoverAppName, newApiKey);
    const preferredUnderNew = appExistsWithToken(preferredAppName, newApiKey);
    const shouldFinishRename =
      (usedTemporaryAppName || cutoverStillPresent) &&
      oldAppDestroyed &&
      (temporaryAppName || cutoverStillPresent);

    if (shouldFinishRename) {
      const cutoverName = temporaryAppName || cutoverAppName;
      report(`Finishing rename to preferred app ${preferredAppName}`);
      setFlyApiToken(newApiKey);
      if (!preferredUnderNew) {
        runCommand(`flyctl apps create ${preferredAppName} --org ${newOrg}`, true);
        report(`Created ${preferredAppName}`, SetupStepStatus.Completed);
      } else {
        report(`Preferred app ${preferredAppName} already exists under destination token`);
      }
      await importSecretsAndDeploy(
        preferredAppName,
        secrets,
        flyTomlPath,
        dockerImage,
        memory,
        scaleCount,
        options,
        report,
        true,
        newApiKey
      );
      workingAppName = preferredAppName;
      usedTemporaryAppName = false;
      await upsertEnvironmentInDatabase({
        environment: environmentName,
        flyio: {
          apiKey: newApiKey,
          appName: preferredAppName,
          memory,
          scaleCount,
          organisation: newOrg,
          previous: {
            apiKey: previousApiKey,
            organisation: previousOrg,
            appName: previousAppName
          }
        }
      });
      if (reattachSubdomain) {
        try {
          await setupSubdomainForEnvironment(environmentName);
          report("Subdomain re-pointed at final app name", SetupStepStatus.Completed);
        } catch (error) {
          report(`Subdomain re-point warning: ${error instanceof Error ? error.message : String(error)}`, SetupStepStatus.Failed);
        }
      }
      const preferredHealthy = await appDeployedWithToken(preferredAppName, newApiKey);
      if (preferredHealthy && appExistsWithToken(cutoverName, newApiKey)) {
        destroyFlyApp(cutoverName, newApiKey, report);
      } else if (!preferredHealthy) {
        report(
          `Preferred app ${preferredAppName} not healthy yet — leaving cutover app ${cutoverName} in place`,
          SetupStepStatus.Failed
        );
      }
      report(`Final app name is ${preferredAppName}`, SetupStepStatus.Completed);
    }

    const preferredFinalHealthy = await appDeployedWithToken(workingAppName, newApiKey);
    if (preferredFinalHealthy && workingAppName === preferredAppName && !appExistsWithToken(cutoverAppName, newApiKey)) {
      await upsertEnvironmentInDatabase({
        environment: environmentName,
        flyio: {
          apiKey: newApiKey,
          appName: workingAppName,
          memory,
          scaleCount,
          organisation: newOrg,
          previous: null
        } as any
      });
      report("Cleared previous Fly credentials after successful cutover", SetupStepStatus.Completed);
      await reattachCustomDomainsForEnvironment(environmentName, baseDomain, report);
    } else {
      await upsertEnvironmentInDatabase({
        environment: environmentName,
        flyio: {
          apiKey: newApiKey,
          appName: workingAppName,
          memory,
          scaleCount,
          organisation: newOrg,
          previous: {
            apiKey: previousApiKey,
            organisation: previousOrg,
            appName: previousAppName
          }
        }
      });
      report(
        "Cutover progress saved — previous credentials retained until preferred app is final and cutover is removed",
        SetupStepStatus.Running
      );
    }

    const freeHost = `https://${environmentName}.${baseDomain}`;
    const appUrl = await publicAppUrlForEnvironment(environmentName, freeHost);
    report(`Fly organisation migration finished for ${environmentName} (app ${workingAppName})`, SetupStepStatus.Completed);
    result = {
      success: true,
      environmentName,
      appName: workingAppName,
      appUrl,
      oldAppDestroyed,
      usedTemporaryAppName,
      temporaryAppName,
      messages
    };
  }

  return result;
}

export function flyCredentialsFingerprint(apiKey: string | undefined): string {
  if (!apiKey) {
    return "(none)";
  } else if (apiKey.length < 20) {
    return "(short)";
  } else {
    return `${apiKey.substring(0, 20)}…${apiKey.substring(apiKey.length - 6)}`;
  }
}
