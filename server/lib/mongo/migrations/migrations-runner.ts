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
  MigrationStatus,
  MigrationUpResult
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

const normaliseMigrationFileName = (fileName: string) => fileName?.replace(/\.ts$/, ".js");

const MANUAL_FLAG_PATTERN = /(?:export\s+const\s+manual|exports\.manual)\s*(?::[^=]+)?=\s*(?:true|!0)\b/;

const RETIRED_BREVO_TEMPLATE_MIGRATIONS = new Set([
  "20260120000000-update-brevo-transactional-template.js",
  "20260206000000-sync-all-brevo-templates.js",
  "20260406000000-apply-ramblers-aligned-email-templates.js",
  "20260406210000-refresh-ramblers-email-templates.js",
  "20260503120000-sync-brevo-templates-body-content-placement.js"
].map(normaliseMigrationFileName));

const RETIRED_BREVO_TEMPLATE_SKIP_REASON =
  "Email templates are rendered in NGX and sent via the Brevo API; Brevo no longer stores templates";

function isRetiredBrevoTemplateMigration(fileName: string): boolean {
  return RETIRED_BREVO_TEMPLATE_MIGRATIONS.has(normaliseMigrationFileName(fileName));
}

function isExternalEmailServiceFailure(message: string): boolean {
  return /brevo|sendinblue|smtp template|invalid_parameter|err_body|sandbox restriction|dkim|domain authentication|template.*create failed|template.*update failed|failed processing template/i.test(message);
}

function manualMigrationFileNames(): Set<string> {
  return new Set(
    (migrateMongoConfig().manualMigrations || [])
      .map(normaliseMigrationFileName)
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
    const skippedReason = "Ignored by admin after failure";
    const result = await changelogCollection.updateMany(
      {error: {$exists: true, $ne: null}},
      {$set: {skippedReason, appliedAt: dateTimeNow().toJSDate()}, $unset: {error: ""}}
    );
    debugLog(`Ignored ${result.modifiedCount} failed migration entries in ${collectionName} (marked skipped)`);
    return {success: true, deletedCount: result.modifiedCount};
  } catch (error) {
    debugLog("Failed to clear failed migrations:", error);
    throw error;
  }
}

export class MigrationRunner {
  private normalisedToActualFileMap = new Map<string, string>();
  private migrationMetadataCache = new Map<string, MigrationMetadata>();
  private async loadMigrationMetadata(normalisedFileName: string, actualFileName?: string): Promise<MigrationMetadata> {
    if (!normalisedFileName) {
      return { manual: false };
    }
    if (this.migrationMetadataCache.has(normalisedFileName)) {
      return this.migrationMetadataCache.get(normalisedFileName)!;
    }
    if (!actualFileName) {
      const metadata = { manual: false };
      this.migrationMetadataCache.set(normalisedFileName, metadata);
      return metadata;
    }
    try {
      const migrationPath = path.join(migrateMongoConfig().migrationsDir, actualFileName);
      const source = fs.readFileSync(migrationPath, "utf-8");
      const metadata = { manual: MANUAL_FLAG_PATTERN.test(source) };
      this.migrationMetadataCache.set(normalisedFileName, metadata);
      return metadata;
    } catch (error) {
      debugLog(`Failed to load migration metadata for ${normalisedFileName}:`, error);
      const metadata = { manual: false };
      this.migrationMetadataCache.set(normalisedFileName, metadata);
      return metadata;
    }
  }

  private async isManualMigration(fileName: string, actualFileName?: string): Promise<boolean> {
    if (!fileName) {
      return false;
    }
    const normalised = normaliseMigrationFileName(fileName);
    if (!normalised) {
      return false;
    }
    if (manualMigrationFileNames().has(normalised)) {
      return true;
    }
    const metadata = await this.loadMigrationMetadata(normalised, actualFileName);
    return metadata.manual;
  }

