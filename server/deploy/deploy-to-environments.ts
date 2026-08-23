import { dateTimeNowAsValue } from "../lib/shared/dates";
import debug from "debug";
import {
  configureEnvironment,
  createRuntimeConfig,
  deleteVolumeIfExists,
  ensureScale,
  flyTomlAbsolutePath,
  runCommand,
  runCommandWithRetry,
  waitForImageAvailable
} from "../lib/fly/fly-commands";
import fs from "fs";
import os from "os";
import path from "path";
import { keys } from "es-toolkit/compat";
import { DeploymentConfig, EnvironmentConfig, FLYIO_DEFAULTS, RuntimeConfig } from "./types";
import { pluraliseWithCount } from "../lib/shared/string-utils";
import { envConfig } from "../lib/env-config/env-config";
import { buildSecretsContent, loadSecretsForEnvironmentFromDatabase, parseSecretsFile } from "../lib/shared/secrets";
import { configuredEnvironments } from "../lib/environments/environments-config";
import { DEPLOYMENT_DEFAULTS, EnvironmentsConfig } from "../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { BuildVersion } from "../../projects/ngx-ramblers/src/app/models/build-version.model";
import { filterSecretsForSiteFlyDeploy } from "../lib/fly/fly-secrets-policy";
import { pruneDisallowedFlySecrets } from "../lib/fly/fly-secrets-prune";

const debugLog = debug(envConfig.logNamespace("deploy-environments"));
debugLog.enabled = true;
const config: RuntimeConfig = createRuntimeConfig();
if (config.targetEnvironments.length > 0) {
  debugLog("Deploying to specified environments:", config.targetEnvironments);
} else {
  debugLog("Deploying to all environments");
}

deployToEnvironments(config.targetEnvironments).then(() => process.exit(0)).catch(error => {
  debugLog("Deployment failed:", error);
  process.exit(1);
});

function buildDeploymentConfig(dbConfig: EnvironmentsConfig): DeploymentConfig {
  const environments = (dbConfig?.environments || []).map(env => ({
    name: env.environment,
    apiKey: env.flyio?.apiKey || "",
    appName: env.flyio?.appName || `ngx-ramblers-${env.environment}`,
    memory: env.flyio?.memory || FLYIO_DEFAULTS.MEMORY,
    scaleCount: env.flyio?.scaleCount ?? FLYIO_DEFAULTS.SCALE_COUNT,
    organisation: env.flyio?.organisation || FLYIO_DEFAULTS.ORGANISATION,
    mongo: env.mongo ? {
      cluster: env.mongo.cluster || "",
      db: env.mongo.db || "",
      username: env.mongo.username || "",
      password: env.mongo.password || ""
    } : undefined
  }));
  return {
    environments,
    dockerImage: dbConfig.dockerImage || DEPLOYMENT_DEFAULTS.DOCKER_IMAGE,
    region: dbConfig.region || DEPLOYMENT_DEFAULTS.REGION
  };
}

function imageTagFromArg(): string {
  const tagArg = process.argv.find(arg => arg.startsWith("--image-tag="));
  if (tagArg) {
    const tag = tagArg.split("=")[1];
    debugLog("imageTagFromArg:tagArg:", tagArg, "tag:", tag);
    return tag;
  } else {
    const tagIndex = process.argv.indexOf("--image-tag");
    if (tagIndex !== -1 && process.argv.length > tagIndex + 1) {
      const tag = process.argv[tagIndex + 1];
      debugLog("imageTagFromArg:tagIndex:", tagIndex, "tag:", tag);
      return tag;
    } else {
      debugLog("imageTagFromArg:not provided");
      return null;
    }
  }
}

function environmentNamesFrom(environmentConfigs: EnvironmentConfig[]) {
  return environmentConfigs.map(env => env.name).join(", ");
}

