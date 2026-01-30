import debug from "debug";
import { ChildProcess, spawn } from "child_process";
import * as fs from "fs/promises";
import { createWriteStream } from "fs";
import * as path from "path";
import { envConfig } from "../env-config/env-config";
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { dateTimeFromMillis, dateTimeInTimezone, dateTimeNow, dateTimeNowAsValue } from "../shared/dates";
import { backupSession, BackupSession } from "../mongo/models/backup-session";
import { BackupNotificationService } from "./backup-notification-service";
import { BackupConfig } from "../../../projects/ngx-ramblers/src/app/models/backup-session.model";
import {
  RamblersWalksManagerDateFormat as DateFormat
} from "../../../projects/ngx-ramblers/src/app/models/date-format.model";
import { getEnvironmentConfig } from "./backup-config";
import type { EnvironmentConfig } from "../../deploy/types";
import { FLYIO_DEFAULTS } from "../../deploy/types";
import { NamedError } from "../../../projects/ngx-ramblers/src/app/models/api-response.model";
import { AWS_DEFAULTS } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { buildMongoUri } from "../shared/mongodb-uri";
import { isUndefined } from "es-toolkit/compat";

const debugLog = debug(envConfig.logNamespace("backup-and-restore-service"));
debugLog.enabled = true;

export interface BackupOptions {
  environment: string;
  database?: string;
  collections?: string[];
  scaleDown?: boolean;
  upload?: boolean;
  user?: string;
}

export interface RestoreOptions {
  environment: string;
  from: string;
  database?: string;
  collections?: string[];
  drop?: boolean;
  dryRun?: boolean;
  user?: string;
}

export class BackupAndRestoreService {
  private configs: EnvironmentConfig[];
  private dumpBaseDir: string;
  private notificationService?: BackupNotificationService;
  private backupConfig: BackupConfig;

  constructor(configs: EnvironmentConfig[], backupConfig: BackupConfig, dumpBaseDir?: string, notificationService?: BackupNotificationService) {
    this.configs = configs;
    this.backupConfig = backupConfig;
    this.dumpBaseDir = dumpBaseDir || path.join(process.cwd(), "../non-vcs/dump");
    this.notificationService = notificationService;
  }

  private findEnvironmentConfig(environmentName: string): EnvironmentConfig | null {
    const flyConfig = this.configs.find(c => c.name === environmentName);
    const backupEnv = this.backupConfig.environments?.find(e => e.environment === environmentName);

    if (backupEnv && (backupEnv.mongo?.cluster || backupEnv.mongo?.db)) {
      return {
        name: environmentName,
        appName: backupEnv.flyio?.appName || flyConfig?.appName || environmentName,
        apiKey: backupEnv.flyio?.apiKey || flyConfig?.apiKey || "",
        memory: backupEnv.flyio?.memory || flyConfig?.memory || FLYIO_DEFAULTS.MEMORY,
        scaleCount: backupEnv.flyio?.scaleCount || flyConfig?.scaleCount || FLYIO_DEFAULTS.SCALE_COUNT,
        organisation: backupEnv.flyio?.organisation || flyConfig?.organisation || "",
        mongo: backupEnv.mongo ? {
          cluster: backupEnv.mongo.cluster || "",
          db: backupEnv.mongo.db || "",
          username: backupEnv.mongo.username || "",
          password: backupEnv.mongo.password || ""
        } : flyConfig?.mongo
      };
    }

    return flyConfig || null;
  }

  private buildMongoUriForConfig(cluster: string, username: string, password: string, database: string): string {
    return buildMongoUri({ cluster, username, password, database });
  }

