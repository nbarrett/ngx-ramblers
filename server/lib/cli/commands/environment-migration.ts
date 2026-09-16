import { Command } from "commander";
import inquirer from "inquirer";
import mongoose from "mongoose";
import { error as logError, log } from "../cli-logger";
import { connect } from "../../mongo/mongoose-client";
import { EnvironmentMigrationService } from "../../backup/environment-migration-service";
import {
  EnvironmentMigrationAwsTarget,
  EnvironmentMigrationMode
} from "../../../../projects/ngx-ramblers/src/app/models/environment-migration.model";
import { AWS_DEFAULTS } from "../../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { Environment } from "../../../../projects/ngx-ramblers/src/app/models/environment.model";

function errorMessage(error: any): string {
  return error?.message || "Environment migration command failed";
}

async function closeConnection(): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
  }
}

async function confirmationFor(environmentName: string, confirmation: string | null): Promise<string> {
  if (confirmation) {
    return confirmation;
  }
  const response = await inquirer.prompt([
    {
      type: "input",
      name: "confirmEnvironment",
      message: `Type ${environmentName} to confirm restore with --drop:`
    }
  ]);
  return response.confirmEnvironment;
}

async function targetPasswordFor(options: any): Promise<string> {
  if (options.targetPassword) {
    return options.targetPassword;
  }
  const response = await inquirer.prompt([
    {
      type: "password",
      name: "targetPassword",
      message: "Target MongoDB password:",
      mask: "*",
      validate: (value: string) => value.length > 0 || "Target MongoDB password is required"
    }
  ]);
  return response.targetPassword;
}

export function targetAwsFrom(options: any, env: NodeJS.ProcessEnv = process.env): EnvironmentMigrationAwsTarget | null {
  const secretAccessKey = options.targetSecretAccessKey || env[Environment.MIGRATION_TARGET_AWS_SECRET_ACCESS_KEY] || "";
  const supplied = [options.targetBucket, options.targetAccessKeyId, secretAccessKey].filter(value => !!value);
  if (supplied.length === 0) {
    return null;
  } else if (supplied.length < 3) {
    throw new Error(`--target-bucket, --target-access-key-id and --target-secret-access-key (or ${Environment.MIGRATION_TARGET_AWS_SECRET_ACCESS_KEY}) must be supplied together for a live S3 copy`);
  } else {
    return {
      bucket: options.targetBucket,
      region: options.targetRegion || AWS_DEFAULTS.REGION,
      accessKeyId: options.targetAccessKeyId,
      secretAccessKey
    };
  }
}

async function runMongoMigration(environmentName: string, options: any): Promise<void> {
  try {
    const targetAws = targetAwsFrom(options);
    await connect();
    const execute = options.execute === true;
    const confirmEnvironment = execute ? await confirmationFor(environmentName, options.confirm || null) : null;
    const targetPassword = await targetPasswordFor(options);
    const service = new EnvironmentMigrationService();
    const migration = await service.executeMongoOnlyMigration({
      environment: environmentName,
      mode: targetAws ? EnvironmentMigrationMode.MONGO_AND_S3 : EnvironmentMigrationMode.MONGO_ONLY,
      dryRun: !execute,
      backupPath: options.backupPath,
      confirmEnvironment,
      rotateCredentials: options.rotateCredentials === true,
      rotateS3Credentials: !!targetAws,
      targetMongo: {
        cluster: options.targetCluster,
        db: options.targetDb,
        username: options.targetUsername,
        password: targetPassword
      },
      ...(targetAws ? { targetAws } : {}),
      user: "cli"
    });

    log("");
    log(`Migration: ${migration.migrationId}`);
    log(`Status: ${migration.status}`);
    log(`Phase: ${migration.phase}`);
    log(`Source: ${migration.sourceMongo.uriSummary}`);
    log(`Target: ${migration.targetMongo.uriSummary}`);
    if (migration.backupPath) {
      log(`Backup used: ${migration.backupPath}`);
    }
    if (migration.verification) {
      log(`Collections: ${migration.verification.collections.length}`);
      log(`Documents: ${migration.verification.totalDocumentCount}`);
      log(`Group: ${migration.verification.systemGroupIdentity?.shortName || migration.verification.systemGroupIdentity?.groupCode || "unknown"}`);
    }
    if (!execute) {
      log("");
      log("Dry run complete. Re-run with --execute to dump, restore with --drop, and verify the target.");
    } else if (migration.status !== "rotated") {
      log("");
      log("Restore verified. Credentials have not been rotated unless --rotate-credentials was supplied.");
    }
    log("");
  } catch (error) {
    logError(`Environment migration failed: ${errorMessage(error)}`);
  } finally {
    await closeConnection();
  }
}

async function rotateMongoCredentials(environmentName: string, migrationId: string, options: any): Promise<void> {
  try {
    const targetAws = targetAwsFrom(options);
    await connect();
    const confirmEnvironment = await confirmationFor(environmentName, options.confirm || null);
    const targetPassword = await targetPasswordFor(options);
    const service = new EnvironmentMigrationService();
    const migration = await service.rotateCredentials({
      migrationId,
      confirmEnvironment,
      targetMongo: {
        cluster: options.targetCluster,
        db: options.targetDb,
        username: options.targetUsername,
        password: targetPassword
      },
      ...(targetAws ? { targetAws } : {}),
      user: "cli"
    });
    log("");
    log(`Migration: ${migration.migrationId}`);
    log(`Status: ${migration.status}`);
    log(`Rotated at: ${migration.rotatedAt}`);
    log("");
  } catch (error) {
    logError(`Credential rotation failed: ${errorMessage(error)}`);
  } finally {
    await closeConnection();
  }
}

function withTargetOptions(command: Command): Command {
  return command
    .requiredOption("--target-cluster <cluster>", "Target MongoDB Atlas cluster host prefix")
    .requiredOption("--target-db <db>", "Target MongoDB database")
    .requiredOption("--target-username <username>", "Target MongoDB username")
    .option("--target-password <password>", "Target MongoDB password; prompts when omitted")
    .option("--confirm <environment>", "Typed environment confirmation")
    .option("--target-bucket <bucket>", "Destination S3 bucket for a live copy")
    .option("--target-region <region>", `Destination AWS region (default ${AWS_DEFAULTS.REGION})`)
    .option("--target-access-key-id <key>", "Destination AWS access key id")
    .option("--target-secret-access-key <secret>", `Destination AWS secret access key; ${Environment.MIGRATION_TARGET_AWS_SECRET_ACCESS_KEY} is read when omitted`);
}

export function createEnvironmentMigrationCommand(): Command {
  const cmd = new Command("environment-migration")
    .alias("env-migration")
    .description("Environment migration commands");

  withTargetOptions(cmd
    .command("mongo <environment>")
    .description("Validate or execute an environment migration, with a live S3 copy when the destination AWS flags are supplied"))
    .option("--backup-path <path>", "Use an existing local mongodump path instead of dumping source")
    .option("--execute", "Execute mongodump and mongorestore --drop")
    .option("--rotate-credentials", "Rotate ConfigKey.ENVIRONMENTS after successful verification")
    .action(async (environment: string, options: any) => {
      await runMongoMigration(environment, options);
    });

  withTargetOptions(cmd
    .command("rotate-mongo <environment> <migration-id>")
    .description("Rotate Mongo (and, for a live S3 copy, AWS) credentials after a verified migration"))
    .action(async (environment: string, migrationId: string, options: any) => {
      await rotateMongoCredentials(environment, migrationId, options);
    });

  return cmd;
}