async function importSecretsFromDatabase(environmentName: string, appName: string): Promise<boolean> {
  process.env.MONGODB_URI = process.env.ADMIN_MONGODB_URI;
  const secretsFile = await loadSecretsForEnvironmentFromDatabase(environmentName);
  const { disconnect } = await import("../lib/mongo/mongoose-client");
  await disconnect(debugLog);
  if (!secretsFile) {
    debugLog("No secrets returned from database for environment:", environmentName);
    return false;
  } else {
    const filtered = filterSecretsForSiteFlyDeploy(secretsFile.secrets);
    const content = buildSecretsContent(filtered);
    const tempFile = path.join(os.tmpdir(), `secrets-${appName}-${dateTimeNowAsValue()}.env`);
    try {
      fs.writeFileSync(tempFile, content, { encoding: "utf-8" });
      await runCommandWithRetry(`flyctl secrets import --app ${appName} < ${tempFile}`);
      debugLog("Imported secrets from database for environment:", environmentName, "keys:", keys(filtered).sort().join(", "));
      return true;
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  }
}

async function importSecretsFromFile(appName: string): Promise<boolean> {
  const secretsFilePath = path.resolve(__dirname, `../../non-vcs/secrets/secrets.${appName}.env`);
  if (fs.existsSync(secretsFilePath)) {
    const filtered = filterSecretsForSiteFlyDeploy(parseSecretsFile(secretsFilePath));
    const content = buildSecretsContent(filtered);
    const tempFile = path.join(os.tmpdir(), `secrets-${appName}-${dateTimeNowAsValue()}.env`);
    try {
      fs.writeFileSync(tempFile, content, { encoding: "utf-8" });
      await runCommandWithRetry(`flyctl secrets import --app ${appName} < ${tempFile}`);
      debugLog("Imported filtered secrets from local file:", secretsFilePath, "keys:", keys(filtered).sort().join(", "));
      return true;
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  } else {
    debugLog("Secrets file not found:", secretsFilePath);
    return false;
  }
}

async function importSecrets(environmentName: string, appName: string): Promise<void> {
  try {
    if (process.env.ADMIN_MONGODB_URI) {
      debugLog("ADMIN_MONGODB_URI is set - attempting database secrets import for:", environmentName);
      const imported = await importSecretsFromDatabase(environmentName, appName);
      if (!imported) {
        debugLog("Database secrets import returned nothing - falling back to local file for:", appName);
        await importSecretsFromFile(appName);
      }
    } else {
      await importSecretsFromFile(appName);
    }
  } catch (error) {
    debugLog("Secrets import failed for %s (continuing deployment):", appName, error);
  }
}

async function verifyDeployedBuildNumber(appName: string, imageTag: string, attempt = 1): Promise<void> {
  const maxAttempts = 6;
  const url = `https://${appName}.fly.dev/api/version`;
  try {
    const response = await fetch(url);
    const buildVersion: BuildVersion = await response.json();
    if (String(buildVersion.buildNumber) !== imageTag) {
      throw new Error(`Deployed build mismatch on ${appName}: requested image tag ${imageTag} but ${url} reports build ${buildVersion.buildNumber}`);
    }
    debugLog(`Verified ${appName} is serving build ${imageTag}`);
  } catch (error) {
    if (attempt >= maxAttempts) {
      throw error;
    }
    debugLog(`Build verification attempt ${attempt} of ${maxAttempts} for ${appName} failed (${error instanceof Error ? error.message : error}) - retrying in 10s`);
    await new Promise(resolve => setTimeout(resolve, 10000));
    return verifyDeployedBuildNumber(appName, imageTag, attempt + 1);
  }
}

async function deployToEnvironments(environmentsFilter: string[]): Promise<void> {
  if (process.env.ADMIN_MONGODB_URI) {
    process.env.MONGODB_URI = process.env.ADMIN_MONGODB_URI;
  }
  const dbConfig = await configuredEnvironments();
  const config: DeploymentConfig = buildDeploymentConfig(dbConfig);
  const imageTag = imageTagFromArg();
  if (imageTag) {
    const [repo] = config.dockerImage.split(":");
    config.dockerImage = `${repo}:${imageTag}`;
    debugLog(`Overriding docker image tag: ${config.dockerImage}`);
  }

  const flyTomlPath = flyTomlAbsolutePath();
  const environmentsToDeploy = environmentsFilter.length === 0
    ? config.environments
    : config.environments.filter(environmentConfig => environmentsFilter.includes(environmentConfig.name));

  if (!fs.existsSync(flyTomlPath)) {
    debugLog(`fly.toml not found at: ${flyTomlPath}`);
    process.exit(1);
  }
  if (environmentsToDeploy.length === 0 && environmentsFilter.length > 0) {
    debugLog("No environments to deploy given --environment", environmentsFilter.join(", "), "- must one of", environmentNamesFrom(config.environments));
  } else {
    debugLog("Deploying to", pluraliseWithCount(environmentsToDeploy.length, "environment") + ":", environmentNamesFrom(environmentsToDeploy));
  }
  for (const environmentConfig of environmentsToDeploy) {
    configureEnvironment(environmentConfig, config);
    debugLog(`Deploying ${config.dockerImage} to ${environmentConfig.appName}`);
    deleteVolumeIfExists(environmentConfig.appName, config.region);
    runCommand(`flyctl config validate --config ${flyTomlPath} --app ${environmentConfig.appName}`);
    await importSecrets(environmentConfig.name, environmentConfig.appName);
    const pruneResult = pruneDisallowedFlySecrets(environmentConfig.appName, true, {stage: true});
    if (pruneResult.removed.length > 0) {
      debugLog("Pruned disallowed Fly secrets from %s: %s", environmentConfig.appName, pruneResult.removed.join(", "));
    }
    await waitForImageAvailable(environmentConfig.appName, config.dockerImage);
    await runCommandWithRetry(`flyctl deploy --app ${environmentConfig.appName} --config ${flyTomlPath} --image ${config.dockerImage} --strategy rolling --wait-timeout 600`);
    await ensureScale(environmentConfig.appName, environmentConfig.scaleCount, environmentConfig.memory);
    if (imageTag && /^\d+$/.test(imageTag)) {
      await verifyDeployedBuildNumber(environmentConfig.appName, imageTag);
    }
  }
}
