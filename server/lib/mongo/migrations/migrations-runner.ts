import debug from "debug";
import { isFunction, isNumber, isString } from "es-toolkit/compat";
import { envConfig } from "../../env-config/env-config";
import { MongoClient } from "mongodb";
import mongoose from "mongoose";
import * as path from "path";
import * as fs from "fs";
import { dateTimeFromIso, dateTimeFromJsDate, dateTimeFromMillis, dateTimeNow } from "../../shared/dates";
import {
  MigrationFile,
  MigrationFileStatus,
  MigrationRetryResult,
  MigrationStatus
} from "../../../../projects/ngx-ramblers/src/app/models/mongo-migration-model";
import { migrateMongoConfig } from "./migrations-config";
import { ConfigKey } from "../../../../projects/ngx-ramblers/src/app/models/config.model";
import * as mongooseClient from "../mongoose-client";
import { systemConfig } from "../../config/system-config";
import { SystemConfig } from "../../../../projects/ngx-ramblers/src/app/models/system.model";

const debugLog = debug(envConfig.logNamespace("migration-runner"));
debugLog.enabled = true;

const CHANGELOG_COLLECTION = "changelog";
const CHANGELOG_SIMULATION_COLLECTION = "changelogSimulation";

const normalizeMigrationFileName = (fileName: string) => fileName?.replace(/\.ts$/, ".js");

function manualMigrationFileNames(): Set<string> {
  return new Set(
    (migrateMongoConfig().manualMigrations || [])
      .map(normalizeMigrationFileName)
      .filter(Boolean)
  );
}

type MigrationMetadata = {
  manual: boolean;
};

const mongoClientCache: { client?: MongoClient } = {};

async function mongoClient(): Promise<MongoClient> {
  if (mongoClientCache.client) {
    return mongoClientCache.client;
  }
  const config = migrateMongoConfig();
  mongoClientCache.client = await MongoClient.connect(config.mongodb.url, config.mongodb.options);
  return mongoClientCache.client;
}

export async function closeMigrationConnection(): Promise<void> {
  if (mongoClientCache.client) {
    await mongoClientCache.client.close();
    delete mongoClientCache.client;
    debugLog("Closed migration runner connection");
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    debugLog("Closed mongoose connection");
  }
}

function appliedAtTimestamp(value: any): string | undefined {
  if (!value) {
    return undefined;
  }
  if (isString(value)) {
    const parsed = dateTimeFromIso(value);
    return parsed.isValid ? parsed.toISO() : undefined;
  }
  if (isNumber(value)) {
    const parsed = dateTimeFromMillis(value);
    return parsed.isValid ? parsed.toISO() : undefined;
  }
  return dateTimeFromJsDate(value as Date).toISO();
}

async function activeChangelogCollection(): Promise<string> {
  try {
    return mongooseClient.execute(() => systemConfig()
      .then((sysConfig: SystemConfig) => {
        return sysConfig?.activeChangelogCollection || CHANGELOG_COLLECTION;
      })
    );
  } catch (error) {
    debugLog("Error reading activeChangelogCollection, defaulting to changelog:", error);
    return CHANGELOG_COLLECTION;
  }
}

async function setActiveChangelogCollection(collectionName: string): Promise<void> {
  await mongooseClient.execute(() => systemConfig()
    .then((sysConfig: SystemConfig) => {
      if (sysConfig) {
        sysConfig.activeChangelogCollection = collectionName;
        const db = mongoose.connection.db;
        const configCollection = db.collection("config");
        return configCollection.updateOne(
          {key: ConfigKey.SYSTEM},
          {$set: {"value.activeChangelogCollection": collectionName}}
        );
      }
    })
  );
}

