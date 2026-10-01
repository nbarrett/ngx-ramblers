import expect from "expect";
import sinon from "sinon";
import {afterEach, describe, it} from "mocha";
import {threadCorrespondent} from "./inbox-thread-context";
import * as aliases from "./inbox-aliases";
import {inboxThread} from "../mongo/models/inbox-thread";
import {InboxMailboxConnection, InboxMessage, InboxMessageDirection} from "../../../projects/ngx-ramblers/src/app/models/inbox.model";

describe("inbox correspondent display", () => {
  const sandbox = sinon.createSandbox();
  const sender = {name: "Alex Reed", email: "chair@group.example.org.uk"};
  const recipient = {name: "Morgan Lane", email: "morgan@example.com"};
  afterEach(() => sandbox.restore());

  it("resolves an incoming correspondent without rewriting the stored thread", async () => {
    const update = sandbox.stub(inboxThread, "updateOne");
    const message = {direction: InboxMessageDirection.INBOUND, from: sender, replyTo: null, receivedAt: 1} as InboxMessage;
    expect(await threadCorrespondent({} as InboxMailboxConnection, [message])).toEqual(sender);
    expect(update.called).toBe(false);
  });

  it("resolves an outgoing correspondent without rewriting the stored thread", async () => {
    const update = sandbox.stub(inboxThread, "updateOne");
    sandbox.stub(aliases, "internalEmailsForConnection").resolves(new Set([sender.email]));
    const message = {direction: InboxMessageDirection.OUTBOUND, from: sender, to: [recipient], sentAt: 1} as InboxMessage;
    expect(await threadCorrespondent({} as InboxMailboxConnection, [message])).toEqual(recipient);
    expect(update.called).toBe(false);
  });
});
