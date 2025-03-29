import path from "path";
import fs from "fs";
import debug from "debug";
import { execSync } from "child_process";

const debugLog = debug("deploy-environments");
debugLog.enabled = true;

export interface EnvironmentConfig {
  name: string;
  apiKey: string;
  appName: string;
  memory: string;
}

export interface DeploymentConfig {
  environments: EnvironmentConfig[];
  dockerImage: string;
  region: string;
}

export interface RuntimeConfig {
  currentDir: string;
  configFilePath: string;
  targetEnvironments: string[];
}

export function readConfigFile(filePath: string): DeploymentConfig {
  try {
    const rawConfig = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(rawConfig) as DeploymentConfig;
  } catch (error) {
    debugLog(`Error reading or parsing config file: ${filePath}`, error);
    process.exit(1);
  }
}

export function runCommand(command: string): void {
  try {
    debugLog(`Running command: ${command}`);
    execSync(command, {stdio: "inherit"});
  } catch (error) {
    debugLog(`Error running command: ${command}`, error);
    process.exit(1);
  }
}

export function createRuntimeConfig(): RuntimeConfig {
  const filterEnvironments: string[] = process.argv.slice(2).reduce((acc: string[], arg, index, args) => {
    if (arg === "--environment" && index + 1 < args.length) {
      return args[index + 1].split(" ").filter(env => env.trim() !== "");
    }
    return acc;
  }, []);

  const currentDir = path.resolve(__dirname);
  const configFilePath = path.resolve(currentDir, "../../non-vcs/fly-io/configs.json");
  return {currentDir, configFilePath, targetEnvironments: filterEnvironments};
}

export function createVolume(appName: string, volumeName: string, region: string): void {
  const volumeListCommand = `flyctl volumes list --app ${appName}`;
  debugLog(`Checking if volume ${volumeName} exists for app ${appName}`);
  const volumeListOutput = execSync(volumeListCommand, {encoding: "utf-8"});

  if (volumeListOutput.includes(volumeName)) {
    debugLog(`Volume ${volumeName} already exists for app ${appName}`);
  } else {
    debugLog(`Creating volume ${volumeName} in region ${region} for app ${appName}`);
    const createVolumeCommand = `flyctl volumes create ${volumeName} --app ${appName} --region ${region} --size 1 --yes`;
    runCommand(createVolumeCommand);
  }
}

export function configureEnvironment(environmentConfig: EnvironmentConfig, config: DeploymentConfig) {
  process.env.FLY_API_TOKEN = environmentConfig.apiKey;
  process.env.APP_NAME = environmentConfig.appName;
  process.env.IMAGE = config.dockerImage;
}

