import expect from "expect";
import { describe, it } from "mocha";
import sinon from "sinon";
import { ObjectId } from "mongodb";
import { ContentTextSeedResult } from "../../../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { CONTENT_TEXT_APP_COLLECTION, insertMissingContentText } from "./upsert-content-text";

const ENTRY = { name: "expenses-detailed-help", category: "admin", text: "Claim travel for a recce." };

function dbWithContentText(collectionApi: Record<string, unknown>) {
  const collection = sinon.stub();
  collection.withArgs(CONTENT_TEXT_APP_COLLECTION).returns(collectionApi);
  return { collection } as any;
}

describe("insertMissingContentText", () => {
  it("inserts when name and category are absent", async () => {
    const insertOne = sinon.stub().resolves();
    const findOne = sinon.stub().resolves(null);
    const result = await insertMissingContentText(dbWithContentText({ findOne, insertOne }), ENTRY);
    expect(result).toBe(ContentTextSeedResult.INSERTED);
    expect(insertOne.firstCall.args[0]).toEqual(ENTRY);
  });

  it("fills empty text and sets the catalog category", async () => {
    const id = new ObjectId();
    const findOne = sinon.stub();
    findOne.onFirstCall().resolves(null);
    findOne.onSecondCall().resolves({ _id: id, name: ENTRY.name, text: "   " });
    const updateOne = sinon.stub().resolves();
    const result = await insertMissingContentText(dbWithContentText({ findOne, updateOne }), ENTRY);
    expect(result).toBe(ContentTextSeedResult.FILLED);
    expect(updateOne.firstCall.args).toEqual([
      { _id: id },
      { $set: { name: ENTRY.name, category: ENTRY.category, text: ENTRY.text } }
    ]);
  });

  it("leaves non-empty text unchanged", async () => {
    const findOne = sinon.stub().resolves({ _id: new ObjectId(), name: ENTRY.name, category: ENTRY.category, text: "Local group wording" });
    const insertOne = sinon.stub();
    const updateOne = sinon.stub();
    const result = await insertMissingContentText(dbWithContentText({ findOne, insertOne, updateOne }), ENTRY);
    expect(result).toBe(ContentTextSeedResult.SKIPPED);
    expect(insertOne.called).toBe(false);
    expect(updateOne.called).toBe(false);
  });

  it("does not insert a second record when a nameless-category copy already has text", async () => {
    const findOne = sinon.stub();
    findOne.onFirstCall().resolves(null);
    findOne.onSecondCall().resolves({ _id: new ObjectId(), name: "meetup-help", text: "Existing Meetup help" });
    const insertOne = sinon.stub();
    const result = await insertMissingContentText(
      dbWithContentText({ findOne, insertOne }),
      { name: "meetup-help", category: "walks-admin", text: "Catalog Meetup help" }
    );
    expect(result).toBe(ContentTextSeedResult.SKIPPED);
    expect(insertOne.called).toBe(false);
  });
});
