import expect from "expect";
import { afterEach, describe, it } from "mocha";
import sinon from "sinon";
import { InboxMessage } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { inboxMessage as inboxMessageModel } from "../mongo/models/inbox-message";
import { claimMessages } from "./inbox-message-digest";

describe("claimMessages", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => sandbox.restore());

  it("gives each message to only one of several processes running the digest at once", async () => {
    const claimed = new Set<string>();
    sandbox.stub(inboxMessageModel, "updateOne").callsFake(((filter: {_id: string}) => {
      const modifiedCount = claimed.has(filter._id) ? 0 : 1;
      claimed.add(filter._id);
      return Promise.resolve({modifiedCount});
    }) as any);
    const messages = [{_id: "message-1"}, {_id: "message-2"}] as unknown as InboxMessage[];
    const results = await Promise.all([claimMessages(messages, 1), claimMessages(messages, 1), claimMessages(messages, 1)]);
    expect(results.flat().length).toEqual(2);
  });
});
