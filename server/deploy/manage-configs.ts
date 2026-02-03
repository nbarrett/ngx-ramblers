import debug from "debug";
import fs from "fs";
import path from "path";
import { program } from "commander";
import inquirer from "inquirer";
import {
  configureEnvironment,
  createRuntimeConfig,
  flyTomlAbsolutePath,
  readConfigFile,
  runCommand
} from "./fly-commands";
import {
  AWS_DEFAULTS,
  DeploymentConfig,
  FLYIO_DEFAULTS,
  NewEnvironmentConfig,
  RuntimeConfig,
  SecretsConfig
} from "./types";
import { Environment } from "../lib/env-config/environment-model";
import { envConfig } from "../lib/env-config/env-config";

const defaults = {
  environmentName: "staging",
  memory: FLYIO_DEFAULTS.MEMORY,
  scaleCount: String(FLYIO_DEFAULTS.SCALE_COUNT),
  awsRegion: AWS_DEFAULTS.REGION,
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  chromeVersion: "131",
  debug: "ngx-ramblers:*",
  debugColors: "true",
  mongodbUsername: "",
  mongodbPassword: "",
  mongodbCluster: "",
  mongodbBaseUri: "mongodb+srv://{{username}}:{{password}}@{{cluster}}.mongodb.net/ngx-ramblers-{{name}}?retryWrites=true&w=majority",
  nodeEnv: "production"
};

const debugLog = debug(envConfig.logNamespace("manage-configs"));
debugLog.enabled = true;

async function generateAuthSecret(): Promise<string> {
  try {
    const output = runCommand("openssl rand -hex 16", true);
    return output.trim();
  } catch (error) {
    debugLog(`Error generating AUTH_SECRET: ${error}`);
    process.exit(1);
  }
}

async function generateFlyApiToken(): Promise<string> {
  try {
    const output = runCommand("flyctl auth token", true);
    const token = output.trim().split("\n")[0];
    if (!token || token.length < 10 || !token.startsWith("FlyV1")) {
      debugLog(`Generated token ${token} is invalid or incomplete, prompting user`);
      return "";
    }
    const originalToken = process.env[Environment.FLY_API_TOKEN];
    process.env[Environment.FLY_API_TOKEN] = token;
    try {
      runCommand("flyctl auth whoami", true);
      return token;
    } catch (authError) {
      debugLog(`Token validation failed: ${authError}`);
      return "";
    } finally {
      process.env[Environment.FLY_API_TOKEN] = originalToken;
    }
  } catch (error) {
    debugLog(`Error generating FLY_API_TOKEN: ${error}`);
    return "";
  }
}

async function queryAppConfig(appName: string): Promise<{ memory: string; count: number; hasMachines: boolean } | null> {
  try {
    const output = runCommand(`flyctl scale show --app ${appName} --json`, true, true);
    const config = JSON.parse(output);
    const hasMachines = config.count > 0 || (config.processes && Object.keys(config.processes).length > 0);
    return {
      memory: config.memory || FLYIO_DEFAULTS.MEMORY,
      count: config.count || 0,
      hasMachines
    };
  } catch (error) {
    debugLog(`Error fetching current app config for ${appName}: ${error}`);
    return null;
  }
}

async function getOrganization(): Promise<string> {
  try {
    const output = runCommand("flyctl orgs list", true);
    const lines = output.trim().split("\n");
    if (lines.length > 1) {
      return lines[1].split(/\s+/)[0];
    }
    debugLog("No organizations found");
    return "";
  } catch (error) {
    debugLog(`Error listing organizations: ${error}`);
    return "";
  }
}

function parseEnvConfig(envConfig: NewEnvironmentConfig): NewEnvironmentConfig {
  if (!envConfig.name || !envConfig.appName || !envConfig.memory || !envConfig.scaleCount || !envConfig.secrets) {
    debugLog("Invalid environment configuration: missing required fields. name:", envConfig.name,
      "appName:", envConfig.appName, "memory:", envConfig.memory, "scaleCount:", envConfig.scaleCount,
      "secrets:", !!envConfig.secrets);
    process.exit(1);
  }
  if (!envConfig.apiKey) {
    debugLog("No apiKey provided - will use authenticated Fly CLI session");
  }
  if (envConfig.memory && !envConfig.memory.includes("mb")) {
    envConfig.memory = `${envConfig.memory}mb`;
  }
  return envConfig;
}

