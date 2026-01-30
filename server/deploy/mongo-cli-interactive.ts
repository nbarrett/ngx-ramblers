import { confirm, input, select } from "@inquirer/prompts";
import * as fs from "fs/promises";
import * as path from "path";
import { spawn } from "child_process";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { DateTime } from "luxon";
import {
  RamblersWalksManagerDateFormat as DateFormat
} from "../../projects/ngx-ramblers/src/app/models/date-format.model";
import type { EnvironmentConfig } from "./types.js";
import { getAwsConfigForEnvironment, loadConfigs } from "./config-loader.js";
import { isUndefined } from "es-toolkit/compat";
import { dateTimeFromJsDate, dateTimeNow } from "../lib/shared/dates";

interface BackupAnswers {
  environment: string;
  database?: string;
  collections?: string[];
  scaleDown: boolean;
  upload: boolean;
}

interface RestoreAnswers {
  environment: string;
  from: string;
  database?: string;
  collections?: string[];
  drop: boolean;
  dryRun: boolean;
}

async function main() {
  const configs: EnvironmentConfig[] = await loadConfigs();
  const dumpBaseDir = path.join(process.cwd(), "../non-vcs/dump");

  console.log("\n🗄️  MongoDB Backup & Restore CLI\n");

  while (true) {
    const action = await select({
      message: "What would you like to do?",
      choices: [
        { name: "📦 Create a backup", value: "backup" },
        { name: "♻️  Restore from backup", value: "restore" },
        { name: "📋 List backups", value: "list" },
        { name: "🌍 List environments", value: "environments" },
        { name: "❌ Exit", value: "exit" }
      ]
    });

    if (action === "exit") {
      console.log("\n👋 Goodbye!\n");
      process.exit(0);
    }

    if (action === "list") {
      await listBackups(dumpBaseDir);
      continue;
    }

    if (action === "environments") {
      listEnvironments(configs);
      continue;
    }

    if (action === "backup") {
      await runBackup(configs, dumpBaseDir);
    } else if (action === "restore") {
      await runRestore(configs, dumpBaseDir);
    }

    console.log("\n");
  }
}

