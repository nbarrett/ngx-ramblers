import { Command } from "commander";
import debug from "debug";
import inquirer from "inquirer";
import mongoose from "mongoose";
import { envConfig } from "../../env-config/env-config";
import { ProgressCallback } from "../types";
import { error as logError, log } from "../cli-logger";
import { BackupAndRestoreService, BackupOptions, RestoreOptions } from "../../backup/backup-and-restore-service";
import * as configController from "../../mongo/controllers/config";
import { ConfigKey } from "../../../../projects/ngx-ramblers/src/app/models/config.model";
import { BackupConfig, S3BackupRequest, S3RestoreRequest } from "../../../../projects/ngx-ramblers/src/app/models/backup-session.model";
import { connect } from "../../mongo/mongoose-client";
import * as s3BackupService from "../../backup/s3-backup-service";

const debugLog = debug(envConfig.logNamespace("cli:backup"));

async function getBackupConfig(): Promise<BackupConfig> {
  await connect();
  const configDoc = await configController.queryKey(ConfigKey.ENVIRONMENTS);
  if (configDoc?.value?.environments) {
    return { environments: configDoc.value.environments };
  }
  return { environments: [] };
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

    const targetEnv = environmentName || await selectEnvironment(backupConfig);
    if (!targetEnv) {
      return;
    }

    onProgress?.({ step: "backup", status: "running", message: `Starting backup of ${targetEnv}` });
    log(`\nStarting backup of environment: ${targetEnv}\n`);

    const service = new BackupAndRestoreService([], backupConfig);

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

    const service = new BackupAndRestoreService([], backupConfig);

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

export async function s3Backup(
  options: { site?: string; all?: boolean; mongoTimestamp?: string; dryRun?: boolean },
  onProgress?: ProgressCallback
): Promise<void> {
  try {
    await connect();

    if (!options.site && !options.all) {
      logError("Either --site <name> or --all is required");
      return;
    }

    const request: S3BackupRequest = {
      site: options.site,
      all: options.all,
      mongoTimestamp: options.mongoTimestamp,
      dryRun: options.dryRun
    };

    const label = options.all ? "all sites" : options.site;
    onProgress?.({ step: "s3-backup", status: "running", message: `Starting S3 incremental backup for ${label}` });
    log(`\nStarting S3 incremental backup for: ${label}\n`);

    if (options.dryRun) {
      log("DRY RUN - no objects will be copied\n");
    }

    const results = await s3BackupService.startS3Backup(request);

    results.forEach(result => {
      log(`  ${result.site}: ${result.status}`);
      log(`    Total objects: ${result.totalObjects}`);
      log(`    Copied: ${result.copiedObjects}`);
      log(`    Skipped (unchanged): ${result.skippedObjects}`);
      log(`    Copied size: ${formatBytes(result.copiedSizeBytes)}`);
      log(`    Duration: ${result.durationMs}ms`);
      log("");
    });

    onProgress?.({ step: "s3-backup", status: "completed", message: `S3 backup completed for ${label}` });
  } catch (error) {
    logError(`S3 backup failed: ${error.message}`);
    onProgress?.({ step: "s3-backup", status: "failed", message: error.message });
  } finally {
    await closeConnection();
  }
}

export async function s3Restore(
  options: { site?: string; all?: boolean; timestamp: string; dryRun?: boolean },
  onProgress?: ProgressCallback
): Promise<void> {
  try {
    await connect();

    if (!options.site && !options.all) {
      logError("Either --site <name> or --all is required");
      return;
    }

    if (!options.timestamp) {
      logError("--timestamp is required");
      return;
    }

    const request: S3RestoreRequest = {
      site: options.site,
      all: options.all,
      timestamp: options.timestamp,
      dryRun: options.dryRun
    };

    const label = options.all ? "all sites" : options.site;
    onProgress?.({ step: "s3-restore", status: "running", message: `Starting S3 restore for ${label} from ${options.timestamp}` });
    log(`\nStarting S3 restore for: ${label}`);
    log(`From timestamp: ${options.timestamp}\n`);

    if (options.dryRun) {
      log("DRY RUN - no objects will be modified\n");
    }

    if (!options.dryRun) {
      const { confirm } = await inquirer.prompt([
        {
          type: "confirm",
          name: "confirm",
          message: `This will restore S3 state to ${options.timestamp}. Continue?`,
          default: false
        }
      ]);

      if (!confirm) {
        log("Restore cancelled.");
        return;
      }
    }

    const results = await s3BackupService.startS3Restore(request);

    results.forEach(result => {
      log(`  ${result.site}: ${result.status}`);
      log(`    Restored: ${result.copiedObjects}`);
      log(`    Skipped (unchanged): ${result.skippedObjects}`);
      log(`    Duration: ${result.durationMs}ms`);
      log("");
    });

    onProgress?.({ step: "s3-restore", status: "completed", message: `S3 restore completed for ${label}` });
  } catch (error) {
    logError(`S3 restore failed: ${error.message}`);
    onProgress?.({ step: "s3-restore", status: "failed", message: error.message });
  } finally {
    await closeConnection();
  }
}

export async function listS3Manifests(site?: string): Promise<void> {
  try {
    await connect();
    const manifestsList = await s3BackupService.manifests(site, 20);

    if (manifestsList.length === 0) {
      log("\nNo S3 backup manifests found.\n");
    } else {
      log("\nS3 backup manifests:\n");
      manifestsList.forEach(m => {
        log(`  ${m.timestamp} - ${m.site}`);
        log(`    Status: ${m.status}`);
        log(`    Objects: ${m.totalObjects} total, ${m.copiedObjects} copied, ${m.skippedObjects} skipped`);
        log(`    Size: ${formatBytes(m.copiedSizeBytes)} copied of ${formatBytes(m.totalSizeBytes)} total`);
        log(`    Duration: ${m.durationMs}ms`);
        if (m.mongoTimestamp) {
          log(`    MongoDB timestamp: ${m.mongoTimestamp}`);
        }
        log("");
      });
    }
  } catch (error) {
    logError(`Failed to list manifests: ${error.message}`);
  } finally {
    await closeConnection();
  }
}

export async function listS3Sites(): Promise<void> {
  try {
    await connect();
    const sites = await s3BackupService.availableSites();

    if (sites.length === 0) {
      log("\nNo sites configured with S3 credentials.\n");
    } else {
      log("\nAvailable S3 backup sites:\n");
      sites.forEach(site => {
        log(`  ${site}`);
      });
      log("");
    }
  } catch (error) {
    logError(`Failed to list sites: ${error.message}`);
  } finally {
    await closeConnection();
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exp = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = (bytes / Math.pow(1024, exp)).toFixed(1);
  return `${size} ${units[exp]}`;
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

  const s3Cmd = cmd
    .command("s3")
    .description("Incremental S3 backup and restore commands");

  s3Cmd
    .command("backup")
    .description("Run incremental S3 backup for one or all sites")
    .option("--site <name>", "Backup a single site")
    .option("--all", "Backup all configured sites")
    .option("--mongo-timestamp <timestamp>", "Align with a MongoDB backup timestamp")
    .option("--dry-run", "Preview changes without copying objects")
    .action(async (options: { site?: string; all?: boolean; mongoTimestamp?: string; dryRun?: boolean }) => {
      await s3Backup(options);
    });

  s3Cmd
    .command("restore")
    .description("Restore S3 state from a specific timestamp")
    .option("--site <name>", "Restore a single site")
    .option("--all", "Restore all configured sites")
    .requiredOption("--timestamp <timestamp>", "Timestamp of the backup to restore from")
    .option("--dry-run", "Preview changes without modifying objects")
    .action(async (options: { site?: string; all?: boolean; timestamp: string; dryRun?: boolean }) => {
      await s3Restore(options);
    });

  s3Cmd
    .command("manifests")
    .description("List S3 backup manifests")
    .option("--site <name>", "Filter manifests by site")
    .action(async (options: { site?: string }) => {
      await listS3Manifests(options.site);
    });

  s3Cmd
    .command("sites")
    .description("List available S3 backup sites")
    .action(async () => {
      await listS3Sites();
    });

  return cmd;
}
