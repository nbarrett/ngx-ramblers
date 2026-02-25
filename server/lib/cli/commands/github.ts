import { Command } from "commander";
import debug from "debug";
import { execSync } from "child_process";
import { configuredEnvironments } from "../../environments/environments-config";
import { loadConfigsJson, saveConfigsJson } from "../../shared/configs-json";
import { DeploymentConfig, FLYIO_DEFAULTS } from "../../../deploy/types";
import { EnvironmentsConfig } from "../../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { ReconciliationResult, ReconciliationReport, DeployEnvironmentConfig } from "../../environment-setup/types";
import { log } from "../cli-logger";
import { envConfig } from "../../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("cli:github"));

export function transformDatabaseToDeployConfig(dbConfig: EnvironmentsConfig): DeploymentConfig {
  const environments = (dbConfig.environments || [])
    .filter(env => env.flyio?.appName || env.flyio?.memory || env.flyio?.scaleCount)
    .map(env => ({
      name: env.environment,
      apiKey: env.flyio?.apiKey || "",
      appName: env.flyio?.appName || `ngx-ramblers-${env.environment}`,
      memory: env.flyio?.memory || FLYIO_DEFAULTS.MEMORY,
      scaleCount: env.flyio?.scaleCount || FLYIO_DEFAULTS.SCALE_COUNT,
      organisation: env.flyio?.organisation || FLYIO_DEFAULTS.ORGANISATION
    }))
    .filter((env, index, arr) => arr.findIndex(e => e.appName === env.appName) === index);

  return {
    environments,
    region: "lhr",
    dockerImage: "nbarrett36/ngx-ramblers:latest"
  };
}

export async function reconcileConfigs(): Promise<ReconciliationReport> {
  debugLog("Starting reconciliation...");

  const localConfig = loadConfigsJson();
  debugLog("Local configs.json has %d environments", localConfig.environments.length);

  const dbConfig = await configuredEnvironments();
  debugLog("Database has %d environments", dbConfig.environments?.length || 0);

  const allEnvNames = new Set<string>();
  localConfig.environments.forEach(env => allEnvNames.add(env.name));
  dbConfig.environments?.forEach(env => allEnvNames.add(env.environment));

  const results: ReconciliationResult[] = [];

  allEnvNames.forEach(envName => {
    const localEnv = localConfig.environments.find(e => e.name === envName);
    const dbEnv = dbConfig.environments?.find(e => e.environment === envName);

    const differences: string[] = [];
    let databaseConfig: DeployEnvironmentConfig | undefined;

    if (dbEnv) {
      databaseConfig = {
        name: dbEnv.environment,
        apiKey: dbEnv.flyio?.apiKey || "",
        appName: dbEnv.flyio?.appName || `ngx-ramblers-${dbEnv.environment}`,
        memory: dbEnv.flyio?.memory || FLYIO_DEFAULTS.MEMORY,
        scaleCount: dbEnv.flyio?.scaleCount || FLYIO_DEFAULTS.SCALE_COUNT,
        organisation: dbEnv.flyio?.organisation || FLYIO_DEFAULTS.ORGANISATION
      };
    }

    if (localEnv && databaseConfig) {
      if ((localEnv.apiKey || "") !== (databaseConfig.apiKey || "")) {
        const localHas = localEnv.apiKey ? "yes" : "no";
        const dbHas = databaseConfig.apiKey ? "yes" : "no";
        differences.push(`apiKey: local=${localHas}, db=${dbHas}`);
      }
      if ((localEnv.appName || "") !== (databaseConfig.appName || "")) {
        differences.push(`appName: local=${localEnv.appName}, db=${databaseConfig.appName}`);
      }
      if ((localEnv.memory || "") !== (databaseConfig.memory || "")) {
        differences.push(`memory: local=${localEnv.memory}, db=${databaseConfig.memory}`);
      }
      if ((localEnv.scaleCount || 1) !== (databaseConfig.scaleCount || 1)) {
        differences.push(`scaleCount: local=${localEnv.scaleCount}, db=${databaseConfig.scaleCount}`);
      }
      if ((localEnv.organisation || "") !== (databaseConfig.organisation || "")) {
        differences.push(`organisation: local=${localEnv.organisation}, db=${databaseConfig.organisation}`);
      }
    }

    results.push({
      environment: envName,
      inDatabase: !!dbEnv,
      inConfigsJson: !!localEnv,
      differences,
      databaseConfig,
      localConfig: localEnv
    });
  });

  const matching = results.filter(r => r.inDatabase && r.inConfigsJson && r.differences.length === 0).length;
  const differing = results.filter(r => r.inDatabase && r.inConfigsJson && r.differences.length > 0).length;
  const missingFromLocal = results.filter(r => r.inDatabase && !r.inConfigsJson).length;
  const missingFromDatabase = results.filter(r => !r.inDatabase && r.inConfigsJson).length;

  return {
    localCount: localConfig.environments.length,
    databaseCount: dbConfig.environments?.length || 0,
    results,
    matching,
    differing,
    missingFromLocal,
    missingFromDatabase
  };
}