async function queryNewEnvironmentConfig(): Promise<NewEnvironmentConfig> {
  const fileIndex = process.argv.indexOf("--new-environment-file");
  if (fileIndex !== -1 && fileIndex + 1 < process.argv.length) {
    try {
      const filePath = process.argv[fileIndex + 1];
      debugLog("Reading config from file:", filePath);
      const fileContent = fs.readFileSync(filePath, "utf-8");
      const envConfig = JSON.parse(fileContent) as NewEnvironmentConfig;
      return parseEnvConfig(envConfig);
    } catch (error) {
      debugLog(`Error reading environment config file: ${error}`);
      process.exit(1);
    }
  }

  const envIndex = process.argv.indexOf("--new-environment");
  if (envIndex !== -1 && envIndex + 1 < process.argv.length) {
    try {
      const envConfig = JSON.parse(process.argv[envIndex + 1]) as NewEnvironmentConfig;
      return parseEnvConfig(envConfig);
    } catch (error) {
      debugLog(`Error parsing new environment configuration: ${error}`);
      process.exit(1);
    }
  }

  const org = await getOrganization();
  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "name",
      message: "Environment name:",
      default: defaults.environmentName,
      validate: input => input.trim() ? true : "Environment name is required"
    },
    {
      type: "input",
      name: "appName",
      message: "Fly.io app name:",
      default: (answers: any) => `ngx-ramblers-${answers.name}`,
      validate: input => input.trim() ? true : "App name is required"
    },
    {
      type: "input",
      name: "apiKey",
      message: "Fly.io API key (leave empty to generate):",
      default: null,
      validate: input => !input || input.trim() ? true : "API key is required or leave empty to generate"
    },
    {
      type: "input",
      name: "memory",
      message: `Memory allocation (MB) [default: ${defaults.memory}mb]:`,
      default: `${defaults.memory}mb`,
      validate: input => {
        if (!input) return true;
        const num = input.replace("mb", "").trim();
        return !isNaN(+num) ? true : "Memory must be a number with optional 'mb' suffix";
      },
      filter: input => input ? `${input.replace("mb", "").trim()}mb` : input
    },
    {
      type: "input",
      name: "scaleCount",
      message: `Number of instances [default: ${defaults.scaleCount}]:`,
      default: defaults.scaleCount,
      validate: input => !input || !isNaN(+input) ? true : "Scale count must be a number"
    },
    {
      type: "input",
      name: "awsRegion",
      message: `AWS Region [default: ${defaults.awsRegion}]:`,
      default: defaults.awsRegion
    },
    {
      type: "input",
      name: "awsBucket",
      message: "AWS S3 Bucket:",
      default: (answers: any) => `ngx-ramblers-${answers.name}`
    },
    {
      type: "input",
      name: "awsAccessKeyId",
      message: `AWS Access Key ID [default: ${defaults.awsAccessKeyId}]:`,
      default: defaults.awsAccessKeyId
    },
    {
      type: "input",
      name: "awsSecretAccessKey",
      message: `AWS Secret Access Key [default: ${defaults.awsSecretAccessKey}]:`,
      default: defaults.awsSecretAccessKey
    },
    {
      type: "input",
      name: "mongodbUsername",
      message: `MongoDB Username [default: ${defaults.mongodbUsername}]:`,
      default: defaults.mongodbUsername,
      validate: input => !input || input.trim() ? true : "MongoDB Username is required"
    },
    {
      type: "password",
      name: "mongodbPassword",
      message: `MongoDB Password [default: ${defaults.mongodbPassword}]:`,
      default: defaults.mongodbPassword,
      validate: input => !input || input.trim() ? true : "MongoDB Password is required"
    },
    {
      type: "input",
      name: "mongodbCluster",
      message: `MongoDB Cluster [default: ${defaults.mongodbCluster}]:`,
      default: defaults.mongodbCluster,
      validate: input => !input || input.trim() ? true : "MongoDB Cluster is required"
    },
    {
      type: "input",
      name: "organization",
      message: "Fly.io organization (leave empty for default):",
      default: org || FLYIO_DEFAULTS.ORGANISATION,
      validate: input => !input || input.trim() ? true : "Organization is required if specified"
    }
  ]);

  const authSecret = !answers.apiKey ? await generateAuthSecret() : "";
  let flyApiToken = !answers.apiKey ? await generateFlyApiToken() : answers.apiKey;
  if (!flyApiToken) {
    const tokenAnswer = await inquirer.prompt({
      type: "input",
      name: "apiKey",
      message: "Please enter a valid Fly.io API key manually:",
      validate: input => input.trim() ? true : "API key is required"
    });
    flyApiToken = tokenAnswer.apiKey;
  }

  const mongodbUri = defaults.mongodbBaseUri
    .replace("{{username}}", answers.mongodbUsername)
    .replace("{{password}}", answers.mongodbPassword)
    .replace("{{cluster}}", answers.mongodbCluster)
    .replace("{{name}}", answers.name);

  const secrets: SecretsConfig = {
    AUTH_SECRET: authSecret || await generateAuthSecret(),
    AWS_ACCESS_KEY_ID: answers.awsAccessKeyId || defaults.awsAccessKeyId,
    AWS_SECRET_ACCESS_KEY: answers.awsSecretAccessKey || defaults.awsSecretAccessKey,
    AWS_BUCKET: answers.awsBucket,
    AWS_REGION: answers.awsRegion,
    CHROME_VERSION: defaults.chromeVersion,
    DEBUG: defaults.debug,
    DEBUG_COLORS: defaults.debugColors,
    MONGODB_URI: mongodbUri,
    NODE_ENV: defaults.nodeEnv,
    FLY_API_TOKEN: flyApiToken
  };

  return {
    name: answers.name,
    apiKey: flyApiToken,
    appName: answers.appName,
    memory: answers.memory || defaults.memory,
    scaleCount: +answers.scaleCount || +defaults.scaleCount,
    secrets,
    organisation: answers.organization || org || FLYIO_DEFAULTS.ORGANISATION
  };
}

