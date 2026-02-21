import { Command } from "commander";
import { spawn } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import { S3Client } from "@aws-sdk/client-s3";
import { dateTimeNow } from "../lib/shared/dates";
import {
  RamblersWalksManagerDateFormat as DateFormat
} from "../../projects/ngx-ramblers/src/app/models/date-format.model";
import type { BackupOptions, EnvironmentConfig, RestoreOptions } from "./types.js";
import { buildMongoUri } from "../lib/shared/mongodb-uri";
import { isUndefined } from "es-toolkit/compat";
import { uploadDirectoryToS3 } from "../lib/aws/s3-utils";
import { cliLogger } from "../lib/cli/cli-logger";

async function main() {
  const program = new Command();
  const configsPath: string = path.join(process.cwd(), "../non-vcs/fly-io/configs.json");
  const configsRaw: string = await fs.readFile(configsPath, "utf8");
  const configs: EnvironmentConfig[] = JSON.parse(configsRaw).environments;

  const dumpBaseDir: string = path.join(process.cwd(), "../non-vcs/dump");

  function execCmd(cmd: string, args: string[], callback: (err?: string) => void): void {
    cliLogger.log(`Running: ${cmd} ${args.join(" ")}`);
    const proc = spawn(cmd, args, {stdio: "inherit"});
    proc.on("close", (code: number) => callback(code === 0 ? undefined : `Error: Exit ${code}`));
  }

  function getMongoAuth(config: EnvironmentConfig, database: string): string[] {
    const mongo = config.mongo!;
    const uri = buildMongoUri({
      cluster: mongo.cluster,
      username: mongo.username,
      password: mongo.password,
      database
    });
    return ["--uri", uri];
  }

  function scaleApp(envName: string, scaleCount: number | string, callback: (err?: string) => void): void {
    const config: EnvironmentConfig | undefined = configs.find(c => c.name === envName);
    if (!config) return callback("Env not found");
    execCmd("flyctl", ["scale", "count", scaleCount.toString(), "--app", config.appName], callback);
  }

  program
    .name("mongo-cli")
    .description("MongoDB backup and restore CLI for NGX-Ramblers")
    .version("1.0.0");

  program
    .command("backup")
    .description("Backup DB/collections from env(s)")
    .requiredOption("--env <env>", "Env name (e.g., ekwg-prod) or \"all\" for all envs")
    .option("--db <db>", "Specific DB (default: from config)")
    .option("--collections <list>", "Comma-separated collections (default: all)")
    .option("--scale-down", "Scale to 0 during backup (revert after)", false)
    .option("--upload", "Upload backup to S3 (uses AWS_BUCKET and AWS_REGION env vars)", false)
    .action(async (rawOptions: BackupOptions) => {
      const envs: EnvironmentConfig[] = rawOptions.env === "all" ? configs : configs.filter(c => c.name === rawOptions.env);

      if (envs.length === 0) {
        console.error(`Environment "${rawOptions.env}" not found`);
        process.exit(1);
      }

      if (rawOptions.upload) {
        if (!process.env.AWS_BUCKET || !process.env.AWS_REGION) {
          console.error("AWS_BUCKET and AWS_REGION environment variables must be set when --upload is specified");
          process.exit(1);
        }
      }

      for (const config of envs) {
        if (!config.mongo) {
          cliLogger.log(`Skipping ${config.name}: no mongo config`);
          continue;
        }

        const dbName: string = rawOptions.db || config.mongo.db;
        const timestamp: string = dateTimeNow().toFormat(DateFormat.FILE_TIMESTAMP);
        const backupName: string = `${timestamp}-${config.name}-${dbName}`;
        const outDir: string = path.join(dumpBaseDir, "backups", backupName);

        await fs.mkdir(outDir, {recursive: true});

        const dumpArgs: string[] = [
          ...getMongoAuth(config, dbName),
          "--gzip",
          "--out", outDir
        ];

        if (rawOptions.collections) {
          const collectionList: string[] = rawOptions.collections.split(",");
          for (const collection of collectionList) {
            dumpArgs.push("--collection", collection.trim());
          }
        }

        let originalScaleCount: number | undefined;
        if (rawOptions.scaleDown) {
          originalScaleCount = config.scaleCount;
          await new Promise<void>((resolve, reject) => {
            scaleApp(config.name, 0, err => {
              if (err) return reject(new Error(err));
              cliLogger.log(`Scaled down ${config.name}`);
              resolve();
            });
          });
        }

        try {
          await new Promise<void>((resolve, reject) => {
            execCmd("mongodump", dumpArgs, err => {
              if (err) return reject(new Error(err));
              resolve();
            });
          });

          cliLogger.log(`Backup completed: ${outDir}`);

          if (rawOptions.upload) {
            const s3Bucket = process.env.AWS_BUCKET!;
            const s3Region = process.env.AWS_REGION!;
            const s3: S3Client = new S3Client({region: s3Region});
            const s3Key: string = path.join("backups", backupName).replace(/\\/g, "/");
            await uploadDirectoryToS3(s3, outDir, s3Bucket, s3Key, (bucketName, key) => cliLogger.log(`Uploaded: s3://${bucketName}/${key}`));
            cliLogger.log(`Uploaded to s3://${s3Bucket}/${s3Key}`);
          }
        } finally {
          if (rawOptions.scaleDown && !isUndefined(originalScaleCount)) {
            await new Promise<void>((resolve, reject) => {
              scaleApp(config.name, originalScaleCount, err => {
                if (err) return reject(new Error(err));
                cliLogger.log(`Restored scale count for ${config.name}`);
                resolve();
              });
            });
          }
        }
      }
    });

  program
    .command("restore")
    .description("Restore DB/collections to an env")
    .requiredOption("--env <env>", "Target env name")
    .requiredOption("--from <path>", "Dump directory name (e.g., backups/2025-10-29-ekwg-prod)")
    .option("--db <db>", "Target DB (default: from config)")
    .option("--collections <list>", "Comma-separated collections to restore (default: all)")
    .option("--drop", "Drop collections before restore", true)
    .option("--dry-run", "Simulate restore without making changes", false)
    .action(async (rawOptions: RestoreOptions) => {
      const config: EnvironmentConfig | undefined = configs.find(c => c.name === rawOptions.env);

      if (!config) {
        console.error(`Environment "${rawOptions.env}" not found`);
        process.exit(1);
      }

      if (!config.mongo) {
        console.error(`Environment "${rawOptions.env}" has no mongo config`);
        process.exit(1);
      }

      const fromPath: string = path.join(dumpBaseDir, rawOptions.from);

      try {
        await fs.access(fromPath);
      } catch {
        console.error(`Dump directory not found: ${fromPath}`);
        process.exit(1);
      }

      const dbName: string = rawOptions.db || config.mongo.db;
      const restoreArgs: string[] = [
        ...getMongoAuth(config, dbName),
        "--gzip"
      ];

      if (rawOptions.drop) {
        restoreArgs.push("--drop");
      }

      if (rawOptions.collections) {
        const collectionList: string[] = rawOptions.collections.split(",");
        for (const collection of collectionList) {
          const collectionPath: string = path.join(fromPath, dbName, `${collection.trim()}.bson.gz`);
          try {
            await fs.access(collectionPath);
            restoreArgs.push("--collection", collection.trim());
            restoreArgs.push(collectionPath);
          } catch {
            console.error(`Collection file not found: ${collectionPath}`);
            process.exit(1);
          }
        }
      } else {
        restoreArgs.push(fromPath);
      }

      if (rawOptions.dryRun) {
        cliLogger.log("DRY RUN - Would execute:");
        cliLogger.log(`mongorestore ${restoreArgs.join(" ")}`);
        return;
      }

      await new Promise<void>((resolve, reject) => {
        execCmd("mongorestore", restoreArgs, err => {
          if (err) return reject(new Error(err));
          resolve();
        });
      });

      cliLogger.log(`Restore completed to ${rawOptions.env}`);
    });

  await program.parseAsync(process.argv);
}

main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});
