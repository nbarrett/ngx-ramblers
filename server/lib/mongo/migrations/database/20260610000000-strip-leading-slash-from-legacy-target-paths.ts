import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";

const debugLog = createMigrationLogger("strip-leading-slash-from-legacy-target-paths");

export async function up(db: Db, client: MongoClient) {
  debugLog("Stripping leading slashes from legacyUrlMappings targetPath values");

  const result = await db.collection("legacyUrlMappings").updateMany(
    { targetPath: { $regex: /^\// } },
    [{ $set: { targetPath: { $ltrim: { input: "$targetPath", chars: "/" } } } }]
  );

  debugLog(`Updated ${result.modifiedCount} mappings`);
}

export async function down(db: Db, client: MongoClient) {
  debugLog("No down migration - leading slashes are normalised at redirect time either way");
}