function writeSecretsFile(appName: string, secrets: SecretsConfig, basePath: string): string {
  const secretsFilePath = path.resolve(basePath, `../../non-vcs/secrets/secrets.${appName}.env`);
  const secretsContent = Object.entries(secrets)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n") + "\n";

  try {
    fs.writeFileSync(secretsFilePath, secretsContent, { encoding: "utf-8" });
    debugLog(`Wrote secrets file: ${secretsFilePath}`);
    return secretsFilePath;
  } catch (error) {
    debugLog(`Error writing secrets file ${secretsFilePath}: ${error}`);
    process.exit(1);
  }
}

function updateEnvironmentConfig(configFilePath: string, newEnvConfig: NewEnvironmentConfig): void {
  const config: DeploymentConfig = readConfigFile(configFilePath);

  const existingEnv = config.environments.find(env => env.name === newEnvConfig.name);
  if (existingEnv) {
    debugLog(`Environment ${newEnvConfig.name} already exists, checking for updates...`);
    if (existingEnv.apiKey === newEnvConfig.apiKey &&
      existingEnv.appName === newEnvConfig.appName &&
      existingEnv.memory === newEnvConfig.memory &&
      existingEnv.scaleCount === newEnvConfig.scaleCount) {
      debugLog(`No changes detected for ${newEnvConfig.name}, skipping update`);
      return;
    }
    debugLog(`Updating existing environment ${newEnvConfig.name} with new settings`);
    Object.assign(existingEnv, newEnvConfig);
  } else {
    config.environments.push({
      name: newEnvConfig.name,
      apiKey: newEnvConfig.apiKey,
      appName: newEnvConfig.appName,
      memory: newEnvConfig.memory,
      scaleCount: newEnvConfig.scaleCount,
      organisation: newEnvConfig.organisation
    });
    debugLog(`Added new environment: ${newEnvConfig.name}`);
  }

  try {
    fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2), { encoding: "utf-8" });
    debugLog(`Updated config file with environment: ${newEnvConfig.name}`);
  } catch (error) {
    debugLog(`Error updating config file ${configFilePath}: ${error}`);
    process.exit(1);
  }
}

