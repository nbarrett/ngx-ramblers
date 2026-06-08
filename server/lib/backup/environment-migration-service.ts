import debug from "debug";
import { ChildProcess, spawn } from "child_process";
import * as fs from "fs/promises";
import { createWriteStream } from "fs";
import * as path from "path";
import { Db, MongoClient } from "mongodb";
import { isArray, isString } from "es-toolkit/compat";
import { GetObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { envConfig } from "../env-config/env-config";
import { buildMongoUri } from "../shared/mongodb-uri";
import { dateTimeNow } from "../shared/dates";
import { configuredBackup } from "./backup-config";
import { environmentMigration } from "../mongo/models/environment-migration";
import * as configController from "../mongo/controllers/config";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { BackupLocation, S3BackupSummary } from "../../../projects/ngx-ramblers/src/app/models/backup-session.model";
import {
  EnvironmentMigrationAudit,
  EnvironmentMigrationCollectionCount,
  EnvironmentMigrationMode,
  EnvironmentMigrationMongoSummary,
  EnvironmentMigrationMongoTarget,
  EnvironmentMigrationPhase,
  EnvironmentMigrationRequest,
  EnvironmentMigrationRollbackInfo,
  EnvironmentMigrationRotationRequest,
  EnvironmentMigrationStatus,
  EnvironmentMigrationVerification
} from "../../../projects/ngx-ramblers/src/app/models/environment-migration.model";
import { AWS_DEFAULTS, EnvironmentsConfig, MongoConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { RamblersWalksManagerDateFormat as DateFormat } from "../../../projects/ngx-ramblers/src/app/models/date-format.model";
import { extractSourceEnvironmentFromBackupName, extractTimestampFromBackupName } from "./backup-paths";
import { manifestByTimestamp, siteConfigFor, startS3Backup, startS3Restore } from "./s3-backup-service";
import { adminConfigFromEnvironment, setupAwsForBucket } from "../environment-setup/aws-setup";

const debugLog = debug(envConfig.logNamespace("environment-migration-service"));
debugLog.enabled = true;

const KEY_COLLECTIONS = ["config", "members", "pageContent", "extendedgroupevents"];
const SERVER_START_TIME = dateTimeNow().toJSDate();
const ACTIVE_STATUSES: EnvironmentMigrationStatus[] = [
  EnvironmentMigrationStatus.PENDING,
  EnvironmentMigrationStatus.VALIDATING,
  EnvironmentMigrationStatus.DUMPING,
  EnvironmentMigrationStatus.RESTORING,
  EnvironmentMigrationStatus.VERIFYING
];

function errorMessage(error: any): string {
  return error?.message || "Environment migration failed";
}

export class EnvironmentMigrationService {
  private dumpBaseDir: string;

  constructor(dumpBaseDir?: string) {
    this.dumpBaseDir = dumpBaseDir || path.join(process.cwd(), "../non-vcs/dump");
  }

  async history(environmentName: string | null = null, limit = 50): Promise<EnvironmentMigrationAudit[]> {
    await this.reconcileOrphanedMigrations();
    const criteria = environmentName ? { environment: environmentName } : {};
    return environmentMigration.find(criteria).sort({ startTime: -1 }).limit(limit).lean();
  }

  async migration(migrationId: string): Promise<EnvironmentMigrationAudit | null> {
    return environmentMigration.findOne({ migrationId }).lean();
  }

  async planMongoOnlyMigration(request: EnvironmentMigrationRequest): Promise<EnvironmentMigrationAudit> {
    return this.executeMongoOnlyMigration({ ...request, dryRun: true });
  }

  async startMongoOnlyMigration(request: EnvironmentMigrationRequest): Promise<EnvironmentMigrationAudit> {
    const backupConfig = await configuredBackup();
    const sourceMongo = this.sourceMongoFor(backupConfig, request.environment);
    const targetMongo = this.requiredTargetMongo(request.targetMongo);
    const mode = request.mode || EnvironmentMigrationMode.MONGO_ONLY;

    if (!request.dryRun && request.confirmEnvironment !== request.environment) {
      throw new Error(`Type the environment name "${request.environment}" to execute the migration`);
    }

    const migrationRecord = await this.createMigrationRecord(request, sourceMongo, targetMongo, mode);
    this.runMongoOnlyMigration(migrationRecord.migrationId, request, backupConfig, sourceMongo, targetMongo).catch(error => {
      debugLog("startMongoOnlyMigration background execution failed:", error);
    });
    return migrationRecord.toObject() as EnvironmentMigrationAudit;
  }

  async executeMongoOnlyMigration(request: EnvironmentMigrationRequest): Promise<EnvironmentMigrationAudit> {
    const backupConfig = await configuredBackup();
    const sourceMongo = this.sourceMongoFor(backupConfig, request.environment);
    const targetMongo = this.requiredTargetMongo(request.targetMongo);
    const mode = request.mode || EnvironmentMigrationMode.MONGO_ONLY;

    if (!request.dryRun && request.confirmEnvironment !== request.environment) {
      throw new Error(`Type the environment name "${request.environment}" to execute the migration`);
    }

    const migrationRecord = await this.createMigrationRecord(request, sourceMongo, targetMongo, mode);
    return this.runMongoOnlyMigration(migrationRecord.migrationId, request, backupConfig, sourceMongo, targetMongo);
  }

  private async createMigrationRecord(request: EnvironmentMigrationRequest, sourceMongo: EnvironmentMigrationMongoTarget, targetMongo: EnvironmentMigrationMongoTarget, mode: EnvironmentMigrationMode) {
    return environmentMigration.create({
      migrationId: `environment-migration-${dateTimeNow().toFormat(DateFormat.FILE_TIMESTAMP)}-${request.environment}`,
      environment: request.environment,
      mode,
      status: EnvironmentMigrationStatus.PENDING,
      phase: EnvironmentMigrationPhase.PLAN,
      dryRun: request.dryRun === true,
      startTime: dateTimeNow().toJSDate(),
      backupPath: request.backupPath,
      backupName: request.backupName,
      backupLocation: request.backupLocation,
      sourceMongo: this.mongoSummary(sourceMongo),
      targetMongo: this.mongoSummary(targetMongo),
      requestedBy: request.user
    });
  }

  private async runMongoOnlyMigration(
    migrationId: string,
    request: EnvironmentMigrationRequest,
    backupConfig: EnvironmentsConfig,
    sourceMongo: EnvironmentMigrationMongoTarget,
    targetMongo: EnvironmentMigrationMongoTarget
  ): Promise<EnvironmentMigrationAudit> {
    try {
      await this.markExecutionStarted(migrationId);
      await this.updateMigration(migrationId, EnvironmentMigrationStatus.VALIDATING, EnvironmentMigrationPhase.VALIDATE_SOURCE);
      await this.validateMongoCredentials(sourceMongo, false, migrationId);

      await this.updateMigration(migrationId, EnvironmentMigrationStatus.VALIDATING, EnvironmentMigrationPhase.VALIDATE_TARGET);
      await this.validateMongoCredentials(targetMongo, true, migrationId);
      await this.validateS3ScopeIfRequested(request, backupConfig, sourceMongo.db);

      if (request.dryRun) {
        const verification = await this.verifyDatabase(sourceMongo, request.environment, backupConfig);
        await environmentMigration.updateOne(
          { migrationId },
          {
            $set: {
              status: EnvironmentMigrationStatus.VALIDATED,
              phase: EnvironmentMigrationPhase.VERIFY_TARGET,
              endTime: dateTimeNow().toJSDate(),
              heartbeatAt: dateTimeNow().toJSDate(),
              verification,
              rollbackInfo: this.rollbackInfo(sourceMongo, targetMongo, request.backupPath)
            }
          }
        );
        return this.requiredMigration(migrationId);
      }

      const backupPath = request.backupPath || await this.dumpSource(sourceMongo, request.environment, migrationId);
      await environmentMigration.updateOne({ migrationId }, { $set: { backupPath } });
      const s3Backups = await this.backupS3IfRequested(migrationId, request, backupPath);

      await this.restoreTarget(targetMongo, backupPath, migrationId);
      const s3Restores = await this.restoreS3IfRequested(migrationId, request, backupPath, sourceMongo.db);

      await this.updateMigration(migrationId, EnvironmentMigrationStatus.VERIFYING, EnvironmentMigrationPhase.VERIFY_TARGET);
      await this.patchRestoredStagingEnvironmentConfig(targetMongo, request.environment);
      const verification = await this.verifyDatabase(targetMongo, request.environment, backupConfig);
      const rollbackInfo = this.rollbackInfo(sourceMongo, targetMongo, backupPath);

      await environmentMigration.updateOne(
        { migrationId },
        {
          $set: {
            status: EnvironmentMigrationStatus.READY_FOR_CUTOVER,
            phase: EnvironmentMigrationPhase.VERIFY_TARGET,
            endTime: dateTimeNow().toJSDate(),
            heartbeatAt: dateTimeNow().toJSDate(),
            verification,
            ...(s3Backups.length > 0 ? { s3Backups } : {}),
            ...(s3Restores.length > 0 ? { s3Restores } : {}),
            rollbackInfo
          }
        }
      );

      if (request.rotateCredentials) {
        return this.rotateCredentials({
          migrationId,
          confirmEnvironment: request.environment,
          targetMongo,
          rotateS3Credentials: request.rotateS3Credentials,
          user: request.user
        });
      }

      return this.requiredMigration(migrationId);
    } catch (error: any) {
      debugLog("executeMongoOnlyMigration failed:", error);
      await environmentMigration.updateOne(
        { migrationId },
        {
          $set: {
            status: EnvironmentMigrationStatus.FAILED,
            endTime: dateTimeNow().toJSDate(),
            heartbeatAt: dateTimeNow().toJSDate(),
            error: errorMessage(error)
          }
        }
      );
      throw error;
    }
  }

  async rotateCredentials(request: EnvironmentMigrationRotationRequest): Promise<EnvironmentMigrationAudit> {
    const migration = await environmentMigration.findOne({ migrationId: request.migrationId }).lean() as EnvironmentMigrationAudit | null;
    if (!migration) {
      throw new Error(`Migration ${request.migrationId} not found`);
    }

    if (migration.status !== EnvironmentMigrationStatus.READY_FOR_CUTOVER) {
      throw new Error(`Migration ${request.migrationId} is not ready for cutover`);
    }

    if (request.confirmEnvironment !== migration.environment) {
      throw new Error(`Type the environment name "${migration.environment}" to rotate credentials`);
    }

    const targetMongo = this.requiredTargetMongo(request.targetMongo);
    const targetSummary = this.mongoSummary(targetMongo);
    if (targetSummary.cluster !== migration.targetMongo.cluster || targetSummary.db !== migration.targetMongo.db || targetSummary.username !== migration.targetMongo.username) {
      throw new Error("Target Mongo credentials do not match the verified migration target");
    }
    await this.validateMongoCredentials(targetMongo, false, migration.migrationId);

    await this.updateMigration(migration.migrationId, EnvironmentMigrationStatus.READY_FOR_CUTOVER, EnvironmentMigrationPhase.ROTATE_CREDENTIALS);

    const configDoc = await configController.queryKey(ConfigKey.ENVIRONMENTS);
    const currentConfig: EnvironmentsConfig = configDoc?.value || {};
    const environments = currentConfig.environments || [];
    const matchingEnvironment = environments.find(environmentConfig => environmentConfig.environment === migration.environment);
    if (!matchingEnvironment) {
      throw new Error(`Environment "${migration.environment}" not found in ConfigKey.ENVIRONMENTS`);
    }
    const scopedAws = migration.mode === EnvironmentMigrationMode.MONGO_AND_S3 && request.rotateS3Credentials !== false
      ? await this.scopedAwsCredentials(currentConfig, matchingEnvironment, migration.environment)
      : null;
    const updatedEnvironments = environments.map(environmentConfig => environmentConfig.environment === migration.environment
      ? {
        ...environmentConfig,
        mongo: {
          cluster: migration.targetMongo.cluster,
          db: migration.targetMongo.db,
          username: migration.targetMongo.username,
          password: targetMongo.password
        },
        ...(scopedAws ? { aws: scopedAws } : {})
      }
      : environmentConfig);

    await configController.createOrUpdateKey(ConfigKey.ENVIRONMENTS, {
      ...currentConfig,
      environments: updatedEnvironments
    });

    await environmentMigration.updateOne(
      { migrationId: request.migrationId },
      {
        $set: {
          status: EnvironmentMigrationStatus.ROTATED,
          phase: EnvironmentMigrationPhase.ROTATE_CREDENTIALS,
          rotatedAt: dateTimeNow().toJSDate(),
          endTime: dateTimeNow().toJSDate(),
          heartbeatAt: dateTimeNow().toJSDate(),
          requestedBy: request.user || migration.requestedBy
        }
      }
    );

    return this.requiredMigration(request.migrationId);
  }

  private sourceMongoFor(backupConfig: EnvironmentsConfig, environmentName: string): EnvironmentMigrationMongoTarget {
    const environmentConfig = backupConfig.environments?.find(candidate => candidate.environment === environmentName);
    const mongo = environmentConfig?.mongo;
    if (!mongo?.cluster || !mongo?.db || !mongo?.username || !mongo?.password) {
      throw new Error(`Environment "${environmentName}" has no complete Mongo config`);
    }
    return {
      cluster: mongo.cluster,
      db: mongo.db,
      username: mongo.username,
      password: mongo.password
    };
  }

  private requiredTargetMongo(targetMongo: EnvironmentMigrationMongoTarget): EnvironmentMigrationMongoTarget {
    if (!targetMongo?.cluster || !targetMongo?.db || !targetMongo?.username || !targetMongo?.password) {
      throw new Error("Target Mongo cluster, db, username and password are required");
    }
    return targetMongo;
  }

  private mongoUriFor(mongo: EnvironmentMigrationMongoTarget | MongoConfig): string {
    const uri = buildMongoUri({
      cluster: mongo.cluster || "",
      database: mongo.db || "",
      username: mongo.username || "",
      password: mongo.password || ""
    });
    return `${uri}&socketTimeoutMS=300000&connectTimeoutMS=30000&serverSelectionTimeoutMS=30000`;
  }

  private mongoSummary(mongo: EnvironmentMigrationMongoTarget | MongoConfig): EnvironmentMigrationMongoSummary {
    return {
      cluster: mongo.cluster || "",
      db: mongo.db || "",
      username: mongo.username || "",
      uriSummary: `${mongo.username || ""}@${mongo.cluster || ""}/${mongo.db || ""}`
    };
  }

  private rollbackInfo(sourceMongo: EnvironmentMigrationMongoTarget, targetMongo: EnvironmentMigrationMongoTarget, backupPath?: string): EnvironmentMigrationRollbackInfo {
    return {
      oldMongo: this.mongoSummary(sourceMongo),
      targetMongo: this.mongoSummary(targetMongo),
      timestamp: dateTimeNow().toJSDate(),
      backupUsed: backupPath
    };
  }

  private s3Requested(request: EnvironmentMigrationRequest): boolean {
    return (request.mode || EnvironmentMigrationMode.MONGO_ONLY) === EnvironmentMigrationMode.MONGO_AND_S3;
  }

  private async backupS3IfRequested(migrationId: string, request: EnvironmentMigrationRequest, backupPath: string): Promise<S3BackupSummary[]> {
    if (!this.s3Requested(request) || request.backupPath) {
      return [];
    }
    const mongoTimestamp = extractTimestampFromBackupName(path.basename(backupPath));
    const s3Backups = await startS3Backup({ site: request.environment, mongoTimestamp });
    await environmentMigration.updateOne({ migrationId }, { $set: { s3Backups } });
    return s3Backups;
  }

  private async restoreS3IfRequested(migrationId: string, request: EnvironmentMigrationRequest, backupPath: string, dbName: string): Promise<S3BackupSummary[]> {
    if (!this.s3Requested(request)) {
      return [];
    }
    const backupReference = this.backupReference(backupPath, dbName);
    const matchingManifest = await manifestByTimestamp(backupReference.sourceEnvironment, backupReference.timestamp).catch(() => null);
    if (!matchingManifest) {
      throw new Error(`No completed S3 manifest found for ${backupReference.sourceEnvironment} at ${backupReference.timestamp}`);
    }
    const s3RestoreRequest = {
      site: backupReference.sourceEnvironment,
      timestamp: backupReference.timestamp,
      ...(backupReference.sourceEnvironment === request.environment ? {} : { targetSite: request.environment })
    };
    const s3Restores = await startS3Restore(s3RestoreRequest);
    await environmentMigration.updateOne({ migrationId }, { $set: { s3Restores } });
    return s3Restores;
  }

  private backupReference(backupPath: string, dbName: string): { sourceEnvironment: string; timestamp: string } {
    if (backupPath.startsWith("s3://")) {
      const pathWithoutBucket = backupPath.replace(/^s3:\/\/[^/]+\//, "");
      const parts = pathWithoutBucket.split("/");
      const sourceEnvironment = parts[0] || "";
      const timestamp = parts[1] || extractTimestampFromBackupName(path.basename(pathWithoutBucket));
      return { sourceEnvironment, timestamp };
    }
    const backupName = path.basename(backupPath);
    return {
      sourceEnvironment: extractSourceEnvironmentFromBackupName(backupName, dbName) || "",
      timestamp: extractTimestampFromBackupName(backupName)
    };
  }

  private async validateS3ScopeIfRequested(request: EnvironmentMigrationRequest, backupConfig: EnvironmentsConfig, dbName: string): Promise<void> {
    if (!this.s3Requested(request)) {
      return;
    }
    const targetConfig = siteConfigFor(backupConfig, request.environment);
    if (!targetConfig) {
      throw new Error(`Target environment "${request.environment}" has no S3 bucket credentials configured`);
    }
    if (request.backupPath) {
      const backupReference = this.backupReference(request.backupPath, dbName);
      const matchingManifest = await manifestByTimestamp(backupReference.sourceEnvironment, backupReference.timestamp).catch(() => null);
      if (!matchingManifest) {
        throw new Error(`No completed S3 manifest found for ${backupReference.sourceEnvironment} at ${backupReference.timestamp}`);
      }
    }
  }

  private async scopedAwsCredentials(currentConfig: EnvironmentsConfig, matchingEnvironment: any, environmentName: string) {
    const awsAdminConfig = adminConfigFromEnvironment();
    if (!awsAdminConfig) {
      throw new Error("AWS admin credentials are required to rotate bucket-scoped S3 credentials");
    }
    const bucket = matchingEnvironment.aws?.bucket || `ngx-ramblers-${environmentName}`;
    const region = matchingEnvironment.aws?.region || currentConfig.aws?.region || AWS_DEFAULTS.REGION;
    const setupResult = await setupAwsForBucket(awsAdminConfig, environmentName, bucket, region);
    return {
      ...matchingEnvironment.aws,
      bucket: setupResult.bucket,
      region,
      accessKeyId: setupResult.accessKeyId,
      secretAccessKey: setupResult.secretAccessKey
    };
  }

  private async validateMongoCredentials(mongo: EnvironmentMigrationMongoTarget, requireWrite: boolean, migrationId: string): Promise<void> {
    const client = new MongoClient(this.mongoUriFor(mongo), { serverSelectionTimeoutMS: 30000, maxPoolSize: 1 });
    await client.connect();
    try {
      const db = client.db(mongo.db);
      await db.command({ ping: 1 });
      await db.listCollections({}, { nameOnly: true }).toArray();
      if (requireWrite) {
        const collection = db.collection("__ngx_environment_migration_credential_check");
        await collection.insertOne({ migrationId, checkedAt: dateTimeNow().toJSDate() });
        await collection.drop();
      }
    } finally {
      await client.close();
    }
  }

  private async dumpSource(sourceMongo: EnvironmentMigrationMongoTarget, environmentName: string, migrationId: string): Promise<string> {
    await this.updateMigration(migrationId, EnvironmentMigrationStatus.DUMPING, EnvironmentMigrationPhase.DUMP_SOURCE);
    const backupName = `${dateTimeNow().toFormat(DateFormat.FILE_TIMESTAMP)}-${environmentName}-${sourceMongo.db}`;
    const outDir = path.join(this.dumpBaseDir, "environment-migrations", backupName);
    await fs.mkdir(outDir, { recursive: true });
    await this.execCommand("mongodump", [
      "--uri", this.mongoUriFor(sourceMongo),
      "--gzip",
      "--verbose",
      "--out", outDir
    ]);
    return outDir;
  }

  private async restoreTarget(targetMongo: EnvironmentMigrationMongoTarget, backupPath: string, migrationId: string): Promise<void> {
    await this.updateMigration(migrationId, EnvironmentMigrationStatus.RESTORING, EnvironmentMigrationPhase.RESTORE_TARGET);
    const materialisedBackupPath = await this.materialiseBackupPath(backupPath, targetMongo.db, migrationId);
    const restoreDir = await this.restoreDirectory(materialisedBackupPath, targetMongo.db);
    await this.execCommand("mongorestore", [
      "--uri", this.mongoUriFor(targetMongo),
      "--gzip",
      "--verbose",
      "--drop",
      "--dir", restoreDir
    ]);
  }

  private async materialiseBackupPath(backupPath: string, dbName: string, migrationId: string): Promise<string> {
    if (backupPath.startsWith("s3://")) {
      return this.downloadS3Backup(backupPath, dbName, migrationId);
    }
    if (path.isAbsolute(backupPath)) {
      return backupPath;
    }
    return path.join(this.dumpBaseDir, backupPath);
  }

  private async downloadS3Backup(backupPath: string, dbName: string, migrationId: string): Promise<string> {
    const backupConfig = await configuredBackup();
    const withoutScheme = backupPath.replace("s3://", "");
    const bucketFromPath = withoutScheme.split("/")[0];
    const prefix = withoutScheme.replace(`${bucketFromPath}/`, "");
    const reference = this.backupReference(backupPath, dbName);
    const environmentConfig = backupConfig.environments?.find(environment => environment.environment === reference.sourceEnvironment);
    const globalBucket = backupConfig.aws?.bucket;
    const bucket = globalBucket || environmentConfig?.aws?.bucket || bucketFromPath;
    const region = globalBucket ? backupConfig.aws?.region || AWS_DEFAULTS.REGION : environmentConfig?.aws?.region || backupConfig.aws?.region || AWS_DEFAULTS.REGION;
    const credentials = backupConfig.aws?.accessKeyId && backupConfig.aws?.secretAccessKey
      ? { accessKeyId: backupConfig.aws.accessKeyId, secretAccessKey: backupConfig.aws.secretAccessKey }
      : environmentConfig?.aws?.accessKeyId && environmentConfig?.aws?.secretAccessKey
        ? { accessKeyId: environmentConfig.aws.accessKeyId, secretAccessKey: environmentConfig.aws.secretAccessKey }
        : null;
    if (!credentials) {
      throw new Error(`No AWS credentials configured for S3 backup ${backupPath}`);
    }
    const s3 = new S3Client({ region, credentials });
    const destDir = path.join(this.dumpBaseDir, prefix);
    const downloaded = await this.downloadS3Prefix(s3, bucket, prefix, destDir);
    if (downloaded === 0 && bucket !== bucketFromPath) {
      const retryCount = await this.downloadS3Prefix(s3, bucketFromPath, prefix, destDir);
      if (retryCount === 0) {
        throw new Error(`No objects found at ${backupPath}`);
      }
    } else if (downloaded === 0) {
      throw new Error(`No objects found at ${backupPath}`);
    }
    await environmentMigration.updateOne({ migrationId }, { $set: { heartbeatAt: dateTimeNow().toJSDate() } });
    return destDir;
  }

  private async downloadS3Prefix(s3: S3Client, bucket: string, prefix: string, destDir: string): Promise<number> {
    await fs.mkdir(destDir, { recursive: true });
    const downloadPage = async (token: string | null, count: number): Promise<number> => {
      const response = await s3.send(new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ...(token ? { ContinuationToken: token } : {})
      }));
      const contents = response.Contents || [];
      let pageCount = count;
      for (const object of contents) {
        const key = object.Key || "";
        if (key.endsWith("/")) {
          continue;
        }
        const relative = key.startsWith(prefix) ? key.slice(prefix.length).replace(/^\//, "") : key;
        const targetPath = path.join(destDir, relative);
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        const get = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        const body: any = get.Body;
        await new Promise<void>((resolve, reject) => {
          const stream = createWriteStream(targetPath);
          body.pipe(stream);
          body.on("error", (error: any) => reject(error));
          stream.on("finish", () => resolve());
          stream.on("error", (error: any) => reject(error));
        });
        pageCount++;
      }
      if (response.IsTruncated) {
        return downloadPage(response.NextContinuationToken || null, pageCount);
      }
      return pageCount;
    };
    return downloadPage(null, 0);
  }

  private async patchRestoredStagingEnvironmentConfig(targetMongo: EnvironmentMigrationMongoTarget, environmentName: string): Promise<void> {
    if (environmentName !== "staging") {
      return;
    }
    const client = new MongoClient(this.mongoUriFor(targetMongo), { serverSelectionTimeoutMS: 30000, maxPoolSize: 1 });
    await client.connect();
    try {
      const db = client.db(targetMongo.db);
      const configCollection = db.collection("config");
      const environmentsConfig = await configCollection.findOne({ key: "environments" });
      if (!isArray(environmentsConfig?.value?.environments)) {
        throw new Error("Target staging config.environments is missing environments array");
      }
      const updatedEnvironments = environmentsConfig.value.environments.map((environmentConfig: any) => environmentConfig.environment === "staging"
        ? {
          ...environmentConfig,
          mongo: {
            ...environmentConfig.mongo,
            cluster: targetMongo.cluster,
            db: targetMongo.db,
            username: targetMongo.username,
            password: targetMongo.password
          }
        }
        : environmentConfig);
      await configCollection.updateOne(
        { key: "environments" },
        { $set: { "value.environments": updatedEnvironments } }
      );
    } finally {
      await client.close();
    }
  }

  private async restoreDirectory(backupPath: string, dbName: string): Promise<string> {
    const entries = await fs.readdir(backupPath, { withFileTypes: true });
    const hasBson = entries.some(entry => entry.isFile() && (entry.name.endsWith(".bson") || entry.name.endsWith(".bson.gz")));
    if (hasBson) {
      return backupPath;
    }
    const matchingDb = entries.find(entry => entry.isDirectory() && entry.name === dbName);
    if (matchingDb) {
      return path.join(backupPath, matchingDb.name);
    }
    const firstDirectory = entries.find(entry => entry.isDirectory());
    if (firstDirectory) {
      return path.join(backupPath, firstDirectory.name);
    }
    throw new Error(`No restoreable BSON files found in ${backupPath}`);
  }

  private async verifyDatabase(mongo: EnvironmentMigrationMongoTarget, environmentName: string, backupConfig: EnvironmentsConfig): Promise<EnvironmentMigrationVerification> {
    const client = new MongoClient(this.mongoUriFor(mongo), { serverSelectionTimeoutMS: 30000, maxPoolSize: 1 });
    await client.connect();
    try {
      const db = client.db(mongo.db);
      const collections = (await db.listCollections({}, { nameOnly: true }).toArray())
        .map(collection => collection.name)
        .filter(name => name.length > 0)
        .sort();
      const keyCollectionCounts = await this.keyCollectionCounts(db);
      const totalDocumentCount = keyCollectionCounts.reduce((total, item) => total + item.count, 0)
        + await this.remainingCollectionCount(db, collections, keyCollectionCounts);
      const systemConfig = await db.collection("config").findOne({ key: "system" });
      const environmentsConfig = await db.collection("config").findOne({ key: "environments" });
      const stagingEnvironments = environmentName === "staging"
        ? this.verifyStagingEnvironments(environmentsConfig?.value, backupConfig, mongo)
        : null;

      if (!systemConfig?.value?.group?.shortName && !systemConfig?.value?.group?.groupCode) {
        throw new Error("Target config.system is missing group identity");
      }

      if (environmentName === "staging" && (!stagingEnvironments?.present || stagingEnvironments.missing.length > 0 || !stagingEnvironments.targetMongoMatches)) {
        throw new Error("Target staging config.environments is missing expected environments or still points staging at a different Mongo target");
      }

      return {
        systemGroupIdentity: {
          shortName: systemConfig.value.group?.shortName,
          groupCode: systemConfig.value.group?.groupCode,
          longName: systemConfig.value.group?.longName
        },
        collections,
        totalDocumentCount,
        keyCollectionCounts,
        ...(stagingEnvironments ? { stagingEnvironments } : {})
      };
    } finally {
      await client.close();
    }
  }

  private async keyCollectionCounts(db: Db): Promise<EnvironmentMigrationCollectionCount[]> {
    const counts = await Promise.all(KEY_COLLECTIONS.map(async collection => ({
      collection,
      count: await db.collection(collection).countDocuments()
    })));
    return counts;
  }

  private async remainingCollectionCount(db: Db, collections: string[], keyCollectionCounts: EnvironmentMigrationCollectionCount[]): Promise<number> {
    const keyCollectionNames = keyCollectionCounts.map(item => item.collection);
    const remainingCollections = collections.filter(collection => !keyCollectionNames.includes(collection));
    const counts = await Promise.all(remainingCollections.map(collection => db.collection(collection).countDocuments()));
    return counts.reduce((total, count) => total + count, 0);
  }

  private verifyStagingEnvironments(value: any, backupConfig: EnvironmentsConfig, targetMongo: EnvironmentMigrationMongoTarget) {
    const expected = (backupConfig.environments || []).map(environmentConfig => environmentConfig.environment).filter(name => name.length > 0).sort();
    const environmentConfigs = isArray(value?.environments) ? value.environments : [];
    const actual = environmentConfigs
      .map((environmentConfig: any) => environmentConfig.environment)
      .filter((name: any) => isString(name) && name.length > 0)
      .sort();
    const stagingConfig = environmentConfigs.find((environmentConfig: any) => environmentConfig.environment === "staging");
    const stagingMongo = stagingConfig?.mongo ? this.mongoSummary(stagingConfig.mongo) : null;
    const targetMongoMatches = stagingConfig?.mongo?.cluster === targetMongo.cluster
      && stagingConfig?.mongo?.db === targetMongo.db
      && stagingConfig?.mongo?.username === targetMongo.username;
    const missing = expected.filter(environmentName => !actual.includes(environmentName));
    return {
      present: actual.length > 0,
      count: actual.length,
      expected,
      missing,
      targetMongoMatches,
      ...(stagingMongo ? { stagingMongo } : {})
    };
  }

  async reconcileOrphanedMigrations(): Promise<number> {
    const candidates = await environmentMigration.find({
      status: { $in: ACTIVE_STATUSES },
      startTime: { $lt: SERVER_START_TIME }
    });
    let reconciled = 0;
    for (const candidate of candidates) {
      await environmentMigration.updateOne(
        { migrationId: candidate.migrationId },
        {
          $set: {
            status: EnvironmentMigrationStatus.ORPHANED,
            endTime: dateTimeNow().toJSDate(),
            heartbeatAt: dateTimeNow().toJSDate(),
            error: "Migration was interrupted by a prior server restart. Target credentials are not persisted in the audit record, so inspect the target database and restart the migration explicitly with fresh credentials."
          }
        }
      );
      reconciled++;
    }
    return reconciled;
  }

  private async markExecutionStarted(migrationId: string): Promise<void> {
    const now = dateTimeNow().toJSDate();
    await environmentMigration.updateOne(
      { migrationId },
      {
        $set: {
          executionId: `${migrationId}-${dateTimeNow().toFormat(DateFormat.FILE_TIMESTAMP)}`,
          executionStartedAt: now,
          heartbeatAt: now
        }
      }
    );
  }

  private async updateMigration(migrationId: string, status: EnvironmentMigrationStatus, phase: EnvironmentMigrationPhase): Promise<void> {
    await environmentMigration.updateOne(
      { migrationId },
      { $set: { status, phase, heartbeatAt: dateTimeNow().toJSDate() } }
    );
  }

  private async requiredMigration(migrationId: string): Promise<EnvironmentMigrationAudit> {
    const migration = await this.migration(migrationId);
    if (!migration) {
      throw new Error(`Migration ${migrationId} not found`);
    }
    return migration;
  }

  private async execCommand(cmd: string, args: string[]): Promise<void> {
    const redactedArgs = args.map((arg, index) => index > 0 && args[index - 1] === "--uri" ? "[REDACTED-URI]" : arg);
    debugLog(`Executing: ${cmd} ${redactedArgs.join(" ")}`);
    return new Promise((resolve, reject) => {
      const proc: ChildProcess = spawn(cmd, args);
      proc.stdout?.on("data", data => debugLog(data.toString().trim()));
      proc.stderr?.on("data", data => debugLog(data.toString().trim()));
      proc.on("close", code => code === 0 ? resolve() : reject(new Error(`${cmd} exited with code ${code}`)));
      proc.on("error", error => reject(error));
    });
  }
}

export function createEnvironmentMigrationService(): EnvironmentMigrationService {
  return new EnvironmentMigrationService();
}
