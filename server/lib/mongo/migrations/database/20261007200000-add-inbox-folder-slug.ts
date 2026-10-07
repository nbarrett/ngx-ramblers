import { Db, MongoClient } from "mongodb";
import { keys } from "es-toolkit/compat";
import createMigrationLogger from "../migrations-logger";
import { InboxUserFolder } from "../../../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { inboxFolderSlug, uniqueInboxFolderSlug } from "../../../../../projects/ngx-ramblers/src/app/functions/inbox-thread";
import { INBOX_FOLDERS_COLLECTION } from "../shared/collection-names";

const debugLog = createMigrationLogger("add-inbox-folder-slug");

export async function up(db: Db, _client: MongoClient): Promise<void> {
  const folders = db.collection(INBOX_FOLDERS_COLLECTION);
  const existing = await folders.find({}).toArray() as unknown as InboxUserFolder[];
  const byTenant = existing.reduce<Record<string, InboxUserFolder[]>>((grouped, folder) => {
    const tenantSlug = folder.tenantSlug || "default";
    grouped[tenantSlug] = (grouped[tenantSlug] || []).concat(folder);
    return grouped;
  }, {});
  const progress = {updated: 0};
  await keys(byTenant).reduce(async (previousTenant, tenantSlug) => {
    await previousTenant;
    const taken: string[] = [];
    await byTenant[tenantSlug].reduce(async (previousFolder, folder) => {
      await previousFolder;
      const slug = uniqueInboxFolderSlug(folder.slug || inboxFolderSlug(folder.name), taken);
      taken.push(slug);
      if (folder.slug !== slug) {
        await folders.updateOne({_id: (folder as unknown as {_id: unknown})._id}, {$set: {slug}});
        progress.updated += 1;
      }
    }, Promise.resolve());
  }, Promise.resolve());
  await folders.createIndex({tenantSlug: 1, slug: 1}, {unique: true, name: "tenantSlug_1_slug_1"});
  debugLog(`backfilled slug on ${progress.updated} inbox folder(s)`);
}

export async function down(db: Db, _client: MongoClient): Promise<void> {
  try {
    await db.collection(INBOX_FOLDERS_COLLECTION).dropIndex("tenantSlug_1_slug_1");
    debugLog("Inbox folder slug index dropped; slug values left in place");
  } catch (error) {
    debugLog("Inbox folder slug index already absent: %s", (error as Error).message);
  }
}
