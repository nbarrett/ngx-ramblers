import { Command } from "commander";
import debug from "debug";
import { keys } from "es-toolkit/compat";
import { EnvironmentSetupRequest } from "../../environment-setup/types";
import { loadSecretsForEnvironment, loadSecretsWithFallback, updateSecretsFile } from "../../shared/secrets";
import { parseMongoUri } from "../../shared/mongodb-uri";
import { findEnvironmentFromDatabase, listEnvironmentSummariesFromDatabase } from "../../environments/environments-config";
import { normaliseMemory } from "../../shared/spelling";
import { reinitDatabase, seedDatabase } from "./database";
import { DeployOutputCallback, deployToFlyio } from "./fly";
import { EnvironmentResult, FlyDeployConfig, ProgressCallback, ResumeOptions } from "../types";
import { log } from "../cli-logger";
import { envConfig } from "../../env-config/env-config";

export interface ResumeEnvironmentOptions extends ResumeOptions {
  onDeployOutput?: DeployOutputCallback;
}

const debugLog = debug(envConfig.logNamespace("cli:environment"));

export async function createEnvironment(
  request: EnvironmentSetupRequest,
  onProgress?: ProgressCallback
): Promise<EnvironmentResult> {
  debugLog("Creating environment:", request.environmentBasics.environmentName);

  const { createEnvironment: createEnv } = await import("../../environment-setup/environment-setup-service");
  const result = await createEnv(request, onProgress);

  return {
    success: true,
    environmentName: result.environmentName,
    appName: result.appName,
    appUrl: result.appUrl
  };
}

export async function resumeEnvironment(
  name: string,
  options: ResumeEnvironmentOptions,
  onProgress?: ProgressCallback
): Promise<EnvironmentResult> {
  debugLog("Resuming environment:", name, "options:", options);

  const envConfigData = await findEnvironmentFromDatabase(name);
  if (!envConfigData) {
    throw new Error(`Environment ${name} not found`);
  }

  const secrets = await loadSecretsWithFallback(name, envConfigData.appName);
  if (keys(secrets.secrets).length === 0) {
    throw new Error(`No secrets found for ${envConfigData.appName}`);
  }
  debugLog("Loaded secrets from:", secrets.path);

  const mongoUri = secrets.secrets.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI not found in secrets");
  }

  const mongoInfo = parseMongoUri(mongoUri);
  if (!mongoInfo) {
    throw new Error("Could not parse MongoDB URI");
  }

  if (options.runDbInit) {
    if (onProgress) {
      onProgress({ step: "database-init", status: "running", message: "Initialising database" });
    }

    const ramblersApiKey = secrets.secrets.RAMBLERS_API_KEY;
    const areaCode = secrets.secrets.RAMBLERS_AREA_CODE;
    const areaName = secrets.secrets.RAMBLERS_AREA_NAME;
    const groupCode = secrets.secrets.RAMBLERS_GROUP_CODE;
    const groupName = secrets.secrets.RAMBLERS_GROUP_NAME || mongoInfo.groupName;
    const googleMapsApiKey = secrets.secrets.GOOGLE_MAPS_APIKEY;

    if (ramblersApiKey && areaCode && groupCode) {
      debugLog("Full reinitialisation with Ramblers API data");
      await reinitDatabase(
        {
          mongoUri,
          database: mongoInfo.database,
          groupName,
          groupCode,
          areaCode,
          areaName: areaName || "",
          ramblersApiKey,
          googleMapsApiKey
        },
        onProgress
      );
    } else {
      debugLog("Fallback to sample data seeding (missing Ramblers info in secrets)");
      if (onProgress) {
        onProgress({
          step: "database-init",
          status: "running",
          message: "Missing Ramblers info in secrets - seeding sample data only"
        });
      }
      await seedDatabase(
        {
          mongoUri,
          database: mongoInfo.database,
          groupName: mongoInfo.groupName
        },
        onProgress
      );
    }

    if (onProgress) {
      onProgress({ step: "database-init", status: "completed", message: "Database initialisation completed" });
    }
  }

  if (options.runFlyDeployment) {
    const deployConfig: FlyDeployConfig = {
      name: envConfigData.name,
      appName: envConfigData.appName,
      memory: normaliseMemory(envConfigData.memory),
      scaleCount: envConfigData.scaleCount,
      organisation: envConfigData.organisation,
      secrets: secrets.secrets,
      apiKey: envConfigData.apiKey
    };

    await deployToFlyio(deployConfig, {
      onProgress,
      onDeployOutput: options.onDeployOutput
    });
  }

  return {
    success: true,
    environmentName: envConfigData.name,
    appName: envConfigData.appName,
    appUrl: `https://${envConfigData.appName}.fly.dev`
  };
}

