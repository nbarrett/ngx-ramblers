import expect from "expect";
import {describe, it} from "mocha";
import {inboxMailboxConnection} from "./inbox-mailbox-connection";

describe("inbox mailbox indexes", () => {
  it("preserves the standard explicit-null filter for provider uniqueness", () => {
    const index = inboxMailboxConnection.schema.indexes().find(([keys]) => keys.tenantSlug === 1 && keys.provider === 1);
    expect(index?.[1].unique).toBe(true);
    expect(index?.[1].partialFilterExpression).toEqual({gmailAccountEmail: {$type: "null"}});
  });
});
