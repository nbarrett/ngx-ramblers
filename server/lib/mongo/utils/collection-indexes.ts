import { CollectionIndexCache } from "./collection-indexes.model";
import mongoose, { Model, Query, Schema } from "mongoose";
import { Collection, CollectionInfo, CreateIndexesOptions, Db, IndexDescriptionInfo, IndexDirection, IndexSpecification } from "mongodb";
import { fromPairs, isEqual, sortBy, toPairs, values } from "es-toolkit/compat";

const legacyCollectionIndexes = new WeakMap<Schema, [IndexSpecification, CreateIndexesOptions, CreateIndexesOptions][]>();

export function registerLegacyCollectionIndex(schema: Schema, keys: IndexSpecification, options: CreateIndexesOptions): void {
  const canonicalOptions = schema.indexes().find(([indexKeys]) => isEqual(indexKeys, keys))?.[1];
  if (canonicalOptions) {
    legacyCollectionIndexes.set(schema, [...(legacyCollectionIndexes.get(schema) ?? []), [keys, canonicalOptions as CreateIndexesOptions, options]]);
  }
}

export function collectionIndexesMatchSchema(model: Model<unknown> | null, existing: IndexDescriptionInfo[]): boolean {
  const schemaIndexes = [
    {key: {_id: 1}, name: "_id_"},
    ...(model?.schema.indexes() || []).map(([keys, options]) => ({
      ...options,
      key: keys,
      name: options.name || toPairs(keys).map(([field, direction]) => `${field}_${direction}`).join("_")
    }))
  ];
  return isEqual(sortBy(existing.map(comparableCollectionIndex), "name"), sortBy(schemaIndexes.map(comparableCollectionIndex), "name"));
}

function comparableCollectionIndex(index: Record<string, unknown>): Record<string, unknown> {
  return fromPairs(toPairs(index)
    .filter(([option]) => !["v", "ns", "background"].includes(option))
    .map(([option, value]) => [option, option === "key" ? toPairs(value as Record<string, unknown>) : value]));
}

function acceptedLegacyIndex(schema: Schema, keys: IndexSpecification, options: CreateIndexesOptions, existing: IndexDescriptionInfo[]): boolean {
  return (legacyCollectionIndexes.get(schema) ?? []).some(([legacyKeys, canonicalOptions, legacyOptions]) =>
    isEqual(keys, legacyKeys) && isEqual(options, canonicalOptions) && existing.some(index =>
      isEqual(collectionIndexKeys(index), legacyKeys) && toPairs(legacyOptions)
        .filter(([option]) => option !== "name" && option !== "background")
        .every(([option, value]) => isEqual(index[option], value))));
}

const indexedSchemas = new WeakSet<Schema>();
const databaseIndexes = new WeakMap<Db, WeakMap<Model<unknown>, CollectionIndexCache>>();

export async function ensureCollectionIndexes(model: Model<unknown>, createIfMissing = false): Promise<void> {
  if (model.schema.indexes().length > 0) {
    if (!model.db.db) {
      await model.db.asPromise();
    }
    const database = model.db.db;
    const pendingIndexes = databaseIndexes.get(database) || new WeakMap<Model<unknown>, CollectionIndexCache>();
    databaseIndexes.set(database, pendingIndexes);
    const collection = await database.listCollections<CollectionInfo>({name: model.collection.name}, {nameOnly: false}).next();
    const identity = collection?.info?.uuid?.toString("hex") || null;
    const existing = pendingIndexes.get(model);
    if (existing?.building) {
      await existing.pending;
      await ensureCollectionIndexes(model, createIfMissing);
    } else if (existing && identity && existing.collectionIdentity === identity) {
      await existing.pending;
    } else if (!collection && !createIfMissing) {
      pendingIndexes.delete(model);
    } else {
      const cache: CollectionIndexCache = {collectionIdentity: null, building: true, pending: Promise.resolve()};
      cache.pending = (async () => {
        const difference = await model.diffIndexes({indexOptionsToCreate: true});
        const storedIndexes = legacyCollectionIndexes.has(model.schema) && collection
          ? await database.collection(model.collection.name).indexes()
          : [];
        const toCreate = difference.toCreate.filter(([keys, options]) => !acceptedLegacyIndex(model.schema, keys, options, storedIndexes));
        if (toCreate.length > 0) {
          await model.createIndexes({toCreate} as CreateIndexesOptions);
        }
        const createdCollection = await database.listCollections<CollectionInfo>({name: model.collection.name}, {nameOnly: false}).next();
        cache.collectionIdentity = createdCollection?.info?.uuid?.toString("hex") || null;
      })();
      pendingIndexes.set(model, cache);
      try {
        await cache.pending;
      } catch (error) {
        pendingIndexes.delete(model);
        throw error;
      } finally {
        cache.building = false;
      }
    }
  }
}

