import debug from "debug";
import {
  configureEnvironment,
  createRuntimeConfig,
  deleteVolumeIfExists,
  flyTomlAbsolutePath,
  readConfigFile,
  runCommand
} from "./fly-commands";
import fs from "fs";
import { DeploymentConfig, EnvironmentConfig, RuntimeConfig } from "./types";
import { pluraliseWithCount } from "../lib/shared/string-utils";
import path from "path";

const debugLog = debug("deploy-environments");
debugLog.enabled = true;
const config: RuntimeConfig = createRuntimeConfig();
if (config.targetEnvironments.length > 0) {
  debugLog("Deploying to specified environments:", config.targetEnvironments);
} else {
  debugLog("Deploying to all environments");
}

deployToEnvironments(config.configFilePath, config.targetEnvironments);

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

function deployToEnvironments(configFilePath: string, environmentsFilter: string[]): void {
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
  environmentsToDeploy.forEach((environmentConfig: EnvironmentConfig) => {
    configureEnvironment(environmentConfig, config);
    debugLog(`Deploying ${config.dockerImage} to ${environmentConfig.appName}`);
    deleteVolumeIfExists(environmentConfig.appName, config.region);
    runCommand(`flyctl config validate --config ${flyTomlPath} --app ${environmentConfig.appName}`);
    if (!(process.env.GITHUB_ACTIONS === "true")) {
      const secretsFilePath = path.resolve(__dirname, `../../non-vcs/secrets/secrets.${environmentConfig.appName}.env`);
      if (fs.existsSync(secretsFilePath)) {
        runCommand(`flyctl secrets import --app ${environmentConfig.appName} < ${secretsFilePath}`);
      } else {
        debugLog(`Secrets file not found: ${secretsFilePath}`);
      }
    }
    runCommand(`flyctl deploy --app ${environmentConfig.appName} --config ${flyTomlPath} --image ${config.dockerImage} --strategy rolling --wait-timeout 600`);
    runCommand(`flyctl scale count ${environmentConfig.scaleCount} --app ${environmentConfig.appName} --yes`);
    runCommand(`flyctl scale memory ${environmentConfig.memory} --app ${environmentConfig.appName}`);
  });
}

