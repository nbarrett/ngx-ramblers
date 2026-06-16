import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";

const debugLog = createMigrationLogger("add-inbox-thread-subject");

export async function up(db: Db, client: MongoClient) {
  const threads = db.collection("inboxThreads");
  const messages = db.collection("inboxMessages");
  const cursor = threads.find({ $or: [{ subject: { $exists: false } }, { subject: "" }] });
  let updated = 0;
  for await (const thread of cursor) {
    const firstMessageId = thread.messageIds?.[0];
    const message = (firstMessageId && await messages.findOne({ messageId: firstMessageId }))
      || await messages.find({ threadId: thread._id.toString() }).sort({ receivedAt: 1, sentAt: 1 }).limit(1).next();
    const subject = (message?.subject ?? "").trim();
    if (subject) {
      await threads.updateOne({ _id: thread._id }, { $set: { subject } });
      updated++;
    }
  }
  debugLog(`backfilled subject on ${updated} inbox thread(s)`);
}

export async function down(db: Db, client: MongoClient) {
  debugLog("No down migration - inbox thread subject backfill left in place");
}
