import expect from "expect";
import sinon from "sinon";
import {afterEach, describe, it} from "mocha";
import {maintainImapUids} from "./mail-client-imap-uid-hooks";
import * as uidStore from "./mail-client-imap-uid-store";
import {Schema} from "mongoose";
import {INBOX_THREADS_COLLECTION} from "../mongo/migrations/shared/collection-names";

describe("IMAP read-state revision tracking", () => {
  const sandbox = sinon.createSandbox();
  afterEach(() => sandbox.restore());

  [
    {$addToSet: {readByMemberIds: "reader-1"}, $set: {unread: false}},
    {$pull: {readByMemberIds: "reader-1"}, $set: {unread: true}},
    {$set: {unread: false}},
    {$set: {"readByMemberIds.0": "reader-1"}}
  ].forEach(update => {
    it(`invalidates mailbox revisions for ${JSON.stringify(update)}`, async () => {
      const pre = new Map<string, (this: unknown, ...args: unknown[]) => unknown>();
      const post = new Map<string, (this: unknown, ...args: unknown[]) => unknown>();
      const schema = {
        pre: (name: string, handler: (this: unknown, ...args: unknown[]) => unknown) => pre.set(name, handler),
        post: (name: string, handler: (this: unknown, ...args: unknown[]) => unknown) => post.set(name, handler)
      } as unknown as Schema;
      maintainImapUids(schema);
      const db = {collection: () => ({findOne: async () => ({value: {allowMailClientAccess: true}})})};
      const client = {};
      const model = {
        collection: {name: INBOX_THREADS_COLLECTION},
        db: {readyState: 1, db, getClient: () => client},
        find: () => ({select: () => ({lean: async () => [{_id: "thread-1"}]})})
      };
      const query = {model, getFilter: () => ({_id: "thread-1"}), getUpdate: () => update};
      const sync = sandbox.stub(uidStore, "synchroniseImapThreadUids").resolves();
      await pre.get("updateOne").call(query);
      await post.get("updateOne").call(query, {modifiedCount: 1});
      expect(sync.calledOnce).toBe(true);
      expect(sync.firstCall.args[0]).toBe(db);
      expect(sync.firstCall.args[1]).toBe(client);
      expect(sync.firstCall.args[2]).toContain("thread-1");
    });
  });
});