export async function syncDatabaseToLocal(): Promise<DeploymentConfig> {
  debugLog("Syncing database to local configs.json...");

  const dbConfig = await configuredEnvironments();
  const deployConfig = transformDatabaseToDeployConfig(dbConfig);

  saveConfigsJson(deployConfig);
  debugLog("Saved configs.json with %d environments", deployConfig.environments.length);

  return deployConfig;
}

export function updateGitHubSecret(): void {
  debugLog("Updating GitHub CONFIGS_JSON secret...");

  const config = loadConfigsJson();
  const configJson = JSON.stringify(config);

  try {
    execSync(`gh secret set CONFIGS_JSON --repo nbarrett/ngx-ramblers`, {
      input: configJson,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"]
    });
    debugLog("Successfully updated GitHub CONFIGS_JSON secret");
  } catch (error) {
    throw new Error(`Failed to update GitHub secret: ${error.message}`);
  }
}

export async function syncDatabaseToGitHub(): Promise<{ environmentCount: number; configJson: string }> {
  debugLog("Syncing database to GitHub...");

  const dbConfig = await configuredEnvironments();
  const deployConfig = transformDatabaseToDeployConfig(dbConfig);
  const configJson = JSON.stringify(deployConfig);

  try {
    execSync(`gh secret set CONFIGS_JSON --repo nbarrett/ngx-ramblers`, {
      input: configJson,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"]
    });
    debugLog("Successfully updated GitHub CONFIGS_JSON secret with %d environments", deployConfig.environments.length);
  } catch (error) {
    throw new Error(`Failed to update GitHub secret: ${error.message}`);
  }

  return { environmentCount: deployConfig.environments.length, configJson };
}

export function createGitHubCommand(): Command {
  const github = new Command("github")
    .alias("gh")
    .description("GitHub secrets management commands");

  github
    .command("reconcile")
    .description("Compare database environments with local configs.json")
    .action(async () => {
      try {
        const report = await reconcileConfigs();

        log("\n=== RECONCILIATION REPORT ===\n");
        log("Local configs.json: %d environments", report.localCount);
        log("Database: %d environments", report.databaseCount);
        log("\n--- Details ---\n");

        report.results.forEach(r => {
          let status: string;
          if (r.inDatabase && r.inConfigsJson) {
            status = r.differences.length === 0 ? "✓ MATCH" : "⚠ DIFFERS";
          } else if (r.inDatabase && !r.inConfigsJson) {
            status = "❌ MISSING FROM configs.json";
          } else if (!r.inDatabase && r.inConfigsJson) {
            status = "❌ MISSING FROM database";
          } else {
            status = "? UNKNOWN";
          }

          log("%s: %s", r.environment, status);
          r.differences.forEach(d => log("    - %s", d));
        });

        log("\n--- Summary ---");
        log("Matching: %d", report.matching);
        log("Differs: %d", report.differing);
        log("Missing from configs.json: %d", report.missingFromLocal);
        log("Missing from database: %d", report.missingFromDatabase);
      } catch (error) {
        log("Error: %s", error.message);
        process.exit(1);
      }
    });

  github
    .command("sync")
    .description("Sync database environments to local configs.json and GitHub secret")
    .option("--local-only", "Only update local configs.json, do not push to GitHub")
    .option("--dry-run", "Show what would be synced without making changes")
    .action(async (options) => {
      try {
        if (options.dryRun) {
          log("DRY RUN - showing what would be synced\n");
          const report = await reconcileConfigs();

          log("Would sync %d environments from database:", report.databaseCount);
          report.results
            .filter(r => r.inDatabase)
            .forEach(r => {
              log("  - %s (%s)", r.environment, r.databaseConfig?.appName);
            });

          if (!options.localOnly) {
            log("\nWould update GitHub CONFIGS_JSON secret");
          }
          return;
        }

        log("Syncing database to local configs.json...");
        const deployConfig = await syncDatabaseToLocal();
        log("✓ Updated configs.json with %d environments", deployConfig.environments.length);

        if (!options.localOnly) {
          log("Updating GitHub CONFIGS_JSON secret...");
          updateGitHubSecret();
          log("✓ Updated GitHub secret");
        }

        log("\n✓ Sync completed successfully");
      } catch (error) {
        log("Error: %s", error.message);
        process.exit(1);
      }
    });

  github
    .command("push")
    .description("Push current local configs.json to GitHub secret")
    .action(async () => {
      try {
        log("Pushing configs.json to GitHub...");
        updateGitHubSecret();
        log("✓ Updated GitHub CONFIGS_JSON secret");
      } catch (error) {
        log("Error: %s", error.message);
        process.exit(1);
      }
    });

  return github;
}