  async migrationStatus(): Promise<MigrationStatus> {
    const status: MigrationStatus = {
      files: [],
      failed: false
    };

    const startedAtMs = dateTimeNow().toMillis();
    let clientReadyMs = startedAtMs;
    let collectionResolvedMs = startedAtMs;
    let changelogQueriedMs = startedAtMs;
    try {
      const client = await mongoClient();
      clientReadyMs = dateTimeNow().toMillis();
      const db = client.db();
      const collectionName = await activeChangelogCollection();
      collectionResolvedMs = dateTimeNow().toMillis();
      debugLog("Using collection:", collectionName);
      const changelogCollection = db.collection(collectionName);
      await this.retireBrevoTemplateMigrationsInChangelog(changelogCollection);
      const appliedMigrations = await changelogCollection.find({}).toArray();
      changelogQueriedMs = dateTimeNow().toMillis();
      debugLog("Found", appliedMigrations.length, "entries in", collectionName);
      const appliedMap = new Map<string, { startedAt?: string; timestamp?: string; error?: string; skippedReason?: string }>();

      appliedMigrations.forEach((m: any) => {
        appliedMap.set(m.fileName, {
          startedAt: appliedAtTimestamp(m.startedAt),
          timestamp: appliedAtTimestamp(m.appliedAt),
          error: m.error || undefined,
          skippedReason: m.skippedReason || undefined
        });
      });

      const allFiles: string[] = [];
      this.normalisedToActualFileMap.clear();
      const config = migrateMongoConfig();

      if (fs.existsSync(config.migrationsDir)) {
        const filesOnDisk = fs.readdirSync(config.migrationsDir)
          .filter(f => (f.endsWith(".js") || f.endsWith(".ts")) && !f.endsWith(".d.ts") && !f.endsWith(".d.js"))
          .filter(f => /^\d{14}-.+/.test(f.replace(/\.(js|ts)$/, "")))
          .sort();

        for (const file of filesOnDisk) {
          const normalised = file.replace(/\.ts$/, ".js");
          if (!this.normalisedToActualFileMap.has(normalised)) {
            this.normalisedToActualFileMap.set(normalised, file);
            allFiles.push(normalised);
          }
        }
      }

      const files: MigrationFile[] = [];

      for (const fileName of allFiles) {
        const appliedAsIs = appliedMap.get(fileName);
        const appliedAsTs = appliedMap.get(fileName.replace(/\.js$/, ".ts"));
        const applied = appliedAsIs || appliedAsTs;
        const actualFileName = this.normalisedToActualFileMap.get(fileName) || fileName;
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
        } else if (applied?.skippedReason) {
          files.push({
            fileName,
            status: MigrationFileStatus.SKIPPED,
            startedAt: applied.startedAt,
            timestamp: applied.timestamp,
            skippedReason: applied.skippedReason,
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
        const normalisedFileName = m.fileName.replace(/\.ts$/, ".js");
        if (!allFiles.includes(normalisedFileName) && m.error) {
          const manual = await this.isManualMigration(normalisedFileName);
          files.push({
            fileName: normalisedFileName,
            status: MigrationFileStatus.FAILED,
            timestamp: appliedAtTimestamp(m.appliedAt),
            error: m.error,
            manual
          });
        }
      }

      status.files = files;
      status.failed = files.some(f => f.status === MigrationFileStatus.FAILED);

      const fileLoopDoneMs = dateTimeNow().toMillis();
      debugLog("migrationStatus timings(ms):",
        "mongoClient=", clientReadyMs - startedAtMs,
        "activeCollection=", collectionResolvedMs - clientReadyMs,
        "changelogQuery=", changelogQueriedMs - collectionResolvedMs,
        "fileLoop=", fileLoopDoneMs - changelogQueriedMs,
        "total=", fileLoopDoneMs - startedAtMs,
        "files=", allFiles.length);

    } catch (error) {
      status.failed = true;
      status.error = error.message;
      debugLog("Failed to get migration status:", error);
    }

    return status;
  }

  async runPendingMigrations(): Promise<MigrationRetryResult> {
    debugLog("Checking for pending and failed migrations...");
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
      const failedFiles = status.files.filter(f => f.status === MigrationFileStatus.FAILED);
      const appliedCount = status.files.filter(f => f.status === MigrationFileStatus.APPLIED).length;
      const skippedCount = status.files.filter(f => f.status === MigrationFileStatus.SKIPPED).length;

      debugLog(`Migration status: ${appliedCount} applied, ${skippedCount} skipped, ${pendingFiles.length} pending, ${failedFiles.length} failed`);

      if (failedFiles.length > 0) {
        debugLog(`Failed migrations to retry: ${failedFiles.map(f => f.fileName).join(", ")}`);
      }

      const manualPendingFiles = pendingFiles.filter(f => Boolean(f.manual));
      if (manualPendingFiles.length > 0) {
        debugLog(`Skipping ${manualPendingFiles.length} manual migration(s):`, manualPendingFiles.map(f => f.fileName));
      }

      const filesToRun = [
        ...pendingFiles.filter(f => !Boolean(f.manual)),
        ...failedFiles.filter(f => !Boolean(f.manual))
      ];

      if (filesToRun.length === 0) {
        debugLog("No pending or failed migrations to apply (manual migrations skipped)");
        return { success: true, appliedFiles: [] };
      }

      debugLog(`Applying ${filesToRun.length} migration(s):`, filesToRun.map(f => f.fileName));

      const client = await mongoClient();
      const db = client.db();
      const collectionName = await activeChangelogCollection();
      const changelogCollection = db.collection(collectionName);

      const appliedFiles: string[] = [];

      for (const file of filesToRun) {
        const fileName = file.fileName;
        const actualFileName = this.normalisedToActualFileMap.get(fileName) || fileName;
        debugLog(`Running migration: ${fileName} (actual file: ${actualFileName})`);
        const migrationPath = path.join(config.migrationsDir, actualFileName);
        const startedAt = dateTimeNow().toJSDate();

        try {
          if (file.status === MigrationFileStatus.FAILED) {
            await changelogCollection.deleteOne({fileName});
            await changelogCollection.deleteOne({fileName: fileName.replace(/\.js$/, ".ts")});
          }

          if (isRetiredBrevoTemplateMigration(fileName)) {
            await changelogCollection.insertOne({
              fileName,
              startedAt,
              appliedAt: dateTimeNow().toJSDate(),
              skippedReason: RETIRED_BREVO_TEMPLATE_SKIP_REASON
            });
            debugLog(`Retired Brevo template migration skipped: ${fileName}`);
            appliedFiles.push(fileName);
            continue;
          }

          const loadedMigration = await import(migrationPath);
          const migration = loadedMigration.default || loadedMigration;

          if (!isFunction(migration.up)) {
            throw new Error(`Migration ${fileName} does not export an "up" function`);
          }

          const upResult: MigrationUpResult = await migration.up(db, client) || {};

          const changelogEntry: Record<string, any> = {
            fileName,
            startedAt,
            appliedAt: dateTimeNow().toJSDate()
          };

          if (upResult.skipped) {
            changelogEntry.skippedReason = upResult.reason || "Migration skipped";
            debugLog(`Migration skipped: ${fileName} — ${changelogEntry.skippedReason}`);
          } else {
            debugLog(`Successfully applied migration: ${fileName}`);
          }

          await changelogCollection.insertOne(changelogEntry);
          appliedFiles.push(fileName);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          debugLog(`Failed to apply migration ${fileName}:`, error);
          if (isExternalEmailServiceFailure(errorMessage)) {
            const skippedReason = `Skipped after external email/Brevo failure: ${errorMessage}`;
            debugLog(skippedReason);
            await changelogCollection.insertOne({
              fileName,
              startedAt,
              appliedAt: dateTimeNow().toJSDate(),
              skippedReason
            });
            appliedFiles.push(fileName);
          } else {
            await changelogCollection.insertOne({
              fileName,
              startedAt,
              appliedAt: dateTimeNow().toJSDate(),
              error: errorMessage
            });
            return { success: false, error: `Migration ${fileName} failed: ${errorMessage}`, appliedFiles };
          }
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
      const normalisedName = normaliseMigrationFileName(fileName);

      if (isRetiredBrevoTemplateMigration(normalisedName)) {
        await changelogCollection.insertOne({
          fileName: normalisedName,
          startedAt,
          appliedAt: dateTimeNow().toJSDate(),
          skippedReason: RETIRED_BREVO_TEMPLATE_SKIP_REASON
        });
        debugLog(`Retired Brevo template migration skipped: ${normalisedName}`);
        return { success: true, appliedFiles: [normalisedName] };
      }

      const actualFileName = this.normalisedToActualFileMap.get(normalisedName) || fileName;
      const migrationPath = path.join(config.migrationsDir, actualFileName);
      const loadedMigration = await import(migrationPath);
      const migration = loadedMigration.default || loadedMigration;

      if (!isFunction(migration.up)) {
        return { success: false, error: `Migration ${fileName} does not export an "up" function`, appliedFiles: [] };
      }

      const upResult: MigrationUpResult = await migration.up(db, client) || {};

      const changelogEntry: Record<string, any> = { fileName: normalisedName, startedAt, appliedAt: dateTimeNow().toJSDate() };

      if (upResult.skipped) {
        changelogEntry.skippedReason = upResult.reason || "Migration skipped";
        debugLog(`Migration skipped: ${normalisedName} — ${changelogEntry.skippedReason}`);
      } else {
        debugLog(`Successfully applied migration: ${normalisedName}`);
      }

      await changelogCollection.insertOne(changelogEntry);
      return { success: true, appliedFiles: [normalisedName] };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const client = await mongoClient();
      const db = client.db();
      const collectionName = await activeChangelogCollection();
      const changelogCollection = db.collection(collectionName);
      const normalisedName = normaliseMigrationFileName(fileName);
      if (isExternalEmailServiceFailure(errorMessage) || isRetiredBrevoTemplateMigration(normalisedName)) {
        const skippedReason = isRetiredBrevoTemplateMigration(normalisedName)
          ? RETIRED_BREVO_TEMPLATE_SKIP_REASON
          : `Skipped after external email/Brevo failure: ${errorMessage}`;
        debugLog(skippedReason);
        await changelogCollection.insertOne({
          fileName: normalisedName,
          startedAt,
          appliedAt: dateTimeNow().toJSDate(),
          skippedReason
        });
        return { success: true, appliedFiles: [normalisedName] };
      }
      await changelogCollection.insertOne({
        fileName: normalisedName,
        startedAt,
        appliedAt: dateTimeNow().toJSDate(),
        error: errorMessage
      });
      return { success: false, error: errorMessage, appliedFiles: [] };
    }
  }

  private async retireBrevoTemplateMigrationsInChangelog(changelogCollection: any): Promise<void> {
    const retiredNames = Array.from(RETIRED_BREVO_TEMPLATE_MIGRATIONS);
    const failedRetired = await changelogCollection.updateMany(
      {
        error: {$exists: true, $ne: null},
        $or: [
          {fileName: {$in: retiredNames}},
          {fileName: {$in: retiredNames.map(name => name.replace(/\.js$/, ".ts"))}}
        ]
      },
      {$set: {skippedReason: RETIRED_BREVO_TEMPLATE_SKIP_REASON, appliedAt: dateTimeNow().toJSDate()}, $unset: {error: ""}}
    );
    if (failedRetired.modifiedCount > 0) {
      debugLog(`Auto-retired ${failedRetired.modifiedCount} failed Brevo template migration(s) as skipped`);
    }
    const missing = await Promise.all(retiredNames.map(async fileName => {
      const existing = await changelogCollection.findOne({
        $or: [{fileName}, {fileName: fileName.replace(/\.js$/, ".ts")}]
      });
      if (existing) {
        return null;
      }
      await changelogCollection.insertOne({
        fileName,
        appliedAt: dateTimeNow().toJSDate(),
        skippedReason: RETIRED_BREVO_TEMPLATE_SKIP_REASON
      });
      return fileName;
    }));
    const inserted = missing.filter(Boolean);
    if (inserted.length > 0) {
      debugLog(`Recorded ${inserted.length} missing retired Brevo template migration(s) as skipped:`, inserted);
    }
  }
}

export const migrationRunner = new MigrationRunner();
