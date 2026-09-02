import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { InboxThread } from "../../../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { inboxThreadSlug } from "../../../../../projects/ngx-ramblers/src/app/functions/inbox-thread";

const debugLog = createMigrationLogger("add-inbox-thread-slug");

export async function up(db: Db, _client: MongoClient) {
  const threads = db.collection("inboxThreads");
  const missing = await threads.find({$or: [{slug: {$exists: false}}, {slug: ""}]}).toArray();
  const progress = {updated: 0};
  await missing.reduce(async (previous, thread) => {
    await previous;
    const slug = inboxThreadSlug({
      normalisedSubject: thread.normalisedSubject,
      subject: thread.subject
    } as InboxThread);
    if (slug) {
      await threads.updateOne({_id: thread._id}, {$set: {slug}});
      progress.updated += 1;
    }
  }, Promise.resolve());
  await threads.createIndex({tenantSlug: 1, slug: 1, lastSeenAt: -1});
  debugLog(`backfilled slug on ${progress.updated} inbox thread(s)`);
}

export async function down(db: Db, _client: MongoClient) {
  debugLog("No down migration - inbox thread slug backfill left in place");
}
