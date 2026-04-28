import { Db } from "mongodb";
import { CONTENT_TEXT_COLLECTION } from "./collection-names";

export interface ContentTextEntry {
  name?: string;
  category?: string;
  text?: string;
}

export async function upsertContentText(db: Db, entry: ContentTextEntry, log?: (msg: string) => void): Promise<void> {
  if (!entry.name || !entry.category || entry.text === undefined) {
    throw new Error(`upsertContentText requires name, category and text; got name=${entry.name}, category=${entry.category}, text=${entry.text === undefined ? "undefined" : "set"}`);
  }
  const collection = db.collection(CONTENT_TEXT_COLLECTION);
  const existing = await collection.findOne({ name: entry.name, category: entry.category });
  if (existing) {
    await collection.updateOne({ _id: existing._id }, { $set: { text: entry.text } });
    log?.(`Updated content text: ${entry.name}`);
    return;
  }
  await collection.insertOne({ ...entry });
  log?.(`Added content text: ${entry.name}`);
}

export async function deleteContentText(db: Db, name: string, category: string, log?: (msg: string) => void): Promise<void> {
  const collection = db.collection(CONTENT_TEXT_COLLECTION);
  await collection.deleteOne({ name, category });
  log?.(`Removed content text: ${name}`);
}
