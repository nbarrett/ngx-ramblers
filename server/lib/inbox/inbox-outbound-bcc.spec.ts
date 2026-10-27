import expect from "expect";
import {afterEach, describe, it} from "mocha";
import sinon from "sinon";
import {recordOutboundMessage} from "./inbox-message-import";
import {inboxThread} from "../mongo/models/inbox-thread";
import {InboxAliasConfig, InboxMessage, InboxMessageDirection} from "../../../projects/ngx-ramblers/src/app/models/inbox.model";

describe("Bcc-only outbound routing", () => {
  const sandbox = sinon.createSandbox();
  afterEach(() => sandbox.restore());

  it("uses internal delivery recipients to find the Sent conversation without populating To or Cc", async () => {
    const failure = new Error("stop before persistence");
    const lookup = sandbox.stub(inboxThread, "findOne").throws(failure);
    const message = {
      messageId: "<bcc-only@group.example.org.uk>",
      direction: InboxMessageDirection.OUTBOUND,
      from: {name: "Alex Reed", email: "chair@group.example.org.uk"},
      to: [], cc: [], references: [], subject: "Walk planning",
      deliveryRecipients: [{name: "Jamie Cole", email: "jamie.cole@example.com"}]
    } as InboxMessage;
    await expect(recordOutboundMessage({tenantSlug: "test", roleType: "chair"} as InboxAliasConfig, message)).rejects.toBe(failure);
    expect(lookup.firstCall.args[0]).toMatchObject({"externalAddress.email": "jamie.cole@example.com"});
    expect(message.to).toEqual([]);
    expect(message.cc).toEqual([]);
  });
});
