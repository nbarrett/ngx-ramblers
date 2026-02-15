import debug from "debug";
import { envConfig } from "../../env-config/env-config";
import { MongoClient } from "mongodb";
import { dateTimeNow } from "../../shared/dates";
import { migrateMongoConfig, MigrateMongoConfig } from "./migrations-config";

const debugLog = debug(envConfig.logNamespace("mark-migrations-applied"));
debugLog.enabled = true;

async function markMigrationsAsApplied(migrationFiles: string[], config: MigrateMongoConfig) {
  debugLog("Marking migrations as applied:", migrationFiles);

  try {
    const client = await MongoClient.connect(config.mongodb.url, config.mongodb.options);
    const db = client.db();
    const changelogCollection = db.collection(config.changelogCollectionName || "changelog");

    for (const fileName of migrationFiles) {
      const existing = await changelogCollection.findOne({ fileName });

      if (existing) {
        debugLog(`Migration ${fileName} is already marked as applied`);
      } else {
        await changelogCollection.insertOne({
          fileName,
          appliedAt: dateTimeNow().toJSDate()
        });
        debugLog(`Marked migration ${fileName} as applied`);
      }
    }

    await client.close();
    debugLog("Successfully marked all migrations as applied");
  } catch (error) {
    debugLog("Error marking migrations as applied:", error);
    throw error;
  }
}

const oldMigrationsUseJsExtensionAsThatIsWhatIsInProductionBuild = [
  "20240101000000-migrate-media-urls.js",
  "20240101000001-update-osmaps-urls.js",
  "20251022220623-cleanup-duplicate-page-content.js",
  "20260120000000-update-brevo-transactional-template.js",
  "20260206000000-sync-all-brevo-templates.js"
];

(async () => {
  try {
    await markMigrationsAsApplied(oldMigrationsUseJsExtensionAsThatIsWhatIsInProductionBuild, migrateMongoConfig());
    debugLog("Done");
    process.exit(0);
  } catch (error) {
    debugLog("Failed:", error);
    process.exit(1);
  }
})();
