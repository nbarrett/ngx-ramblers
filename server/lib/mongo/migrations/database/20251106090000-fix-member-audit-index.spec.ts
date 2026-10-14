import expect from "expect";
import sinon from "sinon";
import { describe, it } from "mocha";
import { up } from "./20251106090000-fix-member-audit-index";

describe("member audit indexes on new databases", () => {
  it("does not create the unused audit collection", async () => {
    const collection = sinon.stub();
    const database = {listCollections: () => ({hasNext: async () => false}), collection};
    await up(database as never, null);
    expect(collection.called).toBe(false);
  });

  it("keeps the historical repair for an existing collection", async () => {
    const audit = {
      indexes: async () => [{name: "member.userName_1", unique: true}],
      dropIndex: sinon.stub().resolves(),
      createIndex: sinon.stub().resolves()
    };
    const database = {listCollections: () => ({hasNext: async () => true}), collection: () => audit};
    await up(database as never, null);
    expect(audit.dropIndex.firstCall.args).toEqual(["member.userName_1"]);
    expect(audit.createIndex.firstCall.args).toEqual([{userName: 1}, {unique: false}]);
  });
});
