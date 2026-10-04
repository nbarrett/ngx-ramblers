import expect from "expect";
import sinon from "sinon";
import { describe, it } from "mocha";
import { Db, MongoClient } from "mongodb";
import { up } from "../mongo/migrations/database/20261004160000-assign-immutable-imported-route-numbers";

describe("immutable imported route numbering migration", () => {
  it("allocates above all existing numbers even when an unnumbered route sorts first", async () => {
    const routes = [{_id: "older-route"}, {_id: "numbered-route", number: 1}];
    const routeCollection = {find: sinon.stub(), updateOne: sinon.stub().resolves({})};
    routeCollection.find.returns({sort: () => ({toArray: async () => routes})});
    const counterCollection = {findOne: sinon.stub().resolves(null), updateOne: sinon.stub().resolves({})};
    const db = {collection: (name: string) => name === "counters" ? counterCollection : routeCollection};
    await up(db as unknown as Db, null as MongoClient);
    expect(routeCollection.updateOne.calledOnceWithExactly({_id: "older-route"}, {$set: {number: 2}})).toBe(true);
    expect(counterCollection.updateOne.firstCall.args[1]).toEqual({$max: {seq: 2}});
  });

  it("never reuses a deleted number or lowers an existing counter", async () => {
    const routes = [{_id: "unnumbered-route"}, {_id: "numbered-route", number: 4}];
    const routeCollection = {find: sinon.stub(), updateOne: sinon.stub().resolves({})};
    routeCollection.find.returns({sort: () => ({toArray: async () => routes})});
    const counterCollection = {findOne: sinon.stub().resolves({seq: 12}), updateOne: sinon.stub().resolves({})};
    const db = {collection: (name: string) => name === "counters" ? counterCollection : routeCollection};
    await up(db as unknown as Db, null as MongoClient);
    expect(routeCollection.updateOne.firstCall.args[1]).toEqual({$set: {number: 13}});
    expect(counterCollection.updateOne.firstCall.args[1]).toEqual({$max: {seq: 13}});
  });

  it("leaves numbered routes unchanged when run again", async () => {
    const routeCollection = {find: sinon.stub(), updateOne: sinon.stub().resolves({})};
    routeCollection.find.returns({sort: () => ({toArray: async () => [{_id: "numbered-route", number: 4}]})});
    const counterCollection = {findOne: sinon.stub().resolves({seq: 12}), updateOne: sinon.stub().resolves({})};
    const db = {collection: (name: string) => name === "counters" ? counterCollection : routeCollection};
    await up(db as unknown as Db, null as MongoClient);
    expect(routeCollection.updateOne.called).toBe(false);
    expect(counterCollection.updateOne.firstCall.args[1]).toEqual({$max: {seq: 12}});
  });
});
