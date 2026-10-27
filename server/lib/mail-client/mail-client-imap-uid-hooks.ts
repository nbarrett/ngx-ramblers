import mongoose, { Model, Query, Schema } from "mongoose";
import { AnyBulkWriteOperation, Document } from "mongodb";
import { isArray, isObject, keys, values } from "es-toolkit/compat";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { CONFIG_COLLECTION, INBOX_MESSAGES_COLLECTION } from "../mongo/migrations/shared/collection-names";
import { MailClientUidDocument, MailClientUidWriteContext } from "./mail-client-imap-uid.model";
import { synchroniseImapThreadUids } from "./mail-client-imap-uid-store";

const writes = new WeakMap<object, MailClientUidWriteContext>();

function threadIdsFor(documents: MailClientUidDocument[], messages: boolean): string[] {
  return documents.map(document => messages ? document.threadId : String(document._id ?? "")).filter(Boolean);
}

async function captureWrite<T>(model: Model<T>, filters: Record<string, unknown>[], operations: AnyBulkWriteOperation<Document>[] = []): Promise<MailClientUidWriteContext> {
  const documents = filters.length ? await model.find({$or: filters}).select("_id threadId").lean() as MailClientUidDocument[] : [];
  return {
    threadIds: threadIdsFor(documents, model.collection.name === INBOX_MESSAGES_COLLECTION),
    documentIds: documents.map(document => String(document._id)),
    filters,
    operations
  };
}

async function completeWrite<T>(model: Model<T>, context: MailClientUidWriteContext, result: unknown): Promise<void> {
  const messages = model.collection.name === INBOX_MESSAGES_COLLECTION;
  const documents = isArray(result) ? result : isObject(result) ? [result] : [];
  const inserted = context.operations.flatMap(operation => "insertOne" in operation ? [operation.insertOne.document] : []);
  const direct = documents.concat(inserted) as MailClientUidDocument[];
  const mutation = result as {upsertedId?: {toString(): string}; upsertedIds?: Record<string, {toString(): string}>; insertedIds?: Record<string, {toString(): string}>};
  const identities = [...context.documentIds, ...direct.map(document => String(document._id ?? "")), String(mutation?.upsertedId ?? ""), ...values(mutation?.upsertedIds ?? {}).map(String), ...values(mutation?.insertedIds ?? {}).map(String)].filter(Boolean);
  const filters = context.filters.concat(identities.length ? [{_id: {$in: identities}}] : []);
  const updated = filters.length ? await model.find({$or: filters}).select("_id threadId").lean() as MailClientUidDocument[] : [];
  await synchroniseImapThreadUids(model.db.db, model.db.getClient(), [...context.threadIds, ...threadIdsFor(direct, messages), ...threadIdsFor(updated, messages)]);
}

async function imapUidTrackingEnabled<T>(model: Model<T>): Promise<boolean> {
  if (model.db.readyState === 1) {
    const config = await model.db.db.collection(CONFIG_COLLECTION).findOne({key: ConfigKey.BREVO}, {projection: {"value.allowMailClientAccess": 1}});
    return config?.value?.allowMailClientAccess === true;
  } else {
    return false;
  }
}

function membershipChanged(update: unknown): boolean {
  const membershipFields = ["threadId", "direction", "autoReply", "folder", "userFolderId", "tenantSlug", "roleType"];
  if (isArray(update) || !isObject(update)) {
    return true;
  } else {
    const fields = keys(update).flatMap(key => key.startsWith("$") ? keys(update[key]) : [key]);
    return fields.some(key => membershipFields.includes(key.split(".")[0]));
  }
}

export function maintainImapUids(schema: Schema): void {
  schema.post("save", async function(document) {
    const model = document.constructor as Model<unknown>;
    if (await imapUidTrackingEnabled(model)) {
      await completeWrite(model, {threadIds: [], documentIds: [], filters: [], operations: []}, document);
    }
  });
  schema.post("insertMany", async function(this: Model<unknown>, documents) {
    if (await imapUidTrackingEnabled(this)) {
      await completeWrite(this, {threadIds: [], documentIds: [], filters: [], operations: []}, documents);
    }
  });
  const mutations = ["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "findOneAndReplace", "deleteOne", "deleteMany", "findOneAndDelete"] as const;
  for (const mutation of mutations) {
    schema.pre(mutation, async function(this: Query<unknown, unknown>) {
      if ((["deleteOne", "deleteMany", "findOneAndDelete", "replaceOne", "findOneAndReplace"].includes(mutation) || membershipChanged(this.getUpdate())) && await imapUidTrackingEnabled(this.model)) {
        writes.set(this, await captureWrite(this.model, [this.getFilter()]));
      }
    });
    schema.post(mutation, async function(this: Query<unknown, unknown>, result) {
      const context = writes.get(this);
      if (context) {
        writes.delete(this);
        await completeWrite(this.model, context, result);
      }
    });
  }
}

export function withImapUidBulkWrites<T>(model: Model<T>): Model<T> {
  const bulkWrite = model.bulkWrite.bind(model);
  model.bulkWrite = (async (operations: AnyBulkWriteOperation<Document>[], options) => {
    const filters = operations.flatMap(operation => "updateOne" in operation ? [operation.updateOne.filter]
      : "updateMany" in operation ? [operation.updateMany.filter]
        : "replaceOne" in operation ? [operation.replaceOne.filter]
          : "deleteOne" in operation ? [operation.deleteOne.filter]
            : "deleteMany" in operation ? [operation.deleteMany.filter] : []);
    if (await imapUidTrackingEnabled(model)) {
      const context = await captureWrite(model, filters, operations);
      const result = await bulkWrite(operations, options);
      await completeWrite(model, context, result);
      return result;
    } else {
      return bulkWrite(operations, options);
    }
  }) as typeof model.bulkWrite;
  return model;
}

export async function initialiseMailClientImapUids(): Promise<void> {
  const {execute} = await import("../mongo/mongoose-client");
  const {bootstrapImapUids} = await import("./mail-client-imap-uid-store");
  await execute(async () => bootstrapImapUids(mongoose.connection.db, mongoose.connection.getClient()));
}