export async function setMigrationSimulation(pending: number, failed: boolean) {
  try {
    const currentState = await readMigrationSimulation();
    if (currentState.active) {
      debugLog("Simulation already active, skipping setup");
      return;
    }

    const client = await mongoClient();
    const db = client.db();

    const sourceCollection = db.collection(CHANGELOG_COLLECTION);
    const targetCollection = db.collection(CHANGELOG_SIMULATION_COLLECTION);

    await targetCollection.deleteMany({});

    const existingEntries = await sourceCollection.find({}).toArray();
    if (existingEntries.length > 0) {
      await targetCollection.insertMany(existingEntries);
    }

    if (failed) {
      const SIMULATED_QUALIFIER = " Don't worry - this is a simulated error and not produced by a real migration.";
      await targetCollection.insertMany([
        {
          fileName: "20251022220737-migrate-inline-content-text.js",
          appliedAt: dateTimeNow().toJSDate(),
          error: "TypeError: Cannot read property 'text' of undefined at line 42. " +
            "The contentText document was not found in the collection." + SIMULATED_QUALIFIER
        },
        {
          fileName: "20250115000000-example-failed-migration.js",
          appliedAt: dateTimeNow().toJSDate(),
          error: "MongoServerError: E11000 duplicate key error collection: ramblers.pageContent index: _id_ dup key: " +
            "{ _id: ObjectId('507f1f77bcf86cd799439011') }" + SIMULATED_QUALIFIER
        }
      ]);
    }

    await setActiveChangelogCollection(CHANGELOG_SIMULATION_COLLECTION);
    debugLog("Migration simulation enabled: copied changelog to changelogSimulation");
  } catch (error) {
    debugLog("Failed to enable simulation:", error);
    throw error;
  }
}

export async function clearMigrationSimulation() {
  try {
    const client = await mongoClient();
    const db = client.db();

    await db.collection(CHANGELOG_SIMULATION_COLLECTION).drop().catch(() => {
    });

    const changelogCollection = db.collection(CHANGELOG_COLLECTION);
    const result = await changelogCollection.deleteMany({
      fileName: {
        $in: [
          "20251022220737-migrate-inline-content-text.js",
          "20251022220737-migrate-inline-content-text.ts",
          "20250115000000-example-failed-migration.js",
          "20250115000000-example-failed-migration.ts"
        ]
      }
    });
    debugLog(`Removed ${result.deletedCount} simulated entries from changelog collection`);

    await setActiveChangelogCollection(CHANGELOG_COLLECTION);
    debugLog("Migration simulation cleared: dropped changelogSimulation, reset to changelog");
  } catch (error) {
    debugLog("Failed to clear simulation:", error);
    throw error;
  }
}

export async function readMigrationSimulation() {
  try {
    const collectionName = await activeChangelogCollection();
    return {
      active: collectionName === CHANGELOG_SIMULATION_COLLECTION,
      collection: collectionName
    };
  } catch (error) {
    debugLog("Error reading simulation state:", error);
    return {
      active: false,
      collection: CHANGELOG_COLLECTION
    };
  }
}

export async function clearFailedMigrations() {
  try {
    const client = await mongoClient();
    const db = client.db();
    const collectionName = await activeChangelogCollection();
    const changelogCollection = db.collection(collectionName);

    const result = await changelogCollection.deleteMany({ error: { $exists: true } });
    debugLog(`Removed ${result.deletedCount} failed migration entries from ${collectionName} collection`);

    return { success: true, deletedCount: result.deletedCount };
  } catch (error) {
    debugLog("Failed to clear failed migrations:", error);
    throw error;
  }
}

export class MigrationRunner {
  private normalizedToActualFileMap = new Map<string, string>();
  private migrationMetadataCache = new Map<string, MigrationMetadata>();
  private async loadMigrationMetadata(normalizedFileName: string, actualFileName?: string): Promise<MigrationMetadata> {
    if (!normalizedFileName) {
      return { manual: false };
    }
    if (this.migrationMetadataCache.has(normalizedFileName)) {
      return this.migrationMetadataCache.get(normalizedFileName)!;
    }
    if (!actualFileName) {
      const metadata = { manual: false };
      this.migrationMetadataCache.set(normalizedFileName, metadata);
      return metadata;
    }
    try {
      const migrationPath = path.join(migrateMongoConfig().migrationsDir, actualFileName);
      const loadedMigration = await import(migrationPath);
      const metadata = { manual: Boolean(loadedMigration?.manual) };
      this.migrationMetadataCache.set(normalizedFileName, metadata);
      return metadata;
    } catch (error) {
      debugLog(`Failed to load migration metadata for ${normalizedFileName}:`, error);
      const metadata = { manual: false };
      this.migrationMetadataCache.set(normalizedFileName, metadata);
      return metadata;
    }
  }

