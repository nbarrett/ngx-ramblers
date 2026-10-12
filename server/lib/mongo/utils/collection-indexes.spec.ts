import expect from "expect";
import sinon from "sinon";
import Kareem from "kareem";
import mongoose, { Model, Schema } from "mongoose";
import { afterEach, describe, it } from "mocha";
import { get } from "es-toolkit/compat";
import { copyCollectionIndexes, ensureCollectionIndexes, indexExistingCollections, lazyCollectionIndexes } from "./collection-indexes";

function fictionalModel(present: boolean) {
  const hasNext = sinon.stub().resolves(present);
  const database = {listCollections: sinon.stub().returns({hasNext})};
  const connection = {db: database};
  const createIndexes = sinon.stub().resolves();
  const schema = new Schema({name: {type: String, unique: true}});
  const model = {schema, collection: {name: "fictionalRecords"}, db: connection, createIndexes, diffIndexes: async () => ({toCreate: schema.indexes()})} as unknown as Model<unknown>;
  return {model, schema, database, connection, hasNext, createIndexes};
}

describe("lazy collection indexes", () => {
  const sandbox = sinon.createSandbox();
  afterEach(() => sandbox.restore());

  it("does not create a missing collection for an ordinary update", async () => {
    const fixture = fictionalModel(false);
    await ensureCollectionIndexes(fixture.model);
    expect(fixture.createIndexes.called).toBe(false);
    await ensureCollectionIndexes(fixture.model, true);
    expect(fixture.createIndexes.calledOnce).toBe(true);
  });

  it("shares one index build across concurrent first writes", async () => {
    const fixture = fictionalModel(true);
    await Promise.all([ensureCollectionIndexes(fixture.model), ensureCollectionIndexes(fixture.model), ensureCollectionIndexes(fixture.model, true)]);
    expect(fixture.createIndexes.calledOnce).toBe(true);
  });

  it("indexes a concurrent insert even when an update found no collection", async () => {
    const fixture = fictionalModel(false);
    await Promise.all([ensureCollectionIndexes(fixture.model), ensureCollectionIndexes(fixture.model, true)]);
    expect(fixture.createIndexes.calledOnce).toBe(true);
  });

  it("retries a failed index build instead of allowing an unindexed write", async () => {
    const fixture = fictionalModel(true);
    fixture.createIndexes.onFirstCall().rejects(new Error("Index failed"));
    await expect(ensureCollectionIndexes(fixture.model, true)).rejects.toThrow("Index failed");
    await ensureCollectionIndexes(fixture.model, true);
    expect(fixture.createIndexes.calledTwice).toBe(true);
  });

  it("builds indexes again when the model connects to a different database", async () => {
    const fixture = fictionalModel(true);
    await ensureCollectionIndexes(fixture.model, true);
    fixture.connection.db = {listCollections: fixture.database.listCollections} as never;
    await ensureCollectionIndexes(fixture.model, true);
    expect(fixture.createIndexes.calledTwice).toBe(true);
  });

  it("attaches write middleware once without attaching read middleware", () => {
    const fixture = fictionalModel(false);
    const pre = sandbox.spy(fixture.schema, "pre");
    lazyCollectionIndexes(fixture.schema);
    const registeredCount = pre.callCount;
    lazyCollectionIndexes(fixture.schema);
    expect(pre.callCount).toBe(registeredCount);
    expect(pre.calledWith("find" as never)).toBe(false);
  });

  it("does not manufacture collections during database seeding", async () => {
    const createIndex = sandbox.stub().resolves();
    const collection = sandbox.stub().returns({createIndex, indexes: async () => []});
    const database = {listCollections: sandbox.stub().returns({toArray: async () => [{name: "fictionalRecords"}]}), collection};
    const existing = fictionalModel(true).model;
    const absent = fictionalModel(false).model;
    absent.collection.name = "unusedRecords";
    sandbox.stub(mongoose, "models").value({Existing: existing, Absent: absent});
    await indexExistingCollections(database as never);
    expect(collection.calledWith("unusedRecords")).toBe(false);
    expect(createIndex.firstCall.args).toEqual([{name: 1}, {unique: true, background: true}]);
  });

  it("guards an upsert before its first document is written", async () => {
    const fixture = fictionalModel(false);
    lazyCollectionIndexes(fixture.schema);
    const query = {model: fixture.model, getOptions: () => ({upsert: true})};
    const hooks = get(fixture.schema, "s.hooks") as Kareem;
    await new Promise<void>((resolve, reject) => hooks.execPre("updateOne", query, [], (error: Error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    }));
    expect(fixture.createIndexes.calledOnce).toBe(true);
  });
  it("indexes insertMany before inserting documents", async () => {
    const fixture = fictionalModel(false);
    lazyCollectionIndexes(fixture.schema);
    const hooks = get(fixture.schema, "s.hooks") as Kareem;
    await new Promise<void>((resolve, reject) => hooks.execPre("insertMany", fixture.model, [[{name: "Fictional"}]], (error: Error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    }));
    expect(fixture.createIndexes.calledOnce).toBe(true);
  });

  it("copies unique and TTL indexes and reconstructs MongoDB text indexes", async () => {
    const source = {indexes: async () => [
      {name: "_id_", key: {_id: 1}, v: 2},
      {name: "email_1", key: {email: 1}, unique: true, v: 2, ns: "source.fictionalRecords"},
      {name: "expiry_1", key: {expiry: 1}, expireAfterSeconds: 60, v: 2},
      {name: "content_text", key: {_fts: "text", _ftsx: 1}, weights: {title: 5, content: 1}, textIndexVersion: 3, v: 2}
    ]};
    const target = {createIndex: sandbox.stub().resolves()};
    await copyCollectionIndexes(source as never, target as never);
    expect(target.createIndex.args).toEqual([
      [{email: 1}, {name: "email_1", unique: true}],
      [{expiry: 1}, {name: "expiry_1", expireAfterSeconds: 60}],
      [{title: "text", content: "text"}, {name: "content_text", weights: {title: 5, content: 1}, textIndexVersion: 3}]
    ]);
  });

});
