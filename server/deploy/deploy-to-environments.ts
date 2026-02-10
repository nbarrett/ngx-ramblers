import debug from "debug";
import {
  configureEnvironment,
  createRuntimeConfig,
  deleteVolumeIfExists,
  flyTomlAbsolutePath,
  readConfigFile,
  runCommand
} from "../lib/fly/fly-commands";
import fs from "fs";
import os from "os";
import path from "path";
import { DeploymentConfig, EnvironmentConfig, RuntimeConfig } from "./types";
import { pluraliseWithCount } from "../lib/shared/string-utils";
import { envConfig } from "../lib/env-config/env-config";
import { buildSecretsContent, loadSecretsForEnvironmentFromDatabase } from "../lib/shared/secrets";

const debugLog = debug(envConfig.logNamespace("deploy-environments"));
debugLog.enabled = true;
const config: RuntimeConfig = createRuntimeConfig();
if (config.targetEnvironments.length > 0) {
  debugLog("Deploying to specified environments:", config.targetEnvironments);
} else {
  debugLog("Deploying to all environments");
}

deployToEnvironments(config.configFilePath, config.targetEnvironments).catch(error => {
  debugLog("Deployment failed:", error);
  process.exit(1);
});

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
  if (!secretsFile) {
    debugLog("No secrets returned from database for environment:", environmentName);
    return false;
  }
  const content = buildSecretsContent(secretsFile.secrets);
  const tempFile = path.join(os.tmpdir(), `secrets-${appName}-${Date.now()}.env`);
  try {
    fs.writeFileSync(tempFile, content, { encoding: "utf-8" });
    runCommand(`flyctl secrets import --app ${appName} < ${tempFile}`);
    debugLog("Imported secrets from database for environment:", environmentName);
    return true;
  } finally {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
}

function importSecretsFromFile(appName: string): boolean {
  const secretsFilePath = path.resolve(__dirname, `../../non-vcs/secrets/secrets.${appName}.env`);
  if (fs.existsSync(secretsFilePath)) {
    runCommand(`flyctl secrets import --app ${appName} < ${secretsFilePath}`);
    debugLog("Imported secrets from local file:", secretsFilePath);
    return true;
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
        importSecretsFromFile(appName);
      }
    } else {
      importSecretsFromFile(appName);
    }
  } catch (error) {
    debugLog("Secrets import failed for %s (continuing deployment):", appName, error);
  }
}

async function deployToEnvironments(configFilePath: string, environmentsFilter: string[]): Promise<void> {
  const config: DeploymentConfig = readConfigFile(configFilePath);
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
    runCommand(`flyctl deploy --app ${environmentConfig.appName} --config ${flyTomlPath} --image ${config.dockerImage} --strategy rolling --wait-timeout 600`);
    runCommand(`flyctl scale count ${environmentConfig.scaleCount} --app ${environmentConfig.appName} --yes`);
    runCommand(`flyctl scale memory ${environmentConfig.memory} --app ${environmentConfig.appName}`);
  }
}
