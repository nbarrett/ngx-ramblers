import { Command } from "commander";
import debug from "debug";
import { MongoClient } from "mongodb";
import { envConfig } from "../../env-config/env-config";
import {
  ReinitDatabaseParams,
  reinitialiseDatabase,
  seedSampleData,
  validateMongoConnection
} from "../../environment-setup/database-initialiser";
import { loadSecretsForEnvironment } from "../../shared/secrets";
import { parseMongoUri } from "../../shared/mongodb-uri";
import { findEnvironmentFromDatabase } from "../../environments/environments-config";
import { ProgressCallback, SeedConfig, ValidationResult } from "../types";
import { log } from "../cli-logger";
import { MigrationRunner } from "../../mongo/migrations/migrations-runner";
import { syncWalksManagerData } from "../../walks/walks-manager-sync";
import { SystemConfig } from "../../../../projects/ngx-ramblers/src/app/models/system.model";
import { ConfigKey } from "../../../../projects/ngx-ramblers/src/app/models/config.model";

const debugLog = debug(envConfig.logNamespace("cli:database"));

async function clearForFreshSeed(mongoUri: string, database: string, onProgress?: ProgressCallback): Promise<void> {
  const client = await MongoClient.connect(mongoUri);
  const db = client.db(database);

  try {
    onProgress?.({ step: "Clearing changelog", status: "running", timestamp: Date.now() });
    await db.collection("changelog").deleteMany({});
    onProgress?.({ step: "Clearing changelog", status: "completed", timestamp: Date.now() });

    onProgress?.({ step: "Clearing page content", status: "running", timestamp: Date.now() });
    await db.collection("pageContent").deleteMany({});
    onProgress?.({ step: "Clearing page content", status: "completed", timestamp: Date.now() });
  } finally {
    await client.close();
  }
}

async function runFullSync(mongoUri: string, database: string, onProgress?: ProgressCallback): Promise<void> {
  const client = await MongoClient.connect(mongoUri);
  const db = client.db(database);

  try {
    onProgress?.({ step: "Loading system config", status: "running", timestamp: Date.now() });
    const configDoc = await db.collection("config").findOne({ key: ConfigKey.SYSTEM });
    if (!configDoc?.value) {
      throw new Error("System config not found in database");
    }
    const systemConfig = configDoc.value as SystemConfig;
    onProgress?.({ step: "Loading system config", status: "completed", timestamp: Date.now() });

    onProgress?.({ step: "Running full data sync", status: "running", timestamp: Date.now() });
    const result = await syncWalksManagerData(systemConfig, { fullSync: true }, null);

    if (result.errors.length > 0) {
      onProgress?.({
        step: "Running full data sync",
        status: "completed",
        message: `Added ${result.added}, updated ${result.updated}, deleted ${result.deleted}. Errors (${result.errors.length}):\n${result.errors.join("\n")}`,
        timestamp: Date.now()
      });
    } else {
      onProgress?.({
        step: "Running full data sync",
        status: "completed",
        message: `Added ${result.added}, updated ${result.updated}, deleted ${result.deleted}`,
        timestamp: Date.now()
      });
    }
  } finally {
    await client.close();
  }
}

export async function seedDatabase(config: SeedConfig, onProgress?: ProgressCallback): Promise<void> {
  debugLog("Seeding database:", config.database);

  await seedSampleData(
    {
      mongoUri: config.mongoUri,
      database: config.database,
      groupName: config.groupName,
      groupShortName: config.groupShortName
    },
    onProgress
  );

  debugLog("Database seeding completed");
}

export async function reinitDatabase(config: ReinitDatabaseParams, onProgress?: ProgressCallback): Promise<void> {
  debugLog("Reinitialising database:", config.database);

  await reinitialiseDatabase(config, onProgress);

  debugLog("Database reinitialisation completed");
}

export async function validateDatabase(config: { uri: string; database: string }): Promise<ValidationResult> {
  return validateMongoConnection(config);
}

async function resolveMongoUri(name: string): Promise<SeedConfig | null> {
  const envConfig = await findEnvironmentFromDatabase(name);
  if (!envConfig) {
    debugLog("Environment not found:", name);
    return null;
  }

  const secrets = loadSecretsForEnvironment(envConfig.appName);
  const mongoUri = secrets.secrets.MONGODB_URI;

  if (!mongoUri) {
    debugLog("MONGODB_URI not found in secrets for:", envConfig.appName);
    return null;
  }

  const mongoInfo = parseMongoUri(mongoUri);
  if (!mongoInfo) {
    debugLog("Failed to parse MongoDB URI");
    return null;
  }

  return {
    mongoUri,
    database: mongoInfo.database,
    groupName: mongoInfo.groupName
  };
}

