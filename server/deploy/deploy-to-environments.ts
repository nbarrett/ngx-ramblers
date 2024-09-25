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
  include: boolean;
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
    execSync(command, {stdio: "inherit"});
  } catch (error) {
    debugLog(`Error running command: ${command}`, error);
    process.exit(1);
  }
}

function deployApps(configFilePath: string): void {
  const config: DeploymentConfig = readConfigFile(configFilePath);
  config.environments
    .filter((environmentConfig: EnvironmentConfig) => environmentConfig.include)
    .forEach((environmentConfig: EnvironmentConfig) => {
      process.env.FLY_API_TOKEN = environmentConfig.apiKey;
      process.env.APP_NAME = environmentConfig.appName;
      process.env.DOCKER_IMAGE = config.dockerImage;
      debugLog(`Deploying ${config.dockerImage} to ${environmentConfig.appName} environment`);
      const secretsFilePath = path.resolve(currentDir, `../../non-vcs/secrets/secrets.${environmentConfig.appName}.env`);
      if (fs.existsSync(secretsFilePath)) {
        runCommand(`flyctl secrets import --app ${environmentConfig.appName} < ${secretsFilePath}`);
      } else {
        debugLog(`Secrets file not found: ${secretsFilePath}`);
      }
      runCommand(`flyctl deploy --remote-only --app ${environmentConfig.appName}`);
      runCommand(`fly scale count 1 --app ${environmentConfig.appName}`);
    });
}

const currentDir = path.resolve(__dirname);
const configFilePath = path.resolve(currentDir, "../../non-vcs/fly-io/configs.json");
debugLog("deploying to all environments in:", configFilePath);
deployApps(configFilePath);
