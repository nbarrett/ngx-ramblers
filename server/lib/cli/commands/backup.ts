import { Command } from "commander";
import debug from "debug";
import inquirer from "inquirer";
import mongoose from "mongoose";
import { envConfig } from "../../env-config/env-config";
import { ProgressCallback } from "../types";
import { log, error as logError } from "../cli-logger";
import { BackupAndRestoreService, BackupOptions, RestoreOptions } from "../../backup/backup-and-restore-service";
import { loadConfigsJson } from "../../shared/configs-json";
import * as configController from "../../mongo/controllers/config";
import { ConfigKey } from "../../../../projects/ngx-ramblers/src/app/models/config.model";
import { BackupConfig } from "../../../../projects/ngx-ramblers/src/app/models/backup-session.model";
import { connect } from "../../mongo/mongoose-client";

const debugLog = debug(envConfig.logNamespace("cli:backup"));

async function getBackupConfig(): Promise<BackupConfig> {
  await connect();
  const configDoc = await configController.queryKey(ConfigKey.BACKUP);
  return configDoc?.value || { environments: [] };
}

async function closeConnection(): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
  }
}

async function listEnvironments(): Promise<void> {
  try {
    const backupConfig = await getBackupConfig();
    const environments = backupConfig.environments || [];

    if (environments.length === 0) {
      log("\nNo environments configured for backup.\n");
      log("Configure environments in Admin > Backup & Restore > Settings\n");
    } else {
      log("\nConfigured backup environments:\n");
      environments.forEach(env => {
        log(`  ${env.environment}`);
        log(`    Database: ${env.mongo?.db || "not configured"}`);
        log(`    S3 Bucket: ${env.aws?.bucket || "not configured"}`);
        log("");
      });
    }
  } catch (error) {
    logError(`Failed to list environments: ${error.message}`);
  } finally {
    await closeConnection();
  }
}

async function selectEnvironment(backupConfig: BackupConfig): Promise<string | null> {
  const environments = backupConfig.environments || [];

  if (environments.length === 0) {
    logError("No environments configured for backup.");
    return null;
  }

  const choices = environments.map(env => ({
    name: `${env.environment} (${env.mongo?.db || "no db"})`,
    value: env.environment
  }));

  const { environment } = await inquirer.prompt([
    {
      type: "list",
      name: "environment",
      message: "Select environment:",
      choices
    }
  ]);

  return environment;
}

export async function createBackup(
  environmentName?: string,
  options: { upload?: boolean; collections?: string } = {},
  onProgress?: ProgressCallback
): Promise<void> {
  try {
    await connect();
    const backupConfig = await getBackupConfig();
    const configs = loadConfigsJson()?.environments || [];

    const targetEnv = environmentName || await selectEnvironment(backupConfig);
    if (!targetEnv) {
      return;
    }

    onProgress?.({ step: "backup", status: "running", message: `Starting backup of ${targetEnv}` });
    log(`\nStarting backup of environment: ${targetEnv}\n`);

    const service = new BackupAndRestoreService(configs, backupConfig);

    const backupOptions: BackupOptions = {
      environment: targetEnv,
      upload: options.upload !== false,
      collections: options.collections?.split(",").map(c => c.trim()),
      user: "cli"
    };

    const session = await service.startBackup(backupOptions);

    log(`✓ ` +`Backup started: ${session.sessionId}`);
    log(`\nMonitor progress in Admin > Backup & Restore\n`);

    onProgress?.({ step: "backup", status: "completed", message: `Backup started: ${session.sessionId}` });
  } catch (error) {
    logError(`Backup failed: ${error.message}`);
    onProgress?.({ step: "backup", status: "failed", message: error.message });
  } finally {
    await closeConnection();
  }
}

export async function restoreBackup(
  environmentName?: string,
  backupPath?: string,
  options: { drop?: boolean; dryRun?: boolean; collections?: string } = {},
  onProgress?: ProgressCallback
): Promise<void> {
  try {
    await connect();
    const backupConfig = await getBackupConfig();
    const configs = loadConfigsJson()?.environments || [];

    const targetEnv = environmentName || await selectEnvironment(backupConfig);
    if (!targetEnv) {
      return;
    }

    let fromPath = backupPath;
    if (!fromPath) {
      const { path: inputPath } = await inquirer.prompt([
        {
          type: "input",
          name: "path",
          message: "Enter backup path (local directory or s3://bucket/path):",
          validate: (input: string) => input.length > 0 || "Path is required"
        }
      ]);
      fromPath = inputPath;
    }

    if (!options.dryRun) {
      const { confirm } = await inquirer.prompt([
        {
          type: "confirm",
          name: "confirm",
          message: `This will restore data to ${targetEnv}. Continue?`,
          default: false
        }
      ]);

      if (!confirm) {
        log("Restore cancelled.");
        return;
      }
    }

    onProgress?.({ step: "restore", status: "running", message: `Starting restore to ${targetEnv}` });
    log(`\nStarting restore to environment: ${targetEnv}\n`);
    log(`From: ${fromPath}\n`);

    const service = new BackupAndRestoreService(configs, backupConfig);

    const restoreOptions: RestoreOptions = {
      environment: targetEnv,
      from: fromPath,
      drop: options.drop !== false,
      dryRun: options.dryRun,
      collections: options.collections?.split(",").map(c => c.trim()),
      user: "cli"
    };

    const session = await service.startRestore(restoreOptions);

    if (options.dryRun) {
      log(`✓ ` +`Dry run completed: ${session.sessionId}`);
    } else {
      log(`✓ ` +`Restore started: ${session.sessionId}`);
      log(`\nMonitor progress in Admin > Backup & Restore\n`);
    }

    onProgress?.({ step: "restore", status: "completed", message: `Restore started: ${session.sessionId}` });
  } catch (error) {
    logError(`Restore failed: ${error.message}`);
    onProgress?.({ step: "restore", status: "failed", message: error.message });
  } finally {
    await closeConnection();
  }
}

export function createBackupCommand(): Command {
  const cmd = new Command("backup")
    .alias("bak")
    .description("Backup and restore commands");

  cmd
    .command("list")
    .alias("ls")
    .description("List configured backup environments")
    .action(async () => {
      await listEnvironments();
    });

  cmd
    .command("create [environment]")
    .alias("c")
    .description("Create a backup of an environment")
    .option("--no-upload", "Don't upload to S3 (local only)")
    .option("--collections <collections>", "Comma-separated list of collections to backup")
    .action(async (environment: string | undefined, options: { upload?: boolean; collections?: string }) => {
      await createBackup(environment, options);
    });

  cmd
    .command("restore [environment] [path]")
    .alias("r")
    .description("Restore a backup to an environment")
    .option("--no-drop", "Don't drop existing collections before restore")
    .option("--dry-run", "Preview restore without making changes")
    .option("--collections <collections>", "Comma-separated list of collections to restore")
    .action(async (environment: string | undefined, path: string | undefined, options: { drop?: boolean; dryRun?: boolean; collections?: string }) => {
      await restoreBackup(environment, path, options);
    });

  return cmd;
}