  async startBackup(options: BackupOptions): Promise<BackupSession> {
    const config = this.findEnvironmentConfig(options.environment);
    if (!config) {
      throw new Error(`Environment "${options.environment}" not found`);
    }

    if (!config.mongo) {
      throw new Error(`Environment "${options.environment}" has no mongo config`);
    }

    const envBackupConfig = getEnvironmentConfig(this.backupConfig, options.environment);
    const dbName = options.database || config.mongo.db;
    const timestampStr = dateTimeNow().toFormat(DateFormat.FILE_TIMESTAMP);
    const backupName = `${timestampStr}-${config.name}-${dbName}`;
    const sessionId = `backup-${backupName}`;

    const session: BackupSession = {
      sessionId,
      type: "backup",
      environment: options.environment,
      database: dbName,
      collections: options.collections,
      status: "pending",
      startTime: dateTimeNow().toJSDate(),
      options: {
        scaleDown: options.scaleDown,
        upload: options.upload,
        s3Bucket: options.upload ? (this.backupConfig.aws?.bucket || envBackupConfig?.aws?.bucket) : undefined,
        s3Region: options.upload ? (this.backupConfig.aws?.region || envBackupConfig?.aws?.region) : undefined,
        s3Prefix: "backups"
      },
      logs: [],
      metadata: {
        user: options.user,
        triggeredBy: "web"
      }
    };

    const savedSession = await backupSession.create(session);

    if (this.notificationService) {
      await this.notificationService.notifyBackupStarted(savedSession);
    }

    this.executeBackup(savedSession._id!.toString(), config, options, backupName, envBackupConfig).catch(err => {
      this.updateSessionError(savedSession._id!.toString(), err.message);
    });

    return savedSession;
  }

  async startRestore(options: RestoreOptions): Promise<BackupSession> {
    const config = this.findEnvironmentConfig(options.environment);
    if (!config) {
      throw new Error(`Environment "${options.environment}" not found`);
    }

    if (!config.mongo) {
      throw new Error(`Environment "${options.environment}" has no mongo config`);
    }

    const isS3 = options.from?.startsWith("s3://") || options.from?.startsWith("s3:/");
    if (isS3) {
      if (options.from.startsWith("s3:/") && !options.from.startsWith("s3://")) {
        options.from = options.from.replace(/^s3:\/\//, "s3://").replace(/^s3:\//, "s3://");
      }
    } else {
      const fromPath = path.join(this.dumpBaseDir, options.from);
      try {
        await fs.access(fromPath);
      } catch {
        throw new Error(`Dump directory not found: ${fromPath}`);
      }
    }

    const dbName = options.database || config.mongo.db;
    const sessionId = `restore-${dateTimeNow().toFormat(DateFormat.FILE_TIMESTAMP)}`;

    const session: BackupSession = {
      sessionId,
      type: "restore",
      environment: options.environment,
      database: dbName,
      collections: options.collections,
      status: "pending",
      startTime: dateTimeNow().toJSDate(),
      options: {
        from: options.from,
        drop: options.drop !== false,
        dryRun: options.dryRun
      },
      logs: [],
      metadata: {
        user: options.user,
        triggeredBy: "web"
      }
    };

    const savedSession = await backupSession.create(session);

    if (this.notificationService) {
      await this.notificationService.notifyRestoreStarted(savedSession);
    }

    if (!options.dryRun) {
      this.executeRestore(savedSession._id!.toString(), config, options).catch(err => {
        this.updateSessionError(savedSession._id!.toString(), err.message);
      });
    } else {
      await this.updateSession(savedSession._id!.toString(), {
        status: "completed",
        endTime: dateTimeNow().toJSDate(),
        logs: ["DRY RUN - No changes made"]
      });
    }

    return savedSession;
  }

  private async executeBackup(
    sessionId: string,
    config: EnvironmentConfig,
    options: BackupOptions,
    backupName: string,
    envBackupConfig?: ReturnType<typeof getEnvironmentConfig>
  ): Promise<void> {
    let originalScaleCount: number | undefined;
    try {
      await this.updateSession(sessionId, { status: "in_progress" });

      const dbName = options.database || config.mongo!.db;
      const outDir = path.join(this.dumpBaseDir, "backups", backupName);

      await fs.mkdir(outDir, { recursive: true });

      const mongoUri = this.buildMongoUriForConfig(config.mongo!.cluster, config.mongo!.username, config.mongo!.password, dbName);

      const dumpArgs = [
        "--uri", mongoUri,
        "--gzip",
        "--out", outDir
      ];

      if (options.collections && options.collections.length > 0) {
        for (const collection of options.collections) {
          dumpArgs.push("--collection", collection.trim());
        }
      }

      if (options.scaleDown) {
        originalScaleCount = config.scaleCount;
        await this.scaleApp(config, 0);
        await this.addLog(sessionId, `Scaled down ${config.name}`);
      }

      await this.addLog(sessionId, `Starting mongodump to ${outDir}`);
      await this.execCommand("mongodump", dumpArgs, sessionId);

      await this.updateSession(sessionId, { backupPath: `backups/${backupName}` });
      await this.addLog(sessionId, `Backup completed: ${outDir}`);

      if (options.upload && (this.backupConfig.aws?.bucket || envBackupConfig?.aws)) {
        const preferredBucket = (this.backupConfig.aws?.bucket || envBackupConfig?.aws?.bucket)!;
        const preferredRegion = (this.backupConfig.aws?.region || envBackupConfig?.aws?.region || AWS_DEFAULTS.REGION);
        const accessKeyId = envBackupConfig?.aws?.accessKeyId;
        const secretAccessKey = envBackupConfig?.aws?.secretAccessKey;
        const tsMatch = backupName.match(/^(\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2})/);
        const timestampFolder = tsMatch ? tsMatch[1] : backupName;
        const s3Key = path.join(options.environment, dbName, timestampFolder).replace(/\\/g, "/");

        const uploadWith = async (bucket: string, region: string) => {
          const client = new S3Client({
            region,
            credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined
          });
          await this.ensureBucket(client, bucket, region);
          await this.addLog(sessionId, `Starting S3 upload to ${bucket}`);
          await this.uploadDirToS3(client, outDir, bucket, s3Key, sessionId);
          const loc = `s3://${bucket}/${s3Key}`;
          await this.updateSession(sessionId, { s3Location: loc });
          await this.addLog(sessionId, `Uploaded to ${loc}`);
        };

        try {
          await uploadWith(preferredBucket, preferredRegion);
        } catch (e: any) {
          if (e?.Code === "NoSuchBucket" && envBackupConfig?.aws?.bucket && envBackupConfig.aws.bucket !== preferredBucket) {
            const fbBucket = envBackupConfig.aws.bucket;
            const fbRegion = envBackupConfig.aws.region || AWS_DEFAULTS.REGION;
            await this.addLog(sessionId, `Global bucket missing; falling back to ${fbBucket}`);
            await uploadWith(fbBucket, fbRegion);
          } else {
            throw e;
          }
        }
      }

      await this.updateSession(sessionId, { status: "completed", endTime: dateTimeNow().toJSDate() });

      if (this.notificationService) {
        const completedSession = await this.session(sessionId);
        if (completedSession) {
          await this.notificationService.notifyBackupCompleted(completedSession);
        }
      }
    } catch (error: any) {
      await this.addLog(sessionId, `Error during backup: ${error.message}`);
      await this.updateSessionError(sessionId, error.message);
      throw error;
    } finally {
      if (options.scaleDown && !isUndefined(originalScaleCount)) {
        try {
          await this.scaleApp(config, originalScaleCount);
          await this.addLog(sessionId, `Restored scale count for ${config.name}`);
        } catch (scaleError: any) {
          await this.addLog(sessionId, `Warning: Failed to restore scale count: ${scaleError.message}`);
        }
      }
    }
  }

