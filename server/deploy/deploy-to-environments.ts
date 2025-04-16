import debug from "debug";
import {
  configureEnvironment,
  createRuntimeConfig,
  createVolumeIfNotExists,
  DeploymentConfig,
  EnvironmentConfig,
  readConfigFile,
  runCommand,
  RuntimeConfig
} from "./fly-commands";
import path from "path";
import fs from "fs";

const debugLog = debug("deploy-environments");
debugLog.enabled = true;
const config: RuntimeConfig = createRuntimeConfig();
debugLog("Deploying to specified environments:", config.targetEnvironments);

function deployToEnvironments(configFilePath: string, environmentsFilter: string[]): void {
  const config: DeploymentConfig = readConfigFile(configFilePath);
  const flyTomlPath = path.resolve(__dirname, "../..", "fly.toml");
  const environmentsToDeploy = environmentsFilter.length === 0
    ? config.environments
    : config.environments.filter(environmentConfig => environmentsFilter.includes(environmentConfig.name));

  if (!fs.existsSync(flyTomlPath)) {
    debugLog(`fly.toml not found at: ${flyTomlPath}`);
    process.exit(1);
  }

  environmentsToDeploy.forEach((environmentConfig: EnvironmentConfig) => {
    configureEnvironment(environmentConfig, config);
    debugLog(`Deploying ${config.dockerImage} to ${environmentConfig.appName}`);

    createVolumeIfNotExists(environmentConfig.appName, "serenity_data", config.region);

    runCommand(`flyctl config validate --config ${flyTomlPath} --app ${environmentConfig.appName}`);
    runCommand(`flyctl deploy --app ${environmentConfig.appName} --config ${flyTomlPath} --image ${config.dockerImage} --strategy rolling`);

    if (!(process.env.GITHUB_ACTIONS === "true")) {
      const secretsFilePath = path.resolve(__dirname, `../../non-vcs/secrets/secrets.${environmentConfig.appName}.env`);
      if (fs.existsSync(secretsFilePath)) {
        runCommand(`flyctl secrets import --app ${environmentConfig.appName} < ${secretsFilePath}`);
      } else {
        debugLog(`Secrets file not found: ${secretsFilePath}`);
      }
    }
    runCommand(`flyctl scale count 1 --app ${environmentConfig.appName}`);
    runCommand(`flyctl scale memory ${environmentConfig.memory} --app ${environmentConfig.appName}`);
  });
}

deployToEnvironments(config.configFilePath, config.targetEnvironments);