  private async isManualMigration(fileName: string, actualFileName?: string): Promise<boolean> {
    if (!fileName) {
      return false;
    }
    const normalized = normalizeMigrationFileName(fileName);
    if (!normalized) {
      return false;
    }
    if (manualMigrationFileNames().has(normalized)) {
      return true;
    }
    const metadata = await this.loadMigrationMetadata(normalized, actualFileName);
    return metadata.manual;
  }

  async migrationStatus(): Promise<MigrationStatus> {
    const status: MigrationStatus = {
      files: [],
      failed: false
    };

    try {
      const client = await mongoClient();
      const db = client.db();
      const collectionName = await activeChangelogCollection();
      debugLog("Using collection:", collectionName);
      const changelogCollection = db.collection(collectionName);
      const appliedMigrations = await changelogCollection.find({}).toArray();
      debugLog("Found", appliedMigrations.length, "entries in", collectionName);
      const appliedMap = new Map<string, { startedAt?: string; timestamp?: string; error?: string }>();

      appliedMigrations.forEach((m: any) => {
        appliedMap.set(m.fileName, {
          startedAt: appliedAtTimestamp(m.startedAt),
          timestamp: appliedAtTimestamp(m.appliedAt),
          error: m.error || undefined
        });
      });

      const allFiles: string[] = [];
      this.normalizedToActualFileMap.clear();
      const config = migrateMongoConfig();

      if (fs.existsSync(config.migrationsDir)) {
        const filesOnDisk = fs.readdirSync(config.migrationsDir)
          .filter(f => (f.endsWith(".js") || f.endsWith(".ts")) && !f.endsWith(".d.ts") && !f.endsWith(".d.js"))
          .filter(f => /^\d{14}-.+/.test(f.replace(/\.(js|ts)$/, "")))
          .sort();

        for (const file of filesOnDisk) {
          const normalized = file.replace(/\.ts$/, ".js");
          if (!this.normalizedToActualFileMap.has(normalized)) {
            this.normalizedToActualFileMap.set(normalized, file);
            allFiles.push(normalized);
          }
        }
      }

      const files: MigrationFile[] = [];

      for (const fileName of allFiles) {
        const appliedAsIs = appliedMap.get(fileName);
        const appliedAsTs = appliedMap.get(fileName.replace(/\.js$/, ".ts"));
        const applied = appliedAsIs || appliedAsTs;
        const actualFileName = this.normalizedToActualFileMap.get(fileName) || fileName;
        const manual = await this.isManualMigration(fileName, actualFileName);

        if (applied?.error) {
            files.push({
              fileName,
              status: MigrationFileStatus.FAILED,
              startedAt: applied.startedAt,
              timestamp: applied.timestamp,
              error: applied.error,
              manual
            });
        } else if (applied) {
          files.push({
            fileName,
            status: MigrationFileStatus.APPLIED,
            startedAt: applied.startedAt,
            timestamp: applied.timestamp,
            manual
          });
        } else {
          files.push({
            fileName,
            status: MigrationFileStatus.PENDING,
            manual
          });
        }
      }

      for (const m of appliedMigrations) {
        const normalizedFileName = m.fileName.replace(/\.ts$/, ".js");
        if (!allFiles.includes(normalizedFileName) && m.error) {
          const manual = await this.isManualMigration(normalizedFileName);
          files.push({
            fileName: normalizedFileName,
            status: MigrationFileStatus.FAILED,
            timestamp: appliedAtTimestamp(m.appliedAt),
            error: m.error,
            manual
          });
        }
      }

      status.files = files;
      status.failed = files.some(f => f.status === MigrationFileStatus.FAILED);

    } catch (error) {
      status.failed = true;
      status.error = error.message;
      debugLog("Failed to get migration status:", error);
    }

    return status;
  }