  private async ensureBucket(s3: S3Client, bucket: string, region: string): Promise<void> {
    try {
      const input: any = { Bucket: bucket };
      if (region && region !== "us-east-1") {
        input.CreateBucketConfiguration = { LocationConstraint: region };
      }
      await s3.send(new CreateBucketCommand(input));
    } catch (e: any) {
      const code = e?.Code || e?.name;
      if (code === "BucketAlreadyOwnedByYou" || code === "BucketAlreadyExists") {
        return;
      }
    }
  }

  private async executeRestore(
    sessionId: string,
    config: EnvironmentConfig,
    options: RestoreOptions
  ): Promise<void> {
    try {
      if (options.from.startsWith("s3://")) {
        const envBackupConfig = getEnvironmentConfig(this.backupConfig, options.environment);
        const s3BucketFromPath = options.from.replace("s3://", "").split("/")[0];
        const s3Prefix = options.from.replace(`s3://${s3BucketFromPath}/`, "");
        const configuredBucket = envBackupConfig?.aws?.bucket;
        const region = envBackupConfig?.aws?.region || AWS_DEFAULTS.REGION;
        const accessKeyId = envBackupConfig?.aws?.accessKeyId;
        const secretAccessKey = envBackupConfig?.aws?.secretAccessKey;

        const s3 = new S3Client({
          region,
          credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined
        });

        const destDir = path.join(this.dumpBaseDir, s3Prefix);
        let usedBucket = configuredBucket || s3BucketFromPath;
        await this.addLog(sessionId, `Downloading backup from s3://${usedBucket}/${s3Prefix} to ${destDir}`);
        let downloaded = await this.downloadS3Prefix(s3, usedBucket, s3Prefix, destDir, sessionId);

        if (downloaded === 0 && configuredBucket && configuredBucket !== s3BucketFromPath) {
          usedBucket = s3BucketFromPath;
          await this.addLog(sessionId, `No files downloaded; retrying with bucket from path: s3://${usedBucket}/${s3Prefix}`);
          downloaded = await this.downloadS3Prefix(s3, usedBucket, s3Prefix, destDir, sessionId);
        }
        if (downloaded === 0) {
          throw new Error(`No objects found at s3://${usedBucket}/${s3Prefix}`);
        }
        options = { ...options, from: s3Prefix };
      }
      await this.updateSession(sessionId, { status: "in_progress" });

      const fromPath = path.join(this.dumpBaseDir, options.from);
      const dbName = options.database || config.mongo!.db;

      async function containsBsonFiles(dir: string): Promise<boolean> {
        try {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          for (const e of entries) {
            if (e.isFile() && (e.name.endsWith(".bson") || e.name.endsWith(".bson.gz"))) return true;
          }
          return false;
        } catch {
          return false;
        }
      }

      let restoreDir = fromPath;
      if (!(await containsBsonFiles(restoreDir))) {
        try {
          const children = await fs.readdir(fromPath, { withFileTypes: true });
          const dbDir = children.find(d => d.isDirectory() && d.name === dbName)?.name
            || children.find(d => d.isDirectory())?.name;
          if (dbDir) {
            const candidate = path.join(fromPath, dbDir);
            if (await containsBsonFiles(candidate)) {
              restoreDir = candidate;
            }
          }
        } catch {
        }
      }

      const mongoUri = this.buildMongoUriForConfig(config.mongo!.cluster, config.mongo!.username, config.mongo!.password, dbName);

      const restoreArgs = [
        "--uri", mongoUri,
        "--gzip"
      ];

      if (options.drop !== false) {
        restoreArgs.push("--drop");
      }

      if (options.collections && options.collections.length > 0) {
        const partialRoot = path.join(this.dumpBaseDir, "partial", sessionId, dbName);
        await fs.mkdir(partialRoot, { recursive: true });

        const tryCopy = async (src: string, dest: string) => {
          try {
            await fs.copyFile(src, dest);
            return true;
          } catch {
            return false;
          }
        };

        for (const collection of options.collections) {
          const name = collection.trim();
          if (!name) continue;
          const patterns = [
            { src: path.join(restoreDir, `${name}.bson.gz`), dest: path.join(partialRoot, `${name}.bson.gz`) },
            { src: path.join(restoreDir, `${name}.bson`), dest: path.join(partialRoot, `${name}.bson`) }
          ];
          const metaPatterns = [
            { src: path.join(restoreDir, `${name}.metadata.json.gz`), dest: path.join(partialRoot, `${name}.metadata.json.gz`) },
            { src: path.join(restoreDir, `${name}.metadata.json`), dest: path.join(partialRoot, `${name}.metadata.json`) }
          ];

          for (const p of patterns) {
            const copied = await tryCopy(p.src, p.dest);
            if (copied) break;
          }
          for (const p of metaPatterns) {
            const copied = await tryCopy(p.src, p.dest);
            if (copied) break;
          }
          restoreArgs.push("--nsInclude", `${dbName}.${name}`);
        }
        restoreDir = partialRoot;
      }
      restoreArgs.push("--dir", restoreDir);

      await this.addLog(sessionId, `Starting mongorestore from ${restoreDir}`);
      await this.execCommand("mongorestore", restoreArgs, sessionId);
      await this.addLog(sessionId, `Restore completed to ${options.environment}`);
      await this.updateSession(sessionId, { status: "completed", endTime: dateTimeNow().toJSDate() });

      if (this.notificationService) {
        const completedSession = await this.session(sessionId);
        if (completedSession) {
          await this.notificationService.notifyRestoreCompleted(completedSession);
        }
      }
    } catch (error: any) {
      await this.addLog(sessionId, `Error during restore: ${error.message}`);
      await this.updateSessionError(sessionId, error.message);
      throw error;
    }
  }