async function runBackup(configs: EnvironmentConfig[], dumpBaseDir: string) {
  const envChoices = configs
    .filter(c => c.mongo)
    .map(c => ({
      name: `${c.name} (${c.mongo!.db})`,
      value: c.name
    }));

  if (envChoices.length === 0) {
    console.log("❌ No environments with MongoDB configuration found!");
    process.exit(1);
  }

  const environment = await select({
    message: "Select environment to backup:",
    choices: [
      ...envChoices,
      { name: "🔄 All environments", value: "all" }
    ]
  });

  const config = configs.find(c => c.name === environment);
  const database = config?.mongo?.db;

  const collectionsInput = await input({
    message: "Collections to backup (comma-separated, leave empty for all):",
    default: ""
  });

  const collections = collectionsInput
    ? collectionsInput.split(",").map(c => c.trim()).filter(Boolean)
    : undefined;

  const scaleDown = await confirm({
    message: "Scale down Fly.io app during backup?",
    default: false
  });

  const upload = await confirm({
    message: "Upload backup to S3?",
    default: false
  });

  console.log("\n📦 Starting backup...\n");

  const envs = environment === "all" ? configs.filter(c => c.mongo) : [config!];

  for (const env of envs) {
    if (!env.mongo) continue;

    const dbName = database || env.mongo.db;
    const timestamp = dateTimeNow().toFormat(DateFormat.FILE_TIMESTAMP);
    const backupName = `${timestamp}-${env.name}-${dbName}`;
    const outDir = path.join(dumpBaseDir, "backups", backupName);

    await fs.mkdir(outDir, { recursive: true });

    const dumpArgs = [
      "--uri", env.mongo.uri,
      "--username", env.mongo.username,
      "--password", env.mongo.password,
      "--db", dbName,
      "--gzip",
      "--out", outDir
    ];

    if (collections && collections.length > 0) {
      for (const collection of collections) {
        dumpArgs.push("--collection", collection);
      }
    }

    let originalScaleCount: number | undefined;
    if (scaleDown) {
      originalScaleCount = env.scaleCount;
      console.log(`⏬ Scaling down ${env.name}...`);
      await execCommand("flyctl", ["scale", "count", "0", "--app", env.appName]);
    }

    try {
      console.log(`💾 Running mongodump for ${env.name}...`);
      await execCommand("mongodump", dumpArgs);
      console.log(`✅ Backup completed: ${outDir}`);

      if (upload) {
        const awsConfig = await getAwsConfigForEnvironment(env.name);
        const s3Bucket = awsConfig?.bucket || process.env.AWS_BUCKET;
        const s3Region = awsConfig?.region || process.env.AWS_REGION || "us-east-1";
        const s3AccessKeyId = awsConfig?.accessKeyId || process.env.AWS_ACCESS_KEY_ID;
        const s3SecretAccessKey = awsConfig?.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY;

        if (!s3Bucket) {
          console.error(`\n❌ No S3 bucket configured for ${env.name}`);
          continue;
        }

        console.log(`☁️  Uploading to S3 (${s3Bucket})...`);
        const s3Config: any = { region: s3Region };
        if (s3AccessKeyId && s3SecretAccessKey) {
          s3Config.credentials = {
            accessKeyId: s3AccessKeyId,
            secretAccessKey: s3SecretAccessKey
          };
        }
        const s3 = new S3Client(s3Config);
        const s3Key = path.join("backups", backupName).replace(/\\/g, "/");
        await uploadDirToS3(s3, outDir, s3Bucket, s3Key);
        console.log(`✅ Uploaded to s3://${s3Bucket}/${s3Key}`);
      }
    } finally {
      if (scaleDown && !isUndefined(originalScaleCount)) {
        console.log(`⏫ Restoring scale count for ${env.name}...`);
        await execCommand("flyctl", ["scale", "count", originalScaleCount.toString(), "--app", env.appName]);
      }
    }
  }

  console.log("\n✨ All backups completed!\n");
}

async function runRestore(configs: EnvironmentConfig[], dumpBaseDir: string) {
  const backups = await listBackupsForSelection(dumpBaseDir);

  if (backups.length === 0) {
    console.log("❌ No backups found!");
    process.exit(1);
  }

  const from = await select({
    message: "Select backup to restore:",
    choices: backups.map(b => ({
      name: `${b.name} (${dateTimeFromJsDate(b.timestamp).toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS)})`,
      value: b.path
    })),
    pageSize: 15
  });

  const envChoices = configs
    .filter(c => c.mongo)
    .map(c => ({
      name: `${c.name} (${c.mongo!.db})`,
      value: c.name
    }));

  const environment = await select({
    message: "Select target environment:",
    choices: envChoices
  });

  const config = configs.find(c => c.name === environment)!;

  const collectionsInput = await input({
    message: "Collections to restore (comma-separated, leave empty for all):",
    default: ""
  });

  const collections = collectionsInput
    ? collectionsInput.split(",").map(c => c.trim()).filter(Boolean)
    : undefined;

  const drop = await confirm({
    message: "Drop collections before restore?",
    default: true
  });

  const dryRun = await confirm({
    message: "Dry run (simulate only)?",
    default: false
  });

  if (!dryRun) {
    const confirmRestore = await confirm({
      message: `⚠️  This will modify ${environment}. Are you sure?`,
      default: false
    });

    if (!confirmRestore) {
      console.log("❌ Restore cancelled.");
      return;
    }
  }

  const fromPath = path.join(dumpBaseDir, from);
  const dbName = config.mongo!.db;

  const restoreArgs = [
    "--uri", config.mongo!.uri,
    "--username", config.mongo!.username,
    "--password", config.mongo!.password,
    "--db", dbName,
    "--gzip"
  ];

  if (drop) {
    restoreArgs.push("--drop");
  }

  if (collections && collections.length > 0) {
    for (const collection of collections) {
      const collectionPath = path.join(fromPath, dbName, `${collection}.bson.gz`);
      try {
        await fs.access(collectionPath);
        restoreArgs.push("--collection", collection);
        restoreArgs.push(collectionPath);
      } catch {
        console.error(`❌ Collection file not found: ${collectionPath}`);
        process.exit(1);
      }
    }
  } else {
    restoreArgs.push(fromPath);
  }

  if (dryRun) {
    console.log("\n🔍 DRY RUN - Would execute:");
    console.log(`mongorestore ${restoreArgs.join(" ")}\n`);
    return;
  }

  console.log("\n♻️  Starting restore...\n");
  await execCommand("mongorestore", restoreArgs);
  console.log(`\n✅ Restore completed to ${environment}!\n`);
}