export function createDatabaseCommand(): Command {
  const database = new Command("database")
    .alias("db")
    .description("Database management commands");

  database
    .command("seed [name]")
    .description("Seed database with sample data")
    .option("--uri <uri>", "MongoDB connection URI (alternative to name)")
    .option("--database <database>", "Database name (required with --uri)")
    .option("--group-name <groupName>", "Group name for sample data (required with --uri)")
    .option("--fresh", "Clear changelog and page content before seeding (runs all migrations fresh)")
    .option("--sync", "Run full data sync from Ramblers API after seeding")
    .action(async (name, options) => {
      try {
        let config: SeedConfig;

        if (name) {
          const resolved = await resolveMongoUri(name);
          if (!resolved) {
            log("Failed to resolve MongoDB URI for environment: %s", name);
            process.exit(1);
          }
          config = resolved;
        } else if (options.uri && options.database && options.groupName) {
          config = {
            mongoUri: options.uri,
            database: options.database,
            groupName: options.groupName
          };
        } else {
          log("Either <name> or (--uri, --database, --group-name) are required");
          process.exit(1);
        }

        const progressLogger = (progress: { step: string; status: string; message?: string }) => {
          log("[%s] %s%s", progress.status, progress.step, progress.message ? `: ${progress.message}` : "");
        };

        if (options.fresh) {
          log("Fresh seed: clearing changelog and page content for %s", config.database);
          await clearForFreshSeed(config.mongoUri, config.database, progressLogger);
        }

        log("Seeding database: %s", config.database);

        await seedDatabase(config, progressLogger);

        if (options.sync) {
          log("Running full data sync...");
          await runFullSync(config.mongoUri, config.database, progressLogger);
        }

        log("✓ Database seeding completed");
      } catch (error) {
        log("Error: %s", error.message);
        process.exit(1);
      }
    });

  database
    .command("validate [name]")
    .description("Validate database connection")
    .option("--uri <uri>", "MongoDB connection URI (alternative to name)")
    .option("--database <database>", "Database name (required with --uri)")
    .action(async (name, options) => {
      try {
        let uri: string;
        let database: string;

        if (name) {
          const resolved = await resolveMongoUri(name);
          if (!resolved) {
            log("Failed to resolve MongoDB URI for environment: %s", name);
            process.exit(1);
          }
          uri = resolved.mongoUri;
          database = resolved.database;
        } else if (options.uri && options.database) {
          uri = options.uri;
          database = options.database;
        } else {
          log("Either <name> or (--uri, --database) are required");
          process.exit(1);
        }

        log("Validating connection to: %s", database);
        const result = await validateDatabase({uri, database});

        log("%s %s", result.valid ? "✓" : "✗", result.message);
        process.exit(result.valid ? 0 : 1);
      } catch (error) {
        log("Error: %s", error.message);
        process.exit(1);
      }
    });

  database
    .command("migrate [name]")
    .description("Run pending database migrations")
    .action(async name => {
      try {
        if (name) {
          const resolved = await resolveMongoUri(name);
          if (!resolved) {
            log("Failed to resolve MongoDB URI for environment: %s", name);
            process.exit(1);
          }
          process.env.MONGODB_URI = resolved.mongoUri;
        }

        log("Running pending migrations...");
        const runner = new MigrationRunner();
        const status = await runner.migrationStatus();

        const pending = status.files.filter(f => f.status === "pending");
        const failed = status.files.filter(f => f.status === "failed");
        const applied = status.files.filter(f => f.status === "applied");

        log("Status: %d applied, %d pending, %d failed", applied.length, pending.length, failed.length);

        if (pending.length === 0) {
          log("No pending migrations");
          process.exit(0);
        }

        const result = await runner.runPendingMigrations();

        if (result.success) {
          log("✓ Applied %d migration(s)", result.appliedFiles.length);
          result.appliedFiles.forEach(f => log("  - %s", f));
        } else {
          log("✗ Migration failed: %s", result.error);
          process.exit(1);
        }
      } catch (error) {
        log("Error: %s", error.message);
        process.exit(1);
      }
    });

  return database;
}
