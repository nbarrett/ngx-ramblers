import expect from "expect";
import { afterEach, beforeEach, describe, it } from "mocha";
import sinon from "sinon";
import { InboxThread, InboxMessageDirection } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { inboxThreadHeaderFrom, inboxThreadRowFrom, inboxThreadRowTo } from "../../../projects/ngx-ramblers/src/app/functions/inbox-thread";
import * as aliases from "./inbox-aliases";
import { inboxMailboxConnection as connections } from "../mongo/models/inbox-mailbox-connection";
import { inboxMessage as messages } from "../mongo/models/inbox-message";
import { parseGmailMessage } from "./gmail-inbox-reader";
import { resolveThreadExternalAddress, replyTargetExcludingViewer } from "./inbox-message-import";
import { withResolvedDisplayRecipients } from "./inbox-display-addresses";

describe("inbox display addresses", () => {
  const sandbox = sinon.createSandbox();
  const sender = {name: "Alex Reed", email: "webmaster@group.example.org.uk"};
  const recipient = {name: "Support", email: "support@group.example.org.uk"};
  const internalEmails = new Set([sender.email, recipient.email, "committee@example.com"]);

  beforeEach(() => {
    sandbox.stub(aliases, "siteInternalEmails").resolves(new Set(internalEmails));
    sandbox.stub(connections, "find").returns({select: () => ({lean: async () => [{gmailAccountEmail: "committee@example.com"}]})} as any);
  });

  afterEach(() => sandbox.restore());

  it("keeps import, list and detail sender labels consistent for committee-to-committee mail", async () => {
    const message = parseGmailMessage({id: "message-1", internalDate: "1000", payload: {headers: [
      {name: "From", value: `${sender.name} <${sender.email}>`},
      {name: "To", value: `${recipient.name} <${recipient.email}>`}
    ]}});
    const counterparty = resolveThreadExternalAddress(message, null, internalEmails);
    expect(counterparty).toEqual(recipient);
    const thread = {id: "thread-1", lastDirection: InboxMessageDirection.INBOUND, externalAddress: counterparty, deliveredTo: recipient} as InboxThread;
    const aggregate = sandbox.stub(messages, "aggregate").resolves([{_id: thread.id, from: message.from, to: message.to}]);
    const [row] = await withResolvedDisplayRecipients([thread]);
    expect(aggregate.firstCall.args[0][0]).toEqual({$match: {threadId: {$in: [thread.id]}}});
    expect(inboxThreadRowFrom(row)).toBe("Alex Reed <webmaster@group.example.org.uk>");
    expect(inboxThreadHeaderFrom([message])).toEqual(sender);
    expect(inboxThreadRowTo(row, recipient)).toBe("Support <support@group.example.org.uk>");
    expect(replyTargetExcludingViewer(counterparty, message.from, recipient.email)).toEqual(sender);
    expect(row.externalAddress).toEqual(counterparty);
  });

  it("displays the From header independently of contact-form Reply-To", async () => {
    const enquirer = {name: "Morgan Lane", email: "morgan@example.com"};
    const message = parseGmailMessage({id: "message-2", internalDate: "1000", payload: {headers: [
      {name: "From", value: `${sender.name} <${sender.email}>`},
      {name: "Reply-To", value: `${enquirer.name} <${enquirer.email}>`},
      {name: "To", value: `${recipient.name} <${recipient.email}>`}
    ]}});
    const thread = {id: "thread-2", lastDirection: InboxMessageDirection.INBOUND, externalAddress: resolveThreadExternalAddress(message, null, internalEmails), deliveredTo: recipient} as InboxThread;
    sandbox.stub(messages, "aggregate").resolves([{_id: thread.id, from: message.from, to: message.to}]);
    const [row] = await withResolvedDisplayRecipients([thread]);
    expect(inboxThreadRowFrom(row)).toBe("Alex Reed <webmaster@group.example.org.uk>");
    expect(row.externalAddress).toEqual(enquirer);
  });

  it("shows the original forwarded recipient instead of substituting the delivery mailbox", async () => {
    const originalRecipient = {name: "Morgan Lane", email: "morgan@example.com"};
    const thread = {id: "thread-forwarded", lastDirection: InboxMessageDirection.INBOUND, externalAddress: sender, deliveredTo: recipient} as InboxThread;
    sandbox.stub(messages, "aggregate").resolves([{_id: thread.id, from: sender, to: [originalRecipient]}]);
    const [row] = await withResolvedDisplayRecipients([thread]);
    expect(inboxThreadRowTo(row, recipient)).toBe("Morgan Lane <morgan@example.com>");
    expect(row.deliveredTo).toEqual(recipient);
  });

  it("resolves outbound headers without changing filing, visibility or read state", async () => {
    const thread = {id: "thread-3", lastDirection: InboxMessageDirection.OUTBOUND, externalAddress: recipient, sentFrom: sender, roleType: "general", unread: true} as InboxThread;
    sandbox.stub(messages, "aggregate").resolves([{_id: thread.id, from: sender, to: [recipient]}]);
    const rows = await withResolvedDisplayRecipients([thread]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({...thread, receivedFrom: sender, receivedTo: [recipient]});
    expect(inboxThreadRowFrom(rows[0])).toBe("Alex Reed <webmaster@group.example.org.uk>");
    expect(inboxThreadRowTo(rows[0], sender)).toBe("Support <support@group.example.org.uk>");
  });
});
