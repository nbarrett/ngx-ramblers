import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import debug from "debug";

const debugLog = debug("deploy-environments");
debugLog.enabled = true;

export interface EnvironmentConfig {
  name: string;
  apiKey: string;
  appName: string;
}

export interface DeploymentConfig {
  environments: EnvironmentConfig[];
  dockerImage: string;
}

function readConfigFile(filePath: string): DeploymentConfig {
  try {
    const rawConfig = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(rawConfig) as DeploymentConfig;
  } catch (error) {
    debugLog(`Error reading or parsing config file: ${filePath}`, error);
    process.exit(1);
  }
}

function runCommand(command: string): void {
  try {
    debugLog(`Running command: ${command}`);
    execSync(command, { stdio: "inherit" });
  } catch (error) {
    debugLog(`Error running command: ${command}`, error);
    process.exit(1);
  }
}

function deployApps(configFilePath: string, filterEnvironments: string[]): void {
  const config: DeploymentConfig = readConfigFile(configFilePath);

  let environmentsToDeploy;
  if (filterEnvironments.includes("all")) {
    environmentsToDeploy = config.environments;
  } else {
    environmentsToDeploy = config.environments.filter(environmentConfig =>
      filterEnvironments.includes(environmentConfig.name)
    );
  }

  if (environmentsToDeploy.length === 0) {
    debugLog("No valid environments found for deployment.");
    process.exit(1);
  }

  environmentsToDeploy.forEach((environmentConfig: EnvironmentConfig) => {
    process.env.FLY_API_TOKEN = environmentConfig.apiKey;
    process.env.APP_NAME = environmentConfig.appName;
    process.env.IMAGE = config.dockerImage;
    debugLog(`Deploying ${config.dockerImage} to ${environmentConfig.appName} environment`);

    const secretsFilePath = path.resolve(currentDir, `../../non-vcs/secrets/secrets.${environmentConfig.appName}.env`);
    if (fs.existsSync(secretsFilePath)) {
      runCommand(`flyctl secrets import --app ${environmentConfig.appName} < ${secretsFilePath}`);
    } else {
      debugLog(`Secrets file not found: ${secretsFilePath}`);
    }

    runCommand(`flyctl deploy --memory 2gb --remote-only --app ${environmentConfig.appName} --image ${config.dockerImage}`);
    runCommand(`fly scale count 1 --app ${environmentConfig.appName}`);
  });
}

// Get environments from command line arguments (excluding the first two arguments)
const filterEnvironments = process.argv.slice(2);
const currentDir = path.resolve(__dirname);
const configFilePath = path.resolve(currentDir, "../../non-vcs/fly-io/configs.json");

if (filterEnvironments.length === 0) {
  debugLog("No environments provided. Please specify the environments to deploy or use 'all'.");
  process.exit(1);
}

debugLog("Deploying to specified environments:", filterEnvironments);
deployApps(configFilePath, filterEnvironments);
