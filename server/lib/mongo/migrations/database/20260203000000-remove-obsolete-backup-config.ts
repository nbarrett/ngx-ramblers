import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";

const debugLog = createMigrationLogger("remove-obsolete-backup-config");
const CONFIG_COLLECTION = "configs";
const OBSOLETE_BACKUP_KEY = "backup";

export async function up(db: Db, client: MongoClient) {
  const collection = db.collection(CONFIG_COLLECTION);

  const existingBackupConfig = await collection.findOne({ key: OBSOLETE_BACKUP_KEY });

  if (!existingBackupConfig) {
    debugLog("No obsolete backup config found, nothing to remove");
    return;
  }

  debugLog(`Found obsolete backup config document with id: ${existingBackupConfig._id}`);

  const deleteResult = await collection.deleteOne({ key: OBSOLETE_BACKUP_KEY });

  if (deleteResult.deletedCount > 0) {
    debugLog("Successfully removed obsolete backup config document");
  } else {
    debugLog("Failed to delete backup config document");
  }
}

export async function down(db: Db, client: MongoClient) {
  debugLog("No down migration - backup config key has been permanently removed from the codebase");
}
