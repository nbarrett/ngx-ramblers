import { Command } from "commander";
import debug from "debug";
import fs from "fs";
import path from "path";
import os from "os";
import { flyTomlAbsolutePath, OutputCallback, runCommand, runCommandStreaming } from "../../fly/fly-commands";
import { loadSecretsWithFallback, REQUIRED_SECRETS, writeSecretsFile } from "../../shared/secrets";
import {
  configuredEnvironments,
  findEnvironmentFromDatabase,
  upsertEnvironmentInDatabase
} from "../../environments/environments-config";
import { normaliseMemory } from "../../shared/spelling";
import { DeployResult, FlyDeployConfig, ProgressCallback } from "../types";
import { FLYIO_DEFAULTS } from "../../../deploy/types";
import { DEPLOYMENT_DEFAULTS } from "../../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { log } from "../cli-logger";
import { envConfig } from "../../env-config/env-config";
import { keys } from "es-toolkit/compat";

export type DeployOutputCallback = OutputCallback;

const debugLog = debug(envConfig.logNamespace("cli:fly"));

function getFlyTomlPath(): string {
  const flyTomlPath = flyTomlAbsolutePath();
  if (!fs.existsSync(flyTomlPath)) {
    throw new Error(`fly.toml not found at: ${flyTomlPath}. Ensure fly.toml is included in the Docker image.`);
  }
  debugLog("Using fly.toml at:", flyTomlPath);
  return flyTomlPath;
}

async function dockerImageFromDatabase(): Promise<string> {
  const dbConfig = await configuredEnvironments();
  return dbConfig.dockerImage || DEPLOYMENT_DEFAULTS.DOCKER_IMAGE;
}

function setFlyApiToken(apiKey?: string): void {
  if (apiKey) {
    process.env.FLY_API_TOKEN = apiKey;
    debugLog("Using stored fly.io API token");
  }
}

function checkFlyctlAuthentication(apiKey?: string): void {
  setFlyApiToken(apiKey);

  try {
    const output = runCommand("flyctl auth whoami", true);
    debugLog("Flyctl authenticated as:", output.trim());
  } catch (error) {
    const message = error?.message || String(error);
    if (message.includes("No access token") || message.includes("not logged in") || message.includes("auth login")) {
      if (!apiKey) {
        throw new Error(
          "fly.io authentication required. No stored API token found. Please run 'flyctl auth login' in your terminal to authenticate, then retry the deployment."
        );
      }
      throw new Error(
        "fly.io authentication failed. The stored API token may have expired. Please run 'flyctl auth login' to re-authenticate and generate a new token."
      );
    }
    throw new Error(`fly.io authentication check failed: ${message}`);
  }
}

async function generateFlyToken(appName: string): Promise<string> {
  try {
    const tokenOutput = runCommand(`flyctl tokens create deploy --app ${appName} --expiry 0`, true);
    const token = tokenOutput.trim();
    if (token && token.startsWith("FlyV1")) {
      return token;
    }
    debugLog("Could not parse deploy token from output");
    return "";
  } catch (error) {
    debugLog("Failed to generate deploy token:", error);
    return "";
  }
}

async function queryAppConfig(appName: string): Promise<{ memory: string; count: number; hasMachines: boolean } | null> {
  try {
    const output = runCommand(`flyctl scale show --app ${appName} --json`, true);
    const config = JSON.parse(output);
    const hasMachines = config.count > 0 || (config.processes && keys(config.processes).length > 0);
    return {
      memory: config.memory || FLYIO_DEFAULTS.MEMORY,
      count: config.count || 0,
      hasMachines
    };
  } catch (error) {
    debugLog("Error fetching app config for", appName, ":", error);
    return null;
  }
}

async function appExists(appName: string): Promise<boolean> {
  try {
    runCommand(`flyctl scale show --app ${appName} --json`, true);
    return true;
  } catch {
    return false;
  }
}

export interface DeployToFlyioOptions {
  onProgress?: ProgressCallback;
  onDeployOutput?: DeployOutputCallback;
}