export function lazyCollectionIndexes(schema: Schema): void {
  if (!indexedSchemas.has(schema)) {
    indexedSchemas.add(schema);
    schema.pre("save", async function() {
      await ensureCollectionIndexes(this.constructor as Model<unknown>, true);
    });
    schema.pre("insertMany", async function(_next, documents) {
      if (documents.length > 0) {
        await ensureCollectionIndexes(this as Model<unknown>, true);
      }
    });
    schema.pre(["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "findOneAndReplace"], async function(this: Query<unknown, unknown>) {
      await ensureCollectionIndexes(this.model, this.getOptions().upsert === true);
    });
    schema.pre("bulkWrite", async function(_next, operations) {
      const createsCollection = operations.some(operation => ("insertOne" in operation) || ("replaceOne" in operation && operation.replaceOne.upsert === true) || ("updateOne" in operation && operation.updateOne.upsert === true) || ("updateMany" in operation && operation.updateMany.upsert === true));
      await ensureCollectionIndexes(this as Model<unknown>, createsCollection);
    });
  }
}

export async function indexExistingCollections(database: Db): Promise<void> {
  const collections = new Set((await database.listCollections({}, {nameOnly: true}).toArray()).map(collection => collection.name));
  const models = values(mongoose.models).filter(model => collections.has(model.collection.name));
  await Promise.all(models.map(model => ensureCollectionIndexesInDatabase(database, model, false)));
}

export async function ensureCollectionIndexesInDatabase<T>(database: Db, model: Model<T>, createIfMissing = true): Promise<void> {
  const schemaIndexes = model.schema.indexes();
  const collectionInfo = await database.listCollections<CollectionInfo>({name: model.collection.name}, {nameOnly: false}).next();
  if (schemaIndexes.length > 0 && (collectionInfo || createIfMissing)) {
    const collection = database.collection(model.collection.name);
    const existing = collectionInfo ? await collection.indexes() : [];
    const missing = schemaIndexes.filter(([keys, options]) => !existing.some(index =>
      isEqual(collectionIndexKeys(index), keys) && toPairs(options)
        .filter(([option]) => option !== "name" && option !== "background")
        .every(([option, value]) => isEqual(index[option], value))) &&
      !acceptedLegacyIndex(model.schema, keys as IndexSpecification, options as CreateIndexesOptions, existing));
    await Promise.all(missing.map(([keys, options]) => collection.createIndex(keys as IndexSpecification, options as CreateIndexesOptions)));
  }
}

export async function copyCollectionIndexes(source: Collection, target: Collection): Promise<void> {
  const indexes = await source.indexes();
  for (const index of indexes.filter(index => index.name !== "_id_")) {
    const {key, v: _version, ns: _namespace, ...options} = index;
    await target.createIndex(collectionIndexKeys(index) as IndexSpecification, options);
  }
}

function collectionIndexKeys(index: IndexDescriptionInfo): Record<string, unknown> {
  return fromPairs(toPairs(index.key).flatMap<[string, IndexDirection]>(([field, direction]) => {
    if (field === "_fts") {
      return toPairs(index.weights || {}).map(([name]): [string, IndexDirection] => [name, "text"]);
    } else if (field === "_ftsx") {
      return [];
    } else {
      return [[field, direction]];
    }
  }));
}
