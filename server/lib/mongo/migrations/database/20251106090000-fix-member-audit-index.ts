import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";

const debugLog = createMigrationLogger("fix-member-audit-index");

export async function up(db: Db, client: MongoClient) {
  const collection = db.collection("memberAudit");

  debugLog("Checking memberAudit indexes");
  const indexes = await collection.indexes();
  const uniqueIndexName = "member.userName_1";

  const hasUniqueMemberUserName = indexes.some(i => i.name === uniqueIndexName && i.unique === true);
  if (hasUniqueMemberUserName) {
    await collection.dropIndex(uniqueIndexName);
    debugLog(`Dropped unique index ${uniqueIndexName}`);
  } else {
    debugLog(`No unique ${uniqueIndexName} index to drop`);
  }

  const userNameIndexName = "userName_1";
  const hasUserNameIndex = indexes.some(i => i.name === userNameIndexName);
  if (!hasUserNameIndex) {
    await collection.createIndex({ userName: 1 }, { unique: false });
    debugLog("Created non-unique index on userName");
  } else {
    debugLog("Non-unique index on userName already exists");
  }
}

export async function down(db: Db, client: MongoClient) {
  const collection = db.collection("memberAudit");

  try {
    await collection.dropIndex("userName_1");
    debugLog("Dropped index userName_1");
  } catch (error: any) {
    debugLog("userName_1 not present or already dropped:", error.message);
  }

  try {
    await collection.createIndex({ "member.userName": 1 }, { unique: true });
    debugLog("Recreated unique index on member.userName");
  } catch (error: any) {
    debugLog("Failed to recreate unique index on member.userName:", error.message);
  }
}