  async runPendingMigrations(): Promise<MigrationRetryResult> {
    debugLog("Checking for pending migrations...");
    try {
      const config = migrateMongoConfig();
      if (!config) {
        return { success: false, error: "Migration configuration not found", appliedFiles: [] };
      }

      const status = await this.migrationStatus();

      if (status.error) {
        return { success: false, error: status.error, appliedFiles: [] };
      }

      const pendingFiles = status.files.filter(f => f.status === MigrationFileStatus.PENDING);
      const appliedCount = status.files.filter(f => f.status === MigrationFileStatus.APPLIED).length;
      const failedCount = status.files.filter(f => f.status === MigrationFileStatus.FAILED).length;

      debugLog(`Migration status: ${appliedCount} applied, ${pendingFiles.length} pending, ${failedCount} failed`);

      if (failedCount > 0) {
        const failedFileNames = status.files.filter(f => f.status === MigrationFileStatus.FAILED).map(f => f.fileName);
        debugLog(`Failed migrations: ${failedFileNames.join(", ")}`);
      }

      const manualPendingFiles = pendingFiles.filter(f => Boolean(f.manual));
      if (manualPendingFiles.length > 0) {
        debugLog(`Skipping ${manualPendingFiles.length} manual migration(s):`, manualPendingFiles.map(f => f.fileName));
      }

      const pendingFilesToRun = pendingFiles.filter(f => !Boolean(f.manual));

      if (pendingFilesToRun.length === 0) {
        debugLog("No pending migrations to apply (manual migrations skipped)");
        return { success: true, appliedFiles: [] };
      }

      debugLog(`Applying ${pendingFilesToRun.length} pending migration(s):`, pendingFilesToRun.map(f => f.fileName));

      const client = await mongoClient();
      const db = client.db();
      const collectionName = await activeChangelogCollection();
      const changelogCollection = db.collection(collectionName);

      const appliedFiles: string[] = [];

      for (const file of pendingFilesToRun) {
        const fileName = file.fileName;
        const actualFileName = this.normalizedToActualFileMap.get(fileName) || fileName;
        debugLog(`Running migration: ${fileName} (actual file: ${actualFileName})`);
        const migrationPath = path.join(config.migrationsDir, actualFileName);
        const startedAt = dateTimeNow().toJSDate();

        try {
          const loadedMigration = await import(migrationPath);
          const migration = loadedMigration.default || loadedMigration;

          if (!isFunction(migration.up)) {
            throw new Error(`Migration ${fileName} does not export an "up" function`);
          }

          await migration.up(db, client);

          await changelogCollection.insertOne({
            fileName,
            startedAt,
            appliedAt: dateTimeNow().toJSDate()
          });

          appliedFiles.push(fileName);
          debugLog(`Successfully applied migration: ${fileName}`);
        } catch (error) {
          debugLog(`Failed to apply migration ${fileName}:`, error);
          await changelogCollection.insertOne({
            fileName,
            startedAt,
            appliedAt: dateTimeNow().toJSDate(),
            error: error.message
          });
          return { success: false, error: `Migration ${fileName} failed: ${error.message}`, appliedFiles };
        }
      }

      debugLog(`Successfully applied ${appliedFiles.length} migration(s)`);
      return { success: true, appliedFiles };
    } catch (error) {
      debugLog("Error running migrations:", error);
      return { success: false, error: error.message, appliedFiles: [] };
    }
  }

  async runMigration(fileName: string): Promise<MigrationRetryResult> {
    const startedAt = dateTimeNow().toJSDate();
    try {
      const config = migrateMongoConfig();
      if (!config) {
        return { success: false, error: "Migration configuration not found", appliedFiles: [] };
      }

      const client = await mongoClient();
      const db = client.db();
      const collectionName = await activeChangelogCollection();
      const changelogCollection = db.collection(collectionName);
      await changelogCollection.deleteOne({ fileName });
      await changelogCollection.deleteOne({ fileName: fileName.replace(/\.js$/, ".ts") });
      const actualFileName = this.normalizedToActualFileMap.get(fileName) || fileName;
      const migrationPath = path.join(config.migrationsDir, actualFileName);
      const loadedMigration = await import(migrationPath);
      const migration = loadedMigration.default || loadedMigration;

      if (!isFunction(migration.up)) {
        return { success: false, error: `Migration ${fileName} does not export an "up" function`, appliedFiles: [] };
      }

      await migration.up(db, client);
      await changelogCollection.insertOne({ fileName, startedAt, appliedAt: dateTimeNow().toJSDate() });
      debugLog(`Successfully applied migration: ${fileName}`);
      return { success: true, appliedFiles: [fileName] };
    } catch (error) {
      const client = await mongoClient();
      const db = client.db();
      const collectionName = await activeChangelogCollection();
      const changelogCollection = db.collection(collectionName);
      await changelogCollection.insertOne({
        fileName,
        startedAt,
        appliedAt: dateTimeNow().toJSDate(),
        error: error.message
      });
      return { success: false, error: error.message, appliedFiles: [] };
    }
  }
}

export const migrationRunner = new MigrationRunner();
