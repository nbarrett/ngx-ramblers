import mongoose from "mongoose";
import { CollectionInfo, Db, IndexDescriptionInfo, MongoClient, MongoClientOptions } from "mongodb";
import { groupBy, isEqual, values } from "es-toolkit/compat";
import { EnvironmentConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { EmptyCollectionCandidate, EmptyCollectionCleanupPreview, EmptyCollectionCleanupResult, EnvironmentCollectionInventory, EnvironmentContentCollectionCount } from "../../../projects/ngx-ramblers/src/app/models/environment-collection-cleanup.model";
import { configuredEnvironments } from "../environments/environments-config";
import { registrationSettings } from "../site-registration/registration-store";
import { buildMongoUri } from "../shared/mongodb-uri";
import { collectionIndexesMatchSchema } from "../mongo/utils/collection-indexes";

const MONGO_CLIENT_OPTIONS: MongoClientOptions = {serverSelectionTimeoutMS: 12000, connectTimeoutMS: 12000, maxPoolSize: 1};

function collectionCanBeRebuilt(collection: CollectionInfo | null, indexes: IndexDescriptionInfo[]): boolean {
  const model = values(mongoose.models).find(entry => entry.collection.name === collection?.name) || null;
  return collection?.type === "collection" && !collection.name.startsWith("system.")
    && isEqual(collection.options, {}) && collectionIndexesMatchSchema(model, indexes);
}

function candidateKey(candidate: EmptyCollectionCandidate): string {
  return `${candidate.cluster}/${candidate.environment}/${candidate.database}/${candidate.collection}`;
}

function databaseKey(candidate: EmptyCollectionCandidate): string {
  return `${candidate.cluster}/${candidate.environment}/${candidate.database}`;
}

async function emptyCollections(environment: EnvironmentConfig): Promise<EnvironmentCollectionInventory> {
  const mongo = environment.mongo;
  if (!mongo?.cluster || !mongo.db || !mongo.username || !mongo.password) {
    return {candidates: [], contentCollectionCount: 0};
  } else {
    const client = new MongoClient(buildMongoUri({cluster: mongo.cluster, username: mongo.username, password: mongo.password, database: mongo.db}), MONGO_CLIENT_OPTIONS);
    try {
      await client.connect();
      const database = client.db(mongo.db);
      const collections = await database.listCollections({}, {nameOnly: false}).toArray();
      const collectionResults = await collections.reduce(async (previous, collection) => {
        const soFar = await previous;
        if (collection.type !== "collection" || collection.name.startsWith("system.")) {
          return [...soFar, {candidate: null, hasContent: false}];
        } else {
          const target = database.collection(collection.name);
          const [documentCount, indexes] = await Promise.all([target.countDocuments({}), target.indexes()]);
          return [...soFar, {
            candidate: documentCount === 0 && collectionCanBeRebuilt(collection, indexes)
              ? {environment: environment.environment, cluster: mongo.cluster, database: mongo.db, collection: collection.name, documentCount, indexCount: indexes.length}
              : null,
            hasContent: documentCount > 0
          }];
        }
      }, Promise.resolve([] as {candidate: EmptyCollectionCandidate | null; hasContent: boolean}[]));
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
  const inventory = await environments.reduce(async (previous, environment) => {
    const soFar = await previous;
    return [...soFar, {environment: environment.environment, result: await emptyCollections(environment)}];
  }, Promise.resolve([] as {environment: string; result: EnvironmentCollectionInventory}[]));
  const candidates = inventory.flatMap(entry => entry.result.candidates)
      .sort((left, right) => left.environment.localeCompare(right.environment) || left.collection.localeCompare(right.collection));
  const contentCollectionCounts: EnvironmentContentCollectionCount[] = inventory.map(entry => ({environment: entry.environment, count: entry.result.contentCollectionCount}));
  return {cluster: selectedCluster, candidates, contentCollectionCounts};
}

async function dropCandidateIfEligible(database: Db, candidate: EmptyCollectionCandidate): Promise<boolean> {
  const collection = database.collection(candidate.collection);
  const [documentCount, indexes, collectionInfo] = await Promise.all([
    collection.countDocuments({}),
    collection.indexes(),
    database.listCollections<CollectionInfo>({name: candidate.collection}, {nameOnly: false}).next()
  ]);
  if (documentCount === 0 && collectionCanBeRebuilt(collectionInfo, indexes)) {
    await collection.drop();
    return true;
  } else {
    return false;
  }
}

export async function removeEmptyCollections(selectedCluster: string, selected: EmptyCollectionCandidate[]): Promise<EmptyCollectionCleanupResult> {
  const config = await configuredEnvironments();
  const settings = await registrationSettings();
  const environments = (config.environments || []).filter(environment => environment.environment !== settings.sourceEnvironmentName);
  const grouped = values(groupBy(selected.filter(candidate => candidate.cluster === selectedCluster), databaseKey));
  const results = await grouped.reduce(async (previous, group) => {
    const soFar = await previous;
    const first = group[0];
    const environment = environments.find(entry => entry.environment === first.environment && entry.mongo?.db === first.database && entry.mongo?.cluster === first.cluster);
    const mongo = environment?.mongo;
    if (!mongo?.cluster || !mongo.username || !mongo.password) {
      return [...soFar, ...group.map(candidate => ({candidate, removed: false}))];
    } else {
      const client = new MongoClient(buildMongoUri({cluster: mongo.cluster, username: mongo.username, password: mongo.password, database: mongo.db}), MONGO_CLIENT_OPTIONS);
      try {
        await client.connect();
        const database = client.db(mongo.db);
        const groupResults = await group.reduce(async (innerPrevious, candidate) => {
          const innerSoFar = await innerPrevious;
          const removed = await dropCandidateIfEligible(database, candidate);
          return [...innerSoFar, {candidate, removed}];
        }, Promise.resolve([] as {candidate: EmptyCollectionCandidate; removed: boolean}[]));
        return [...soFar, ...groupResults];
      } finally {
        await client.close();
      }
    }
  }, Promise.resolve([] as {candidate: EmptyCollectionCandidate; removed: boolean}[]));
  const removed = results.filter(result => result.removed).map(result => result.candidate);
  const removedKeys = new Set(removed.map(candidateKey));
  return {removed, skipped: selected.filter(candidate => !removedKeys.has(candidateKey(candidate)))};
}
