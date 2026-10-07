import { Db } from "mongodb";
import { isString } from "es-toolkit/compat";
import { ContentTextSeedResult } from "../../../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { CONTENT_TEXT_COLLECTION } from "./collection-names";

export const CONTENT_TEXT_APP_COLLECTION = "contentText";

export interface ContentTextEntry {
  name?: string;
  category?: string;
  text?: string;
}

function blankText(text: unknown): boolean {
  return !isString(text) || text.trim().length === 0;
}

async function matchingContentText(db: Db, collectionName: string, entry: ContentTextEntry): Promise<Record<string, unknown> | null> {
  const collection = db.collection(collectionName);
  const withCategory = await collection.findOne({ name: entry.name, category: entry.category });
  const unmatchedCategory = withCategory ? null : await collection.findOne({
    name: entry.name,
    $or: [{ category: null }, { category: "" }, { category: { $exists: false } }]
  });
  return withCategory || unmatchedCategory;
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

export async function insertMissingContentText(
  db: Db,
  entry: ContentTextEntry,
  log?: (msg: string) => void,
  collectionName: string = CONTENT_TEXT_APP_COLLECTION
): Promise<ContentTextSeedResult> {
  if (!entry.name || !entry.category || entry.text === undefined) {
    throw new Error(`insertMissingContentText requires name, category and text; got name=${entry.name}, category=${entry.category}, text=${entry.text === undefined ? "undefined" : "set"}`);
  }
  const existing = await matchingContentText(db, collectionName, entry);
  const collection = db.collection(collectionName);
  const result = !existing
    ? ContentTextSeedResult.INSERTED
    : blankText(existing.text)
      ? ContentTextSeedResult.FILLED
      : ContentTextSeedResult.SKIPPED;
  if (result === ContentTextSeedResult.INSERTED) {
    await collection.insertOne({ name: entry.name, category: entry.category, text: entry.text });
    log?.(`Inserted content text: ${entry.name}`);
  } else if (result === ContentTextSeedResult.FILLED && existing) {
    await collection.updateOne(
      { _id: existing._id },
      { $set: { name: entry.name, category: entry.category, text: entry.text } }
    );
    log?.(`Filled empty content text: ${entry.name}`);
  } else {
    log?.(`Left existing content text: ${entry.name}`);
  }
  return result;
}

export async function deleteContentText(db: Db, name: string, category: string, log?: (msg: string) => void): Promise<void> {
  const collection = db.collection(CONTENT_TEXT_COLLECTION);
  await collection.deleteOne({ name, category });
  log?.(`Removed content text: ${name}`);
}