async function listBackups(dumpBaseDir: string) {
  const backupsDir = path.join(dumpBaseDir, "backups");
  try {
    const entries = await fs.readdir(backupsDir);
    const backups = [];

    for (const entry of entries) {
      const entryPath = path.join(backupsDir, entry);
      const stat = await fs.stat(entryPath);
      if (stat.isDirectory()) {
        backups.push({
          name: entry,
          timestamp: stat.mtime,
          path: `backups/${entry}`
        });
      }
    }

    if (backups.length === 0) {
      console.log("📋 No backups found.\n");
      return;
    }

    backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    console.log("\n📋 Available Backups:\n");
    backups.forEach((backup, index) => {
      console.log(`${index + 1}. ${backup.name}`);
      console.log(`   Created: ${backup.timestamp.toLocaleString()}\n`);
    });
  } catch {
    console.log("📋 No backups found.\n");
  }
}

async function listBackupsForSelection(dumpBaseDir: string): Promise<{
  name: string;
  path: string;
  timestamp: Date
}[]> {
  const backupsDir = path.join(dumpBaseDir, "backups");
  try {
    const entries = await fs.readdir(backupsDir);
    const backups = [];

    for (const entry of entries) {
      const entryPath = path.join(backupsDir, entry);
      const stat = await fs.stat(entryPath);
      if (stat.isDirectory()) {
        backups.push({
          name: entry,
          path: `backups/${entry}`,
          timestamp: stat.mtime
        });
      }
    }

    return backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  } catch {
    return [];
  }
}

function listEnvironments(configs: EnvironmentConfig[]) {
  console.log("\n🌍 Configured Environments:\n");
  configs.forEach((config, index) => {
    const hasMongoString = config.mongo ? `✅ ${config.mongo.db}` : "❌ No MongoDB";
    console.log(`${index + 1}. ${config.name} - ${hasMongoString}`);
  });
  console.log();
}

async function execCommand(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: "inherit" });
    proc.on("close", (code: number) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${cmd} exited with code ${code}`));
      }
    });
    proc.on("error", error => reject(error));
  });
}

async function uploadDirToS3(s3: S3Client, localDir: string, bucket: string, prefix: string): Promise<void> {
  const entries = await fs.readdir(localDir);
  for (const entry of entries) {
    const localPath = path.join(localDir, entry);
    const stat = await fs.stat(localPath);
    const key = path.join(prefix, entry).replace(/\\/g, "/");

    if (stat.isDirectory()) {
      await uploadDirToS3(s3, localPath, bucket, key);
    } else {
      const fileContent = await fs.readFile(localPath);
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: fileContent,
        ContentType: entry.endsWith(".gz") ? "application/gzip" : "application/octet-stream"
      }));
      process.stdout.write(".");
    }
  }
}

main().catch(error => {
  console.error("\n❌ Fatal error:", error);
  process.exit(1);
});