export async function validateEnvironmentRequest(request: EnvironmentSetupRequest): Promise<{ valid: boolean; results: { valid: boolean; message: string }[] }> {
  const { validateSetupRequest } = await import("../../environment-setup/environment-setup-service");
  const results = await validateSetupRequest(request);
  const allValid = results.every(r => r.valid);
  return { valid: allValid, results };
}

export function createEnvironmentCommand(): Command {
  const environment = new Command("environment")
    .alias("env")
    .description("Environment management commands");

  environment
    .command("list")
    .description("List all configured environments")
    .action(async () => {
      try {
        const environments = await listEnvironmentSummariesFromDatabase();

        if (environments.length === 0) {
          log("No environments configured");
          return;
        }

        log("Configured environments:\n");
        environments.forEach(env => {
          log("  %s", env.name);
          log("    App: %s", env.appName);
          log("    Memory: %s", env.memory);
          log("    Scale: %d", env.scaleCount);
          log("    Organisation: %s", env.organisation);
          log("    API Key: %s", env.hasApiKey ? "Yes" : "No");
          log("");
        });
      } catch (error) {
        log("Error: %s", error.message);
        process.exit(1);
      }
    });

  environment
    .command("resume [name]")
    .description("Resume setup for an existing environment")
    .option("--db-init", "Run database initialisation")
    .option("--fly-deploy", "Run fly.io deployment")
    .action(async (name, options) => {
      try {
        if (!name) {
          log("Environment name is required");
          process.exit(1);
        }
        if (!options.dbInit && !options.flyDeploy) {
          log("At least one of --db-init or --fly-deploy is required");
          process.exit(1);
        }

        log("Resuming environment: %s", name);

        const result = await resumeEnvironment(
          name,
          {
            runDbInit: options.dbInit || false,
            runFlyDeployment: options.flyDeploy || false
          }, progress => {
            log("[%s] %s%s", progress.status, progress.step, progress.message ? `: ${progress.message}` : "");
          }
        );

        log("\n✓ Environment resumed successfully");
        log("App URL: %s", result.appUrl);
      } catch (error) {
        log("Error: %s", error.message);
        process.exit(1);
      }
    });

  environment
    .command("update-ramblers [name]")
    .description("Update Ramblers info in an environment's secrets file")
    .requiredOption("--api-key <apiKey>", "Ramblers API key")
    .requiredOption("--area-code <areaCode>", "Ramblers area code")
    .requiredOption("--area-name <areaName>", "Ramblers area name")
    .requiredOption("--group-code <groupCode>", "Ramblers group code")
    .requiredOption("--group-name <groupName>", "Ramblers group name")
    .action(async (name, options) => {
      try {
        if (!name) {
          log("Environment name is required");
          process.exit(1);
        }
        const envConfig = await findEnvironmentFromDatabase(name);
        if (!envConfig) {
          log("Environment not found: %s", name);
          process.exit(1);
        }

        log("Updating Ramblers info for: %s", name);

        updateSecretsFile(envConfig.appName, {
          RAMBLERS_API_KEY: options.apiKey,
          RAMBLERS_AREA_CODE: options.areaCode,
          RAMBLERS_AREA_NAME: options.areaName,
          RAMBLERS_GROUP_CODE: options.groupCode,
          RAMBLERS_GROUP_NAME: options.groupName
        });

        log("✓ Updated secrets file with Ramblers info");
        log("\nYou can now run: ngx-cli env resume %s --db-init", name);
      } catch (error) {
        log("Error: %s", error.message);
        process.exit(1);
      }
    });

  environment
    .command("show [name]")
    .description("Show details for an environment")
    .action(async (name) => {
      try {
        if (!name) {
          log("Environment name is required");
          process.exit(1);
        }
        const envConfig = await findEnvironmentFromDatabase(name);
        if (!envConfig) {
          log("Environment not found: %s", name);
          process.exit(1);
        }

        log("Environment: %s", envConfig.name);
        log("App Name: %s", envConfig.appName);
        log("Memory: %s", envConfig.memory);
        log("Scale Count: %d", envConfig.scaleCount);
        log("Organisation: %s", envConfig.organisation);
        log("Has API Key: %s", envConfig.apiKey ? "Yes" : "No");
        log("App URL: https://%s.fly.dev", envConfig.appName);

        const secrets = loadSecretsForEnvironment(envConfig.appName);
        log("\nSecrets file: %s", secrets.path);
        log("Secrets count: %d", keys(secrets.secrets).length);

        if (secrets.secrets.MONGODB_URI) {
          const mongoInfo = parseMongoUri(secrets.secrets.MONGODB_URI);
          if (mongoInfo) {
            log("\nMongoDB:");
            log("  Cluster: %s", mongoInfo.cluster);
            log("  Database: %s", mongoInfo.database);
            log("  Username: %s", mongoInfo.username);
          }
        }
      } catch (error) {
        log("Error: %s", error.message);
        process.exit(1);
      }
    });

  return environment;
}