export async function deployToFlyio(config: FlyDeployConfig, onProgressOrOptions?: ProgressCallback | DeployToFlyioOptions): Promise<DeployResult> {
  const options: DeployToFlyioOptions = typeof onProgressOrOptions === "function"
    ? { onProgress: onProgressOrOptions }
    : onProgressOrOptions || {};

  const { onProgress, onDeployOutput } = options;

  const report = (message: string, status: "running" | "completed" | "failed" = "running") => {
    debugLog(message);
    if (onProgress) {
      onProgress({ step: "deploy-flyio", status, message });
    }
  };

  const runDeployCommand = async (command: string, description: string): Promise<void> => {
    if (onDeployOutput) {
      report(`${description} (streaming output)...`);
      await runCommandStreaming(command, onDeployOutput);
    } else {
      report(description);
      runCommand(command);
    }
  };

  try {
    report("Checking fly.io authentication");
    checkFlyctlAuthentication(config.apiKey);
    report("fly.io authentication verified");

    report("Checking fly.io configuration");
    const flyTomlPath = getFlyTomlPath();

    const dockerImage = await dockerImageFromDatabase();

    const exists = await appExists(config.appName);
    let isNewlyCreated = false;

    if (!exists) {
      report(`Creating app ${config.appName}`);
      runCommand(`flyctl apps create ${config.appName} --org ${config.organisation}`, true);
      isNewlyCreated = true;
      report(`Created app ${config.appName}`);
    } else {
      report(`App ${config.appName} already exists`);
    }

    let apiKey = config.apiKey || "";
    if (isNewlyCreated && !apiKey) {
      report("Generating deploy token");
      apiKey = await generateFlyToken(config.appName);
      if (apiKey) {
        report("Generated deploy token");
      }
    }

    const missingRequiredSecrets = REQUIRED_SECRETS.filter(key => !config.secrets?.[key]);
    if (missingRequiredSecrets.length > 0) {
      throw new Error(`Cannot deploy ${config.appName}: missing required secrets [${missingRequiredSecrets.join(", ")}]. Persisted secrets must include every key in REQUIRED_SECRETS before a Fly app boot can succeed.`);
    }

    const currentConfig = await queryAppConfig(config.appName);
    const needsInitialDeploy = !currentConfig || !currentConfig.hasMachines;

    report("Validating fly.toml configuration");
    runCommand(`flyctl config validate --config ${flyTomlPath} --app ${config.appName}`);

    const tempSecretsPath = path.join(os.tmpdir(), `secrets-${config.appName}-${Date.now()}.env`);
    try {
      writeSecretsFile(tempSecretsPath, config.secrets);
      report("Importing secrets");
      runCommand(`flyctl secrets import --app ${config.appName} < ${tempSecretsPath}`);
    } finally {
      if (fs.existsSync(tempSecretsPath)) {
        fs.unlinkSync(tempSecretsPath);
      }
    }

    if (needsInitialDeploy) {
      await runDeployCommand(
        `flyctl deploy --app ${config.appName} --config ${flyTomlPath} --image ${dockerImage} --strategy rolling --wait-timeout 600`,
        `Deploying ${config.appName} (initial deploy)`
      );
    }

    report("Scaling application");
    runCommand(`flyctl scale count ${config.scaleCount} --app ${config.appName} --yes`);
    runCommand(`flyctl scale memory ${normaliseMemory(config.memory)} --app ${config.appName}`);

    if (!needsInitialDeploy) {
      await runDeployCommand(
        `flyctl deploy --app ${config.appName} --config ${flyTomlPath} --image ${dockerImage} --strategy rolling --wait-timeout 600`,
        `Redeploying ${config.appName}`
      );
    }

    await upsertEnvironmentInDatabase({
      environment: config.name,
      flyio: {
        apiKey,
        appName: config.appName,
        memory: normaliseMemory(config.memory),
        scaleCount: config.scaleCount,
        organisation: config.organisation
      }
    });
    report("Updated environment configuration in database");

    report("Deployment completed", "completed");

    return {
      success: true,
      appName: config.appName,
      appUrl: `https://${config.appName}.fly.dev`,
      message: "Deployment completed successfully"
    };
  } catch (error) {
    report(`Deployment failed: ${error.message}`, "failed");
    throw error;
  }
}