  private async execCommand(cmd: string, args: string[], sessionId: string): Promise<void> {
    const redactedArgs = (() => {
      const copy = [...args];
      for (let i = 0; i < copy.length; i++) {
        if (copy[i] === "--uri" && i + 1 < copy.length) {
          copy[i + 1] = "[REDACTED-URI]";
          i++;
        }
      }
      return copy;
    })();
    await this.addLog(sessionId, `Executing: ${cmd} ${redactedArgs.join(" ")}`);
    return new Promise((resolve, reject) => {
      const proc: ChildProcess = spawn(cmd, args);
      let stdout = "";
      let stderr = "";

      if (proc.stdout) {
        proc.stdout.on("data", data => {
          stdout += data.toString();
        });
      }

      if (proc.stderr) {
        proc.stderr.on("data", data => {
          stderr += data.toString();
        });
      }

      proc.on("close", async (code: number) => {
        if (stdout) await this.addLog(sessionId, stdout);
        if (stderr) await this.addLog(sessionId, stderr);

        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`${cmd} exited with code ${code}`));
        }
      });

      proc.on("error", error => {
        reject(error);
      });
    });
  }

  private async downloadS3Prefix(
    s3: S3Client,
    bucket: string,
    prefix: string,
    destDir: string,
    sessionId: string
  ): Promise<number> {
    await fs.mkdir(destDir, { recursive: true });
    let continuationToken: string | undefined = undefined;
    let count = 0;
    do {
      const resp = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: continuationToken }));
      const contents = resp.Contents || [];
      for (const obj of contents) {
        const key = obj.Key!;
        if (key.endsWith("/")) continue;
        const relative = key.startsWith(prefix) ? key.slice(prefix.length).replace(/^\//, "") : key;
        const targetPath = path.join(destDir, relative);
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        const get = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        const body: any = get.Body;
        await new Promise<void>((resolve, reject) => {
          const ws = createWriteStream(targetPath);
          body.pipe(ws);
          body.on("error", (e: any) => reject(e));
          ws.on("finish", () => resolve());
          ws.on("error", (e: any) => reject(e));
        });
        await this.addLog(sessionId, `Downloaded: s3://${bucket}/${key}`);
        count++;
      }
      continuationToken = resp.IsTruncated ? resp.NextContinuationToken : undefined;
    } while (continuationToken);
    return count;
  }

  private async scaleApp(config: EnvironmentConfig, count: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn("flyctl", ["scale", "count", count.toString(), "--app", config.appName]);
      proc.on("close", (code: number) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`flyctl scale exited with code ${code}`));
        }
      });
    });
  }

  private async uploadDirToS3(
    s3: S3Client,
    localDir: string,
    bucket: string,
    prefix: string,
    sessionId: string
  ): Promise<void> {
    const entries = await fs.readdir(localDir);
    for (const entry of entries) {
      const localPath = path.join(localDir, entry);
      const stat = await fs.stat(localPath);
      const key = path.join(prefix, entry).replace(/\\/g, "/");

      if (stat.isDirectory()) {
        await this.uploadDirToS3(s3, localPath, bucket, key, sessionId);
      } else {
        const fileContent = await fs.readFile(localPath);
        await s3.send(new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: fileContent,
          ContentType: entry.endsWith(".gz") ? "application/gzip" : "application/octet-stream"
        }));
        await this.addLog(sessionId, `Uploaded: s3://${bucket}/${key}`);
      }
    }
  }

  private async updateSession(sessionId: string, updates: Partial<BackupSession>): Promise<void> {
    await backupSession.updateOne({ _id: sessionId }, { $set: updates });
  }

  private async updateSessionError(sessionId: string, error: string): Promise<void> {
    await backupSession.updateOne(
      { _id: sessionId },
      { $set: { status: "failed", error, endTime: dateTimeNow().toJSDate() } }
    );

    if (this.notificationService) {
      const failedSession = await this.session(sessionId);
      if (failedSession) {
        if (failedSession.type === "backup") {
          await this.notificationService.notifyBackupCompleted(failedSession);
        } else {
          await this.notificationService.notifyRestoreCompleted(failedSession);
        }
      }
    }
  }

  private async addLog(sessionId: string, message: string): Promise<void> {
    await backupSession.updateOne({ _id: sessionId }, { $push: { logs: message } });
  }

  async cleanupStuckSessions(): Promise<number> {
    const tenMinutesAgo = dateTimeFromMillis(dateTimeNowAsValue() - 10 * 60 * 1000).toJSDate();

    const stuckSessions = await backupSession.find({
      status: "in_progress",
      startTime: { $lt: tenMinutesAgo }
    });

    let cleanedCount = 0;
    for (const session of stuckSessions) {
      await this.updateSessionError(
        session._id!.toString(),
        "Session timed out after 10 minutes without completion"
      );
      cleanedCount++;
    }

    return cleanedCount;
  }

  async sessions(limit: number = 50): Promise<BackupSession[]> {
    await this.cleanupStuckSessions();
    return backupSession.find().sort({startTime: -1}).limit(limit);
  }

  async session(sessionId: string): Promise<BackupSession | null> {
    return backupSession.findById(sessionId);
  }

  async listEnvironments(): Promise<{ name: string; appName: string; database?: string; hasMongoConfig: boolean }[]> {
    const environments: { name: string; appName: string; database?: string; hasMongoConfig: boolean }[] = [];
    const processedNames = new Set<string>();

    if (this.backupConfig.environments) {
      for (const backupEnv of this.backupConfig.environments) {
        const flyConfig = this.configs.find(c => c.name === backupEnv.environment);
        const hasMongoConfig = !!(backupEnv.mongo?.cluster || backupEnv.mongo?.db);

        environments.push({
          name: backupEnv.environment,
          appName: backupEnv.flyio?.appName || flyConfig?.appName || backupEnv.environment,
          database: backupEnv.mongo?.db || flyConfig?.mongo?.db,
          hasMongoConfig
        });
        processedNames.add(backupEnv.environment);
      }
    }

    for (const config of this.configs) {
      if (!processedNames.has(config.name)) {
        environments.push({
          name: config.name,
          appName: config.appName,
          database: config.mongo?.db,
          hasMongoConfig: !!config.mongo
        });
      }
    }

    return environments;
  }

  async listBackups(): Promise<{ name: string; path: string; timestamp: Date; environment?: string; database?: string }[]> {
    const backupsDir = path.join(this.dumpBaseDir, "backups");
    try {
      const entries = await fs.readdir(backupsDir);
      const backups = [];

      for (const entry of entries) {
        const entryPath = path.join(backupsDir, entry);
        const stat = await fs.stat(entryPath);
        if (stat.isDirectory()) {
          let database: string | undefined = undefined;
          try {
            const dirents = await fs.readdir(entryPath, { withFileTypes: true });
            const dbDir = dirents.find(d => d.isDirectory())?.name;
            if (dbDir) {
              database = dbDir;
            }
          } catch {}

          let environment: string | undefined = undefined;
          try {
            const tsPrefixLen = 19; // yyyy-MM-dd-HH-mm-ss
            if (entry.length > tsPrefixLen + 1) {
              const remainder = entry.slice(tsPrefixLen + 1);
              if (database && remainder.endsWith(`-${database}`)) {
                environment = remainder.slice(0, remainder.length - (database.length + 1));
              }
            }
          } catch {}

          backups.push({
            name: entry,
            path: `backups/${entry}`,
            timestamp: stat.mtime,
            environment,
            database
          });
        }
      }

      return backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch {
      return [];
    }
  }

  async listS3Backups(): Promise<{ name: string; path: string; timestamp?: Date }[]> {
    const results: { name: string; path: string; timestamp?: Date }[] = [];
    if (!this.backupConfig.environments) return results;
    for (const env of this.backupConfig.environments) {
      try {
        const bucket = this.backupConfig.aws?.bucket || env.aws?.bucket;
        if (!bucket) continue;
        const region = this.backupConfig.aws?.region || env.aws?.region || AWS_DEFAULTS.REGION;
        const accessKeyId = env.aws?.accessKeyId;
        const secretAccessKey = env.aws?.secretAccessKey;
        const s3 = new S3Client({
          region,
          credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined
        });
        const envPrefix = `${env.environment}/`;
        const dbPrefixes = await this.listPrefixes(s3, bucket, envPrefix);
        for (const dbPrefix of dbPrefixes) {
          const tsPrefixes = await this.listPrefixes(s3, bucket, dbPrefix);
          for (const tsPrefix of tsPrefixes) {
            const trimmed = tsPrefix.replace(/\/$/, "");
            const folder = trimmed.split("/").pop() || "";
            const dt = dateTimeInTimezone(folder, DateFormat.FILE_TIMESTAMP);
            const name = `${env.environment}/${dbPrefix.substring(envPrefix.length)}${trimmed.substring(dbPrefix.length)}`;
            const pathStr = `s3://${bucket}/${trimmed}`;
            results.push({ name, path: pathStr, timestamp: dt.isValid ? dt.toJSDate() : undefined });
          }
        }
      } catch (e) {
        continue;
      }
    }
    return results;
  }

  private async listPrefixes(s3: S3Client, bucket: string, prefix: string): Promise<string[]> {
    const prefixes: string[] = [];
    let continuationToken: string | undefined = undefined;
    do {
      const resp = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, Delimiter: "/", ContinuationToken: continuationToken }));
      (resp.CommonPrefixes || []).forEach(p => prefixes.push(p.Prefix!));
      continuationToken = resp.IsTruncated ? resp.NextContinuationToken : undefined;
    } while (continuationToken);
    return prefixes;
  }

  async deleteS3Backups(names: string[]): Promise<{ deleted: string[]; errors: NamedError[] }> {
    const deleted: string[] = [];
    const errors: NamedError[] = [];
    for (const name of names) {
      try {
        const [envName] = name.split("/");
        const env = this.backupConfig.environments?.find(e => e.environment === envName);
        const bucket = this.backupConfig.aws?.bucket || env?.aws?.bucket;
        if (!bucket) throw new Error("No bucket configured for environment " + envName);
        const region = this.backupConfig.aws?.region || env?.aws?.region || AWS_DEFAULTS.REGION;
        const s3 = new S3Client({
          region, credentials: env?.aws?.accessKeyId && env?.aws?.secretAccessKey ?
            {accessKeyId: env.aws.accessKeyId, secretAccessKey: env.aws.secretAccessKey} : undefined
        });
        const prefix = name.endsWith("/") ? name : `${name}/`;
        let continuationToken: string | undefined = undefined;
        do {
          const resp = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: continuationToken }));
          const contents = resp.Contents || [];
          for (const obj of contents) {
            await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: obj.Key! }));
          }
          continuationToken = resp.IsTruncated ? resp.NextContinuationToken : undefined;
        } while (continuationToken);
        deleted.push(name);
      } catch (e: any) {
        errors.push({ name, error: e.message });
      }
    }
    return { deleted, errors };
  }

  async listCollections(environmentName: string): Promise<string[]> {
    const config = this.findEnvironmentConfig(environmentName);
    if (!config || !config.mongo) {
      throw new Error(`Environment "${environmentName}" not found or has no mongo config`);
    }

    const mongoUri = this.buildMongoUriForConfig(config.mongo.cluster, config.mongo.username, config.mongo.password, config.mongo.db);

    return new Promise((resolve, reject) => {
      const proc = spawn("mongosh", [
        mongoUri,
        "--quiet",
        "--eval",
        "db.getCollectionNames().join(',')"
      ]);

      let stdout = "";
      let stderr = "";

      if (proc.stdout) {
        proc.stdout.on("data", data => {
          stdout += data.toString();
        });
      }

      if (proc.stderr) {
        proc.stderr.on("data", data => {
          stderr += data.toString();
        });
      }

      proc.on("close", code => {
        if (code !== 0) {
          reject(new Error(`mongosh exited with code ${code}: ${stderr}`));
        } else {
          const collections = stdout.trim().split(",").filter(c => c.length > 0);
          resolve(collections);
        }
      });

      proc.on("error", error => {
        reject(error);
      });
    });
  }

  async deleteBackups(names: string[]): Promise<{ deleted: string[]; errors: NamedError[] }> {
    const backupsDir = path.join(this.dumpBaseDir, "backups");
    const deleted: string[] = [];
    const errors: NamedError[] = [];

    for (const name of names) {
      try {
        const target = path.join(backupsDir, name);
        await fs.rm(target, { recursive: true, force: true });
        deleted.push(name);
      } catch (e: any) {
        errors.push({ name, error: e.message });
      }
    }

    return { deleted, errors };
  }
}
