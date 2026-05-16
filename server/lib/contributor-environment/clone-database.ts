import debug from "debug";
import mongoose from "mongoose";
import { envConfig } from "../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("contributor-environment:clone-database"));
debugLog.enabled = true;

export async function databaseHasCollections(databaseName: string): Promise<boolean> {
  const client = mongoose.connection.getClient();
  const collections = await client.db(databaseName).listCollections().toArray();
  return collections.length > 0;
}

export async function cloneDatabase(sourceDatabase: string, targetDatabase: string): Promise<void> {
  const client = mongoose.connection.getClient();
  const source = client.db(sourceDatabase);
  const target = client.db(targetDatabase);
  const collections = await source.listCollections().toArray();
  debugLog("Cloning %d collections from %s to %s", collections.length, sourceDatabase, targetDatabase);
  for (const collection of collections) {
    const documents = await source.collection(collection.name).find().toArray();
    if (documents.length > 0) {
      await target.collection(collection.name).insertMany(documents);
    }
    debugLog("Cloned %d documents into %s.%s", documents.length, targetDatabase, collection.name);
  }
}
