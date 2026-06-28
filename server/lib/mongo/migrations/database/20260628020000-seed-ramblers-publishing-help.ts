import { Db } from "mongodb";
import { findContentEntry } from "../../../../../projects/ngx-ramblers/src/app/pages/admin/default-content";
import createMigrationLogger from "../migrations-logger";

const debugLog = createMigrationLogger("seed-ramblers-publishing-help");
const CONTENT_TEXT_COLLECTION = "contentText";
const NAME = "ramblers-publishing-help";
const CATEGORY = "walks-admin";

function ramblersPublishingHelp() {
  const contentEntry = findContentEntry(NAME, CATEGORY);
  if (!contentEntry) {
    throw new Error(`Default content entry not found for ${CATEGORY}/${NAME}`);
  }
  return contentEntry;
}

export async function up(db: Db) {
  const contentEntry = ramblersPublishingHelp();
  const result = await db.collection(CONTENT_TEXT_COLLECTION).updateOne(
    {name: contentEntry.name, category: contentEntry.category},
    {$set: contentEntry},
    {upsert: true}
  );
  debugLog("Seeded content text %s/%s matched=%d upserted=%s", contentEntry.category, contentEntry.name, result.matchedCount, result.upsertedId || "none");
}

export async function down(db: Db) {
  const contentEntry = ramblersPublishingHelp();
  const result = await db.collection(CONTENT_TEXT_COLLECTION).deleteOne({
    name: contentEntry.name,
    category: contentEntry.category,
    text: contentEntry.text
  });
  debugLog("Removed seeded content text %s/%s deleted=%d", contentEntry.category, contentEntry.name, result.deletedCount);
}
