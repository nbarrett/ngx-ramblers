import expect from "expect";
import sinon from "sinon";
import { afterEach, describe, it } from "mocha";
import { InboxThreadFolder } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { inboxMessage } from "../mongo/models/inbox-message";
import * as context from "./inbox-thread-context";
import * as deleted from "./inbox-deleted";
import { deleteInboxThread } from "./inbox-thread-actions-controllers";

describe("deleteInboxThread", () => {
  const sandbox = sinon.createSandbox();
  afterEach(() => sandbox.restore());

  it("leaves a conversation in Deleted instead of permanently deleting it", async () => {
    sandbox.stub(context, "accessibleThread").resolves({id: "0123456789abcdef01234567", folder: InboxThreadFolder.DELETED} as any);
    sandbox.stub(inboxMessage, "find").returns({lean: async () => []} as any);
    const permanent = sandbox.stub(deleted, "permanentlyDeleteThread");
    const record = sandbox.stub(deleted, "recordThreadDeletion");
    const json = sandbox.spy();
    await deleteInboxThread({params: {id: "0123456789abcdef01234567"}} as any, {json} as any);
    expect(permanent.called).toBe(false);
    expect(record.called).toBe(false);
    expect(json.firstCall.args[0].response).toEqual({deletedCount: 1});
  });
});
