import expect from "expect";
import sinon from "sinon";
import {afterEach, describe, it} from "mocha";
import {InboxAliasConfig, InboxMailboxConnection, InboxMessage, InboxMessageDirection, InboxReaderProvider, InboxThreadFolder} from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import {inboxMessage} from "../mongo/models/inbox-message";
import {inboxThread} from "../mongo/models/inbox-thread";
import * as deleted from "./inbox-deleted";
import * as config from "../mongo/controllers/config";
import * as broadcaster from "../websockets/websocket-broadcaster";
import {isDeliveredToRole, isOwnSentCopy, recordOutboundReply, shouldRefreshUnreadForInbound, storeInboundMessage} from "./inbox-message-import";

import * as aliases from "./inbox-aliases";
import * as reader from "./gmail-inbox-reader";
import * as messageImport from "./inbox-message-import";
import {processGmailMessageIds} from "./inbox-poller";

const roleAddress = {name: "Alex Reed", email: "webmaster@group.example.org.uk"};
const alias = {tenantSlug: "group", roleType: "webmaster", roleEmail: roleAddress.email, additionalEmails: [], mailboxConnectionId: "mailbox-1"} as InboxAliasConfig;
const internalEmails = new Set([roleAddress.email]);
const received = {
  threadId: "thread-1", messageId: "self-test@example.com", direction: InboxMessageDirection.INBOUND,
  from: roleAddress, to: [roleAddress], cc: [], deliveryRecipients: [], references: [],
  subject: "Website password reset instructions", receivedAt: 2000, sentAt: 1000,
  externalSource: InboxReaderProvider.GMAIL_API, externalId: "gmail-1", attachments: []
} as InboxMessage;