export async function scaleFlyApp(appName: string, count: number, memory?: string): Promise<void> {
  runCommand(`flyctl scale count ${count} --app ${appName} --yes`);
  if (memory) {
    runCommand(`flyctl scale memory ${normaliseMemory(memory)} --app ${appName}`);
  }
}

export async function setFlySecrets(appName: string, secrets: Record<string, string>): Promise<void> {
  const tempFile = path.join(os.tmpdir(), `secrets-${appName}-${Date.now()}.env`);
  try {
    writeSecretsFile(tempFile, secrets);
    runCommand(`flyctl secrets import --app ${appName} < ${tempFile}`);
  } finally {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
}

export function createFlyCommand(): Command {
  const fly = new Command("fly")
    .alias("f")
    .description("fly.io deployment commands");

  fly
    .command("deploy [name]")
    .description("Deploy an environment to fly.io")
    .option("--app-name <appName>", "fly.io app name (defaults to ngx-ramblers-<name>)")
    .option("--memory <memory>", `Memory allocation (e.g., ${FLYIO_DEFAULTS.MEMORY})`, FLYIO_DEFAULTS.MEMORY)
    .option("--scale <count>", "Number of instances", String(FLYIO_DEFAULTS.SCALE_COUNT))
    .option("--org <organisation>", "fly.io organisation", FLYIO_DEFAULTS.ORGANISATION)
    .action(async (name, options) => {
      try {
        if (!name) {
          log("Environment name is required");
          process.exit(1);
        }
        const envConfig = await findEnvironmentFromDatabase(name);
        const secrets = envConfig ? (await loadSecretsWithFallback(name, envConfig.appName)).secrets : {};

        const config: FlyDeployConfig = {
          name,
          appName: options.appName || envConfig?.appName || `ngx-ramblers-${name}`,
          memory: options.memory || envConfig?.memory || FLYIO_DEFAULTS.MEMORY,
          scaleCount: parseInt(options.scale, 10) || envConfig?.scaleCount || FLYIO_DEFAULTS.SCALE_COUNT,
          organisation: options.org || envConfig?.organisation || FLYIO_DEFAULTS.ORGANISATION,
          secrets,
          apiKey: envConfig?.apiKey
        };

        log("Deploying to fly.io: %s", config.appName);

        const result = await deployToFlyio(config, progress => {
          log("[%s] %s", progress.status, progress.message);
        });

        log("\n✓ Deployment completed");
        log("App URL: %s", result.appUrl);
      } catch (error) {
        log("Error: %s", error.message);
        process.exit(1);
      }
    });

  fly
    .command("scale [appName]")
    .description("Scale a fly.io app")
    .option("--count <count>", "Number of instances")
    .option("--memory <memory>", `Memory allocation (e.g., ${FLYIO_DEFAULTS.MEMORY})`)
    .action(async (appName, options) => {
      try {
        if (!appName) {
          log("App name is required");
          process.exit(1);
        }
        if (!options.count && !options.memory) {
          log("At least one of --count or --memory is required");
          process.exit(1);
        }

        log("Scaling app: %s", appName);

        if (options.count) {
          const count = parseInt(options.count, 10);
          await scaleFlyApp(appName, count, options.memory);
        } else if (options.memory) {
          runCommand(`flyctl scale memory ${normaliseMemory(options.memory)} --app ${appName}`);
        }

        log("✓ Scaling completed");
      } catch (error) {
        log("Error: %s", error.message);
        process.exit(1);
      }
    });

  fly
    .command("token [appName]")
    .description("Generate a deploy token for an app")
    .action(async appName => {
      try {
        if (!appName) {
          log("App name is required");
          process.exit(1);
        }
        log("Generating deploy token for: %s", appName);
        const token = await generateFlyToken(appName);
        if (token) {
          log("\n✓ Token generated:");
          log("%s", token);
        } else {
          log("Failed to generate token");
          process.exit(1);
        }
      } catch (error) {
        log("Error: %s", error.message);
        process.exit(1);
      }
    });

  return fly;
}
