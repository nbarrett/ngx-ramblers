import mongoose from "mongoose";
import { CollectionInfo, IndexDescriptionInfo, MongoClient } from "mongodb";
import { isEqual, values } from "es-toolkit/compat";
import { EnvironmentConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { EmptyCollectionCandidate, EmptyCollectionCleanupPreview, EmptyCollectionCleanupResult, EnvironmentCollectionInventory, EnvironmentContentCollectionCount } from "../../../projects/ngx-ramblers/src/app/models/environment-collection-cleanup.model";
import { configuredEnvironments } from "../environments/environments-config";
import { registrationSettings } from "../site-registration/registration-store";
import { buildMongoUri } from "../shared/mongodb-uri";
import { collectionIndexesMatchSchema } from "../mongo/utils/collection-indexes";

function collectionCanBeRebuilt(collection: CollectionInfo | null, indexes: IndexDescriptionInfo[]): boolean {
  const model = values(mongoose.models).find(entry => entry.collection.name === collection?.name) || null;
  return collection?.type === "collection" && !collection.name.startsWith("system.")
    && isEqual(collection.options, {}) && collectionIndexesMatchSchema(model, indexes);
}

function candidateKey(candidate: EmptyCollectionCandidate): string {
  return `${candidate.cluster}/${candidate.environment}/${candidate.database}/${candidate.collection}`;
}

async function emptyCollections(environment: EnvironmentConfig): Promise<EnvironmentCollectionInventory> {
  const mongo = environment.mongo;
  if (!mongo?.cluster || !mongo.db || !mongo.username || !mongo.password) {
    return {candidates: [], contentCollectionCount: 0};
  } else {
    const client = new MongoClient(buildMongoUri({cluster: mongo.cluster, username: mongo.username, password: mongo.password, database: mongo.db}), {serverSelectionTimeoutMS: 12000, connectTimeoutMS: 12000});
    try {
      await client.connect();
      const database = client.db(mongo.db);
      const collections = await database.listCollections({}, {nameOnly: false}).toArray();
      const collectionResults = await Promise.all(collections.map(async collection => {
        if (collection.type !== "collection" || collection.name.startsWith("system.")) {
          return {candidate: null, hasContent: false};
        } else {
          const target = database.collection(collection.name);
          const [documentCount, indexes] = await Promise.all([target.countDocuments({}), target.indexes()]);
          return {
            candidate: documentCount === 0 && collectionCanBeRebuilt(collection, indexes)
              ? {environment: environment.environment, cluster: mongo.cluster, database: mongo.db, collection: collection.name, documentCount, indexCount: indexes.length}
              : null,
            hasContent: documentCount > 0
          };
        }
      }));
      return {
        candidates: collectionResults.flatMap(result => result.candidate ? [result.candidate] : []),
        contentCollectionCount: collectionResults.filter(result => result.hasContent).length
      };
    } finally {
      await client.close();
    }
  }
}

export async function emptyCollectionCleanupPreview(selectedCluster: string): Promise<EmptyCollectionCleanupPreview> {
  const config = await configuredEnvironments();
  const settings = await registrationSettings();
  const environments = (config.environments || []).filter(environment => environment.environment !== settings.sourceEnvironmentName && environment.mongo?.cluster === selectedCluster);
  const inventory = await Promise.all(environments.map(async environment => ({environment: environment.environment, result: await emptyCollections(environment)})));
  const candidates = inventory.flatMap(entry => entry.result.candidates)
      .sort((left, right) => left.environment.localeCompare(right.environment) || left.collection.localeCompare(right.collection));
  const contentCollectionCounts: EnvironmentContentCollectionCount[] = inventory.map(entry => ({environment: entry.environment, count: entry.result.contentCollectionCount}));
  return {cluster: selectedCluster, candidates, contentCollectionCounts};
}

export async function removeEmptyCollections(selectedCluster: string, selected: EmptyCollectionCandidate[]): Promise<EmptyCollectionCleanupResult> {
  const preview = await emptyCollectionCleanupPreview(selectedCluster);
  const selectedKeys = new Set(selected.map(candidateKey));
  const candidates = preview.candidates.filter(candidate => selectedKeys.has(candidateKey(candidate)));
  const config = await configuredEnvironments();
  const environments = config.environments || [];
  const results = await Promise.all(candidates.map(async candidate => {
    const environment = environments.find(entry => entry.environment === candidate.environment && entry.mongo?.db === candidate.database && entry.mongo?.cluster === candidate.cluster);
    const mongo = environment?.mongo;
    if (!mongo?.cluster || !mongo.username || !mongo.password) {
      return {candidate, removed: false};
    } else {
      const client = new MongoClient(buildMongoUri({cluster: mongo.cluster, username: mongo.username, password: mongo.password, database: mongo.db}), {serverSelectionTimeoutMS: 12000, connectTimeoutMS: 12000});
      try {
        await client.connect();
        const database = client.db(mongo.db);
        const collection = database.collection(candidate.collection);
        const [documentCount, indexes, collectionInfo] = await Promise.all([
          collection.countDocuments({}),
          collection.indexes(),
          database.listCollections<CollectionInfo>({name: candidate.collection}, {nameOnly: false}).next()
        ]);
        if (documentCount === 0 && collectionCanBeRebuilt(collectionInfo, indexes)) {
          await collection.drop();
          return {candidate, removed: true};
        } else {
          return {candidate, removed: false};
        }
      } finally {
        await client.close();
      }
    }
  }));
  const removed = results.filter(result => result.removed).map(result => result.candidate);
  const removedKeys = new Set(removed.map(candidateKey));
  return {removed, skipped: selected.filter(candidate => !removedKeys.has(candidateKey(candidate)))};
}