async function deployNewEnvironment(config: RuntimeConfig, newEnvConfig: NewEnvironmentConfig): Promise<void> {
  const secretsFilePath = writeSecretsFile(newEnvConfig.appName, newEnvConfig.secrets, config.currentDir);
  const deploymentConfig: DeploymentConfig = readConfigFile(config.configFilePath);
  const dockerImage = deploymentConfig.dockerImage;

  const flyTomlPath = flyTomlAbsolutePath();
  if (!fs.existsSync(flyTomlPath)) {
    debugLog(`fly.toml not found at: ${flyTomlPath}`);
    process.exit(1);
  }

  // Use the organisation from the config
  const org = newEnvConfig.organisation;

  let isNewlyCreatedApp = false;
  try {
    runCommand(`flyctl scale show --app ${newEnvConfig.appName} --json`, true, true);
    debugLog(`App ${newEnvConfig.appName} already exists`);
  } catch (error) {
    debugLog(`App ${newEnvConfig.appName} does not exist, creating it...`);
    try {
      runCommand(`flyctl apps create ${newEnvConfig.appName} --org ${org}`, true, true);
      debugLog(`Successfully created app ${newEnvConfig.appName}`);
      isNewlyCreatedApp = true;
    } catch (createError) {
      debugLog(`Failed to create app ${newEnvConfig.appName}: ${createError}`);
      process.exit(1);
    }
  }

  if (isNewlyCreatedApp && !newEnvConfig.apiKey) {
    debugLog(`Generating deploy token for ${newEnvConfig.appName}...`);
    try {
      const tokenOutput = runCommand(`flyctl tokens create deploy --app ${newEnvConfig.appName} --expiry 0`, true, true);
      const token = tokenOutput.trim();
      if (token && token.startsWith("FlyV1")) {
        newEnvConfig.apiKey = token;
        debugLog(`Successfully generated deploy token for ${newEnvConfig.appName}`);
      } else {
        debugLog(`Warning: Could not parse deploy token from output`);
      }
    } catch (tokenError) {
      debugLog(`Warning: Failed to generate deploy token: ${tokenError}. You may need to create one manually.`);
    }
  }

  const currentConfig = await queryAppConfig(newEnvConfig.appName);
  const needsInitialDeploy = !currentConfig || !currentConfig.hasMachines;

  runCommand(`flyctl config validate --config ${flyTomlPath} --app ${newEnvConfig.appName}`);
  runCommand(`flyctl secrets import --app ${newEnvConfig.appName} < ${secretsFilePath}`);

  if (needsInitialDeploy) {
    debugLog(`No machines found - deploying ${newEnvConfig.appName} first to create machines...`);
    runCommand(`flyctl deploy --app ${newEnvConfig.appName} --config ${flyTomlPath} --image ${dockerImage} --strategy rolling --wait-timeout 600`);
  }

  runCommand(`flyctl scale count ${newEnvConfig.scaleCount} --app ${newEnvConfig.appName} --yes`);
  runCommand(`flyctl scale memory ${newEnvConfig.memory} --app ${newEnvConfig.appName}`);

  if (!needsInitialDeploy) {
    debugLog(`Redeploying ${newEnvConfig.appName}...`);
    runCommand(`flyctl deploy --app ${newEnvConfig.appName} --config ${flyTomlPath} --image ${dockerImage} --strategy rolling --wait-timeout 600`);
  }

  configureEnvironment(newEnvConfig, readConfigFile(config.configFilePath));
  debugLog(`Configured environment ${newEnvConfig.appName}`);

  updateGitHubSecret(config.configFilePath);
}

function updateGitHubSecret(configFilePath: string): void {
  debugLog("Updating GitHub CONFIGS_JSON secret...");
  try {
    const configContent = fs.readFileSync(configFilePath, "utf-8");
    const escapedContent = configContent.replace(/'/g, "'\\''");
    runCommand(`gh secret set CONFIGS_JSON --body '${escapedContent}'`, false, true);
    debugLog("Successfully updated GitHub CONFIGS_JSON secret");
  } catch (error) {
    debugLog(`Warning: Failed to update GitHub secret: ${error}. You may need to update it manually.`);
    debugLog("To update manually, copy the contents of configs.json to the CONFIGS_JSON GitHub secret.");
  }
}

async function main(): Promise<void> {
  program
    .option("--new-environment <config>", "JSON configuration for new environment")
    .option("--new-environment-file <path>", "Path to JSON configuration file for new environment")
    .parse(process.argv);

  const config = createRuntimeConfig();
  const newEnvConfig = await queryNewEnvironmentConfig();

  if (!newEnvConfig) {
    debugLog("No new environment configuration provided");
    program.help();
    process.exit(0);
  }

  updateEnvironmentConfig(config.configFilePath, newEnvConfig);
  deployNewEnvironment(config, newEnvConfig);
}

main().catch(error => {
  debugLog(`Error in main execution: ${error}`);
  process.exit(1);
});
