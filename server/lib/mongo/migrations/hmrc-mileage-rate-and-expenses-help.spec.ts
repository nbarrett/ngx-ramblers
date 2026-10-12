import {Db} from "mongodb";
import expect from "expect";
import {describe, it} from "mocha";
import sinon from "sinon";
import {up} from "./database/20261012120000-hmrc-mileage-rate-and-expenses-help";
import {CONFIG_COLLECTION, CONTENT_TEXT_COLLECTION} from "./shared/collection-names";
import {CONTENT_TEXT_APP_COLLECTION} from "./shared/upsert-content-text";
import {ConfigKey} from "../../../../projects/ngx-ramblers/src/app/models/config.model";
import {DEFAULT_COST_PER_MILE} from "../../../../projects/ngx-ramblers/src/app/models/committee.model";
import {COMMITTEE_EXPENSES_HELP} from "../../../../projects/ngx-ramblers/src/app/pages/admin/default-content";

function dbWith(committee: unknown, helpText: string | null) {
  const findOne = sinon.stub();
  const updateOne = sinon.stub().resolves({modifiedCount: 1});
  const insertOne = sinon.stub().resolves();
  findOne.withArgs({key: ConfigKey.COMMITTEE}).resolves(committee);
  const helpQuery = {
    name: COMMITTEE_EXPENSES_HELP.name,
    category: COMMITTEE_EXPENSES_HELP.category
  };
  if (helpText === null) {
    findOne.withArgs(helpQuery).resolves(null);
  } else {
    findOne.withArgs(helpQuery).resolves({_id: "help-1", text: helpText});
  }
  const collection = sinon.stub();
  collection.withArgs(CONFIG_COLLECTION).returns({findOne, updateOne});
  collection.withArgs(CONTENT_TEXT_COLLECTION).returns({findOne, updateOne, insertOne});
  collection.withArgs(CONTENT_TEXT_APP_COLLECTION).returns({findOne, updateOne, insertOne});
  return {collection, updateOne, insertOne};
}

describe("HMRC mileage rate and expenses help migration", () => {
  it("updates the previous HMRC rate of 45p and refreshes committee expenses help", async () => {
    const {collection, updateOne} = dbWith({value: {expenses: {costPerMile: 0.45}}}, "old");
    await up({collection} as unknown as Db, null);
    expect(updateOne.calledWith(
      {key: ConfigKey.COMMITTEE},
      {$set: {"value.expenses.costPerMile": DEFAULT_COST_PER_MILE}}
    )).toBe(true);
    expect(DEFAULT_COST_PER_MILE).toBe(0.55);
    expect(COMMITTEE_EXPENSES_HELP.text).toContain("HMRC change in mileage rate");
    expect(COMMITTEE_EXPENSES_HELP.text).toContain("55p");
    expect(COMMITTEE_EXPENSES_HELP.text).toContain("Groups and Areas");
  });

  it("leaves a local rate other than the previous HMRC 45p unchanged", async () => {
    const {collection, updateOne} = dbWith({value: {expenses: {costPerMile: 0.28}}}, "old");
    await up({collection} as unknown as Db, null);
    expect(updateOne.calledWith(
      {key: ConfigKey.COMMITTEE},
      {$set: {"value.expenses.costPerMile": DEFAULT_COST_PER_MILE}}
    )).toBe(false);
  });

  it("does not write again when the HMRC rate and help text are already applied", async () => {
    const {collection, updateOne, insertOne} = dbWith(
      {value: {expenses: {costPerMile: 0.55}}},
      COMMITTEE_EXPENSES_HELP.text
    );
    await up({collection} as unknown as Db, null);
    expect(updateOne.called).toBe(false);
    expect(insertOne.called).toBe(false);
  });
});
