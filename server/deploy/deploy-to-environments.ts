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
  memory: string;
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

function deployApps(configFilePath: string, environmentsFilter: string[]): void {
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
    process.env.FLY_API_TOKEN = environmentConfig.apiKey;
    process.env.APP_NAME = environmentConfig.appName;
    process.env.IMAGE = config.dockerImage;
    debugLog(`Deploying ${config.dockerImage} to ${environmentConfig.appName}`);

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

const filterEnvironments: string[] = process.argv.slice(2).reduce((acc: string[], arg, index, args) => {
  if (arg === "--environment" && index + 1 < args.length) {
    return args[index + 1].split(" ").filter(env => env.trim() !== "");
  }
  return acc;
}, []);

const currentDir = path.resolve(__dirname);
const configFilePath = path.resolve(currentDir, "../../non-vcs/fly-io/configs.json");

debugLog("Deploying to specified environments:", filterEnvironments);
deployApps(configFilePath, filterEnvironments);
