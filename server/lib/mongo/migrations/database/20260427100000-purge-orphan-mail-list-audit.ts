import { Db, MongoClient, ObjectId } from "mongodb";
import createMigrationLogger from "../migrations-logger";

const debugLog = createMigrationLogger("purge-orphan-mail-list-audit");

export async function up(db: Db, _client: MongoClient): Promise<void> {
  const memberIdDocs = await db.collection("members").find({}, { projection: { _id: 1 } }).toArray();
  const validMemberIds = new Set(memberIdDocs.map(doc => doc._id?.toString()).filter(Boolean));
  debugLog("Found %d existing members", validMemberIds.size);

  const auditCollection = db.collection("mailListAudit");
  const auditCount = await auditCollection.countDocuments({});
  debugLog("Found %d mailListAudit rows total before cleanup", auditCount);

  const cursor = auditCollection.find({ memberId: { $exists: true, $ne: null } }, { projection: { _id: 1, memberId: 1 } });
  const orphanIds: ObjectId[] = [];
  for await (const row of cursor) {
    const memberId: string | undefined = row.memberId;
    if (memberId && !validMemberIds.has(memberId)) {
      orphanIds.push(row._id);
    }
  }
  debugLog("Identified %d orphan mailListAudit rows to delete", orphanIds.length);

  if (orphanIds.length === 0) {
    return;
  }
  const result = await auditCollection.deleteMany({ _id: { $in: orphanIds } });
  debugLog("Deleted %d orphan mailListAudit rows", result.deletedCount || 0);
}

export async function down(_db: Db, _client: MongoClient): Promise<void> {
  // No-op: orphan rows cannot be reconstructed.
}
