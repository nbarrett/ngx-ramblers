import expect from "expect";
import { afterEach, beforeEach, describe, it } from "mocha";
import sinon from "sinon";
import { Request, Response } from "express";
import { InboxAliasConfig, InboxMailboxConnection, InboxMessage, InboxMessageDirection, InboxReaderProvider, InboxThread } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { inboxMessage as messages } from "../mongo/models/inbox-message";
import * as context from "./inbox-thread-context";
import * as aliases from "./inbox-aliases";
import * as imports from "./inbox-message-import";
import * as config from "../mongo/controllers/config";
import { composeInboxReply } from "./inbox-reply-controllers";

describe("composeInboxReply", () => {
  const sandbox = sinon.createSandbox();
  const sender = {name: "Alex Reed", email: "webmaster@group.example.org.uk"};
  const recipient = {name: "Support", email: "support@group.example.org.uk"};
  const thread = {id: "0123456789abcdef01234567", roleType: "support", externalAddress: recipient} as InboxThread;
  const connection = {id: "connection-1", gmailAccountEmail: "committee@example.com"} as InboxMailboxConnection;
  const alias = {id: "support", roleType: "support", roleEmail: recipient.email, tenantSlug: "default", mailboxConnectionId: connection.id} as InboxAliasConfig;

  beforeEach(() => {
    sandbox.stub(context, "accessibleThread").resolves(thread);
    sandbox.stub(context, "aliasForThread").resolves(alias);
    sandbox.stub(context, "connectionForAlias").resolves(connection);
    sandbox.stub(context, "connectionForMessage").resolves(connection);
    sandbox.stub(context, "hydrateMessage").callsFake(async (_connection, message) => message);
    sandbox.stub(context, "hydrateReplyTo").callsFake(async (_connection, message) => message.replyTo ?? null);
    sandbox.stub(aliases, "derivedAliasesForConnection").resolves([]);
    sandbox.stub(aliases, "internalEmailsForConnection").resolves(new Set([sender.email, recipient.email]));
    sandbox.stub(aliases, "assignedMembersByMemberId").resolves(new Map([["viewer", {name: "Support Member", email: "viewer@example.com"}]]));
    sandbox.stub(config, "queryKey").resolves({value: {roles: [{type: "support", email: recipient.email, additionalEmails: []}]}} as any);
    sandbox.stub(imports, "correctThreadExternalAddress").resolves(null);
  });

  afterEach(() => sandbox.restore());

  async function compose(overrides: Partial<InboxMessage> = {}) {
    const message = {threadId: thread.id, direction: InboxMessageDirection.INBOUND, from: sender, to: [recipient], cc: [], replyTo: null, subject: "Committee question", messageId: "<message-1@example.com>", references: [], receivedAt: 1000, bodyText: "Hello", bodyHtml: null, attachments: [], externalSource: InboxReaderProvider.GMAIL_API, ...overrides} as InboxMessage;
    const find = sandbox.stub(messages, "findOne").returns({sort: () => ({lean: async () => message})} as any);
    const json = sandbox.spy();
    const req = {params: {id: "committee-question"}, body: {messageId: message.messageId}, user: {memberId: "viewer"}} as unknown as Request;
    const res = {json, status: () => ({json})} as unknown as Response;
    await composeInboxReply(req, res);
    expect(find.firstCall.args[0]).toEqual({threadId: thread.id, messageId: message.messageId});
    return json.firstCall.args[0].response;
  }

  it("replies to an internal sender rather than the recipient stored as conversation contact", async () => {
    const reply = await compose();
    expect(reply.to).toEqual(sender);
    expect(reply.threadId).toBe(thread.id);
    expect(reply.senderRoleEmail).toBe(recipient.email);
    expect(reply.inReplyTo).toBe("<message-1@example.com>");
  });

  it("honours contact-form Reply-To independently of the visible sender", async () => {
    const enquirer = {name: "Morgan Lane", email: "morgan@example.com"};
    expect((await compose({replyTo: enquirer})).to).toEqual(enquirer);
  });

  it("replies to the recipient of a selected outbound message", async () => {
    const outsideRecipient = {name: "Morgan Lane", email: "morgan@example.com"};
    expect((await compose({direction: InboxMessageDirection.OUTBOUND, to: [outsideRecipient]})).to).toEqual(outsideRecipient);
  });
});