describe("self-addressed inbox delivery", () => {
  const sandbox = sinon.createSandbox();
  afterEach(() => sandbox.restore());

  it("marks same-time delivery unread after the sent copy without refreshing a repeated inbound", () => {
    expect(shouldRefreshUnreadForInbound(false, 1000, 1000, InboxMessageDirection.OUTBOUND)).toBe(true);
    expect(shouldRefreshUnreadForInbound(false, 1000, 1000, InboxMessageDirection.INBOUND)).toBe(false);
  });

  it("recognises visible and envelope recipients as deliveries, including additional role addresses", () => {
    expect(isDeliveredToRole(received, alias)).toBe(true);
    expect(isDeliveredToRole({...received, to: [], cc: [roleAddress]}, alias)).toBe(true);
    expect(isDeliveredToRole({...received, to: [], deliveryRecipients: [roleAddress]}, alias)).toBe(true);
    expect(isDeliveredToRole({...received, to: [{name: null, email: "test@group.example.org.uk"}]}, {...alias, additionalEmails: ["test@group.example.org.uk"]})).toBe(true);
    expect(isOwnSentCopy({...received, to: [roleAddress, {name: null, email: "member@example.com"}]}, internalEmails, alias)).toBe(false);
  });

  it("stores a received self-test beside its sent copy and imports repeated delivery only once", async () => {
    const outbound = {...received, direction: InboxMessageDirection.OUTBOUND, receivedAt: null};
    const stored = [outbound];
    const thread = {id: "thread-1", roleType: alias.roleType, folder: InboxThreadFolder.SENT, lastSeenAt: 1000, externalAddress: roleAddress};
    sandbox.stub(deleted, "isRecordedDeletedInbound").resolves(false);
    sandbox.stub(config, "queryKey").resolves(null);
    sandbox.stub(broadcaster, "broadcast");
    sandbox.stub(inboxThread, "findById").returns({lean: async () => thread} as any);
    sandbox.stub(inboxThread, "findOne").resolves({toObject: () => thread} as any);
    sandbox.stub(inboxThread, "aggregate").resolves([]);
    const updates = sandbox.stub(inboxThread, "updateOne").resolves({} as any);
    sandbox.stub(inboxMessage, "findOne").callsFake((criteria: any) => ({lean: async () => stored.find(item => item.messageId === criteria.messageId && item.direction === criteria.direction) ?? null}) as any);
    const create = sandbox.stub(inboxMessage, "create").callsFake((item: any) => {
      stored.push(item);
      return Promise.resolve({threadId: item.threadId, toObject: () => item}) as any;
    });
    expect((await storeInboundMessage(alias, received, InboxThreadFolder.INBOX, internalEmails)).direction).toBe(InboxMessageDirection.INBOUND);
    expect(updates.args.some(([, update]: any) => update.$set?.folder === InboxThreadFolder.INBOX && update.$set?.unread === true)).toBe(true);
    await storeInboundMessage(alias, received, InboxThreadFolder.INBOX, internalEmails);
    expect(create.callCount).toBe(1);
    expect(stored.map(item => item.direction)).toEqual([InboxMessageDirection.OUTBOUND, InboxMessageDirection.INBOUND]);
  });

  it("preserves an incoming copy when the sent record arrives afterwards", async () => {
    sandbox.stub(inboxMessage, "findOne").returns({lean: async () => null} as any);
    const create = sandbox.stub(inboxMessage, "create").resolves({toObject: () => ({...received, direction: InboxMessageDirection.OUTBOUND})} as any);
    const updateMessage = sandbox.stub(inboxMessage, "updateOne");
    sandbox.stub(inboxThread, "updateOne").resolves({} as any);
    sandbox.stub(inboxThread, "aggregate").resolves([]);
    sandbox.stub(broadcaster, "broadcast");
    await recordOutboundReply(alias, {...received, direction: InboxMessageDirection.OUTBOUND}, "thread-1");
    expect(create.callCount).toBe(1);
    expect(updateMessage.called).toBe(false);
    expect((inboxMessage.findOne as sinon.SinonStub).firstCall.args[0]).toEqual({threadId: "thread-1", messageId: received.messageId, direction: InboxMessageDirection.OUTBOUND});
  });

  [false, true].forEach(alreadyReceived => {
    it(`Gmail polling ${alreadyReceived ? "skips a repeated received copy" : "imports delivery despite an existing sent thread"}`, async () => {
      sandbox.stub(aliases, "roleIdentityEmailsByType").resolves(new Map([[alias.roleType, internalEmails]]));
      sandbox.stub(aliases, "internalEmailsForConnection").resolves(internalEmails);
      sandbox.stub(reader, "fetchFullMessage").resolves(received);
      sandbox.stub(inboxThread, "findOne").returns({lean: async () => ({_id: "thread-1"})} as any);
      sandbox.stub(inboxMessage, "exists").resolves(alreadyReceived ? {_id: "incoming-1"} as any : null);
      const store = sandbox.stub(messageImport, "storeInboundMessage").resolves(received);
      sandbox.stub(messageImport, "backfillStatedReplyAddress").resolves(0);
      const result = await processGmailMessageIds({gmailAccountEmail: "group.inbox@example.com"} as InboxMailboxConnection, [alias], ["gmail-1"]);
      expect(store.callCount).toBe(alreadyReceived ? 0 : 1);
      expect(result).toEqual(alreadyReceived ? [] : [received.messageId]);
    });
  });

  it("still skips a sent-only copy addressed outside the role", async () => {
    const outbound = {...received, direction: InboxMessageDirection.OUTBOUND};
    sandbox.stub(deleted, "isRecordedDeletedInbound").resolves(false);
    sandbox.stub(inboxMessage, "findOne").returns({lean: async () => outbound} as any);
    sandbox.stub(inboxThread, "findById").returns({lean: async () => ({roleType: alias.roleType})} as any);
    const create = sandbox.stub(inboxMessage, "create");
    expect(await storeInboundMessage(alias, {...received, to: [{name: null, email: "member@example.com"}]}, InboxThreadFolder.INBOX, internalEmails)).toEqual(outbound);
    expect(create.called).toBe(false);
  });
});
