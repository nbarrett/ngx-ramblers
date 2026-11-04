import expect from "expect";
import sinon from "sinon";
import {afterEach, beforeEach, describe, it} from "mocha";
import {appendMailClientRfc822, copyMailClientMessage} from "./mail-client-imap-append";
import * as aliases from "../inbox/inbox-aliases";
import * as mailboxQueries from "./mail-client-imap-mailbox";
import * as submission from "./mail-client-submit";
import * as deleted from "../inbox/inbox-deleted";
import * as messageImport from "../inbox/inbox-message-import";
import {inboxThread} from "../mongo/models/inbox-thread";
import {inboxMessage} from "../mongo/models/inbox-message";
import {CommitteeMember} from "../../../projects/ngx-ramblers/src/app/models/committee.model";
import {Member} from "../../../projects/ngx-ramblers/src/app/models/member.model";
import {InboxMessage, InboxMessageDirection, InboxThreadFolder} from "../../../projects/ngx-ramblers/src/app/models/inbox.model";

const role = {type: "chair", email: "chair@group.example.org.uk"} as CommitteeMember;
const member = {id: "member-1"} as Member;
const sent = {name: "Sent", folder: InboxThreadFolder.SENT, userFolderId: null};
const messageId = "<append-test@group.example.org.uk>";
const raw = Buffer.from(`From: chair@group.example.org.uk\r\nTo: alex.reed@example.com\r\nMessage-ID: ${messageId}\r\nSubject: Local check\r\n\r\nTest body\r\n`);

describe("mail application saved copies", () => {
  const sandbox = sinon.createSandbox();
  beforeEach(() => {
    sandbox.stub(aliases, "derivedAliasForEmail").resolves({roleType: "chair"} as any);
    sandbox.stub(inboxThread, "findById").returns({select: () => ({lean: async () => ({roleType: "chair"})})} as any);
    sandbox.stub(inboxMessage, "countDocuments").resolves(0);
    sandbox.stub(mailboxQueries, "mailboxUidState").resolves({uidValidity: 4, uidNext: 12});
  });
  afterEach(() => sandbox.restore());

  it("files an existing outbound copy into Sent", async () => {
    const existing = {threadId: "thread-1", messageId, direction: InboxMessageDirection.OUTBOUND, attachments: []};
    const find = sandbox.stub(inboxMessage, "findOne").returns({lean: async () => existing} as any);
    const update = sandbox.stub(inboxThread, "updateOne");
    sandbox.stub(inboxThread, "find").returns({select: () => ({lean: async () => []})} as any);
    sandbox.stub(mailboxQueries, "mailboxMessageUid").resolves(11);
    const list = sandbox.stub(mailboxQueries, "messagesInMailbox");
    const store = sandbox.stub(submission, "storeMailClientAttachments");
    expect(await appendMailClientRfc822(role, sent, raw, member)).toEqual({uidValidity: 4, uid: 11});
    expect(find.firstCall.args[0]).toEqual({messageId});
    expect(update.called).toBe(true);
    expect(update.firstCall.args[1]).toEqual({$set: {folder: InboxThreadFolder.SENT}, $unset: {userFolderId: 1}});
    expect(list.called).toBe(false);
    expect(store.called).toBe(false);
  });

  it("keeps a received conversation in its current folder when saving a sent copy", async () => {
    sandbox.stub(inboxMessage, "findOne").returns({lean: async () => ({threadId: "thread-1", messageId, direction: InboxMessageDirection.OUTBOUND, attachments: []})} as any);
    (inboxMessage.countDocuments as sinon.SinonStub).resolves(1);
    const update = sandbox.stub(inboxThread, "updateOne");
    sandbox.stub(mailboxQueries, "mailboxMessageUid").resolves(11);
    await appendMailClientRfc822(role, sent, raw, member);
    expect(update.called).toBe(false);
  });

  it("limits outbound-only Sent filing to unfiled Inbox or Drafts conversations", async () => {
    sandbox.stub(inboxMessage, "findOne").returns({lean: async () => ({threadId: "thread-1", messageId, direction: InboxMessageDirection.OUTBOUND, attachments: []})} as any);
    const update = sandbox.stub(inboxThread, "updateOne");
    sandbox.stub(mailboxQueries, "mailboxMessageUid").resolves(11);
    await appendMailClientRfc822(role, sent, raw, member);
    expect(update.firstCall.args[0]).toEqual({_id: "thread-1", folder: {$in: [InboxThreadFolder.INBOX, InboxThreadFolder.DRAFTS]}, userFolderId: null});
  });

  it("accepts a redirected sent copy without claiming an Inbox UID", async () => {
    const inbox = {name: "INBOX", folder: InboxThreadFolder.INBOX, userFolderId: null};
    sandbox.stub(inboxMessage, "findOne").returns({lean: async () => null} as any);
    sandbox.stub(submission, "storeMailClientAttachments").resolves([]);
    sandbox.stub(messageImport, "recordOutboundMessage").resolves({threadId: "sent-thread", messageId} as any);
    sandbox.stub(mailboxQueries, "mailboxMessageUid").resolves(null);
    expect(await appendMailClientRfc822(role, inbox, raw, member)).toEqual({uidValidity: 4, uid: null});
  });

  it("classifies an existing own-address Inbox copy as outbound before filing it", async () => {
    const inbox = {name: "INBOX", folder: InboxThreadFolder.INBOX, userFolderId: null};
    sandbox.stub(inboxMessage, "findOne").returns({lean: async () => ({threadId: "thread-1", messageId, direction: InboxMessageDirection.INBOUND, attachments: []})} as any);
    const messageUpdate = sandbox.stub(inboxMessage, "updateOne").resolves({} as any);
    const threadUpdate = sandbox.stub(inboxThread, "updateOne").resolves({} as any);
    sandbox.stub(mailboxQueries, "mailboxMessageUid").resolves(null);
    await appendMailClientRfc822(role, inbox, raw, member);
    expect(messageUpdate.firstCall.args[1].$set.direction).toBe(InboxMessageDirection.OUTBOUND);
    expect(messageUpdate.calledBefore(threadUpdate)).toBe(true);
  });

  it("files a copy into Deleted on the existing conversation", async () => {
    const source = {id: "source-message", _id: "source-message", threadId: "source-thread", messageId, direction: InboxMessageDirection.INBOUND, attachments: [{filename: "notes.pdf", s3Key: "inbox-attachments/notes.pdf"}]} as unknown as InboxMessage;
    const destination = {name: "Deleted", folder: InboxThreadFolder.DELETED, userFolderId: null};
    (inboxThread.findById as sinon.SinonStub).returns({lean: async () => ({tenantSlug: "example", messageIds: [messageId]})} as any);
    const record = sandbox.stub(deleted, "recordThreadDeletion").resolves();
    const threadCreate = sandbox.stub(inboxThread, "create");
    const messageFind = sandbox.stub(inboxMessage, "find").returns({lean: async () => [source]} as any);
    const uid = sandbox.stub(mailboxQueries, "mailboxMessageUid").resolves(15);
    const upload = sandbox.stub(submission, "storeMailClientAttachments");
    expect(await copyMailClientMessage(role, destination, source)).toEqual({uidValidity: 4, uid: 15});
    expect(record.calledOnce).toBe(true);
    expect(record.firstCall.args[2]).toEqual("source-thread");
    expect(messageFind.calledOnce).toBe(true);
    expect(threadCreate.called).toBe(false);
    expect(uid.firstCall.args).toEqual([role, destination, messageId, "source-message"]);
    expect(source.threadId).toBe("source-thread");
    expect(upload.called).toBe(false);
  });

  it("does not report another message's identifier when the saved message is absent", async () => {
    sandbox.stub(inboxMessage, "findOne").returns({lean: async () => ({threadId: "thread-1", messageId, attachments: []})} as any);
    sandbox.stub(inboxThread, "updateOne");
    sandbox.stub(inboxThread, "find").returns({select: () => ({lean: async () => []})} as any);
    sandbox.stub(mailboxQueries, "mailboxMessageUid").resolves(null);
    await expect(appendMailClientRfc822(role, sent, raw, member)).rejects.toThrow("without an IMAP identifier");
  });

  it("preserves independent drafts with the same subject and reply target", async () => {
    const drafts = {name: "Drafts", folder: InboxThreadFolder.DRAFTS, userFolderId: null};
    sandbox.stub(inboxMessage, "findOne").returns({lean: async () => null} as any);
    sandbox.stub(submission, "storeMailClientAttachments").resolves([]);
    sandbox.stub(inboxThread, "create").resolves({id: "draft-thread-new", _id: "draft-thread-new"} as any);
    sandbox.stub(inboxMessage, "create").resolves({
      toObject: () => ({threadId: "draft-thread-new", messageId, subject: "Local check", inReplyTo: null}),
      id: "draft-message-new",
      _id: "draft-message-new"
    } as any);
    sandbox.stub(inboxThread, "find").returns({select: () => ({lean: async () => [{_id: "draft-thread-old"}, {_id: "draft-thread-new"}]})} as any);
    sandbox.stub(inboxMessage, "find").returns({select: () => ({lean: async () => [
      {threadId: "draft-thread-old", messageId: "<older-draft@group.example.org.uk>", inReplyTo: null},
      {threadId: "draft-thread-new", messageId, inReplyTo: null}
    ]})} as any);
    const removedMessages = sandbox.stub(inboxMessage, "deleteMany").resolves({} as any);
    const removedThreads = sandbox.stub(inboxThread, "deleteMany").resolves({} as any);
    sandbox.stub(mailboxQueries, "mailboxMessageUid").resolves(8);
    expect(await appendMailClientRfc822(role, drafts, raw, member)).toEqual({uidValidity: 4, uid: 8});
    expect(removedMessages.called).toBe(false);
    expect(removedThreads.called).toBe(false);
  });

  it("gives a same-Message-ID draft autosave its own document identity and retires the previous draft", async () => {
    const drafts = {name: "Drafts", folder: InboxThreadFolder.DRAFTS, userFolderId: null};
    sandbox.stub(inboxMessage, "findOne").returns({lean: async () => ({id: "old-message", threadId: "old-thread", messageId, attachments: []})} as any);
    sandbox.stub(submission, "storeMailClientAttachments").resolves([]);
    sandbox.stub(inboxThread, "create").resolves({id: "new-thread"} as any);
    sandbox.stub(inboxMessage, "create").resolves({id: "new-message", toObject: () => ({threadId: "new-thread", messageId}), _id: "new-message"} as any);
    const uid = sandbox.stub(mailboxQueries, "mailboxMessageUid").resolves(12);
    const removedMessages = sandbox.stub(inboxMessage, "deleteMany").resolves({} as any);
    const removedThreads = sandbox.stub(inboxThread, "deleteMany").resolves({} as any);
    expect(await appendMailClientRfc822(role, drafts, raw, member)).toEqual({uidValidity: 4, uid: 12});
    expect(uid.firstCall.args).toEqual([role, drafts, messageId, "new-message"]);
    expect(removedMessages.calledWith({threadId: "old-thread"})).toBe(true);
    expect(removedThreads.calledWith({_id: "old-thread"})).toBe(true);
  });

  it("files a sent copy saved to Inbox into Sent", async () => {
    const inbox = {name: "INBOX", folder: InboxThreadFolder.INBOX, userFolderId: null};
    sandbox.stub(inboxMessage, "findOne").returns({lean: async () => null} as any);
    sandbox.stub(submission, "storeMailClientAttachments").resolves([]);
    const recorded = sandbox.stub(messageImport, "recordOutboundMessage").resolves({
      threadId: "sent-thread", messageId, subject: "Local check", inReplyTo: null
    } as any);
    sandbox.stub(inboxThread, "find").returns({select: () => ({lean: async () => []})} as any);
    sandbox.stub(mailboxQueries, "mailboxMessageUid").resolves(9);
    expect(await appendMailClientRfc822(role, inbox, raw, member)).toEqual({uidValidity: 4, uid: 9});
    expect(recorded.calledOnce).toBe(true);
  });

  it("rejects a new copy when its attachment cannot be stored", async () => {
    sandbox.stub(inboxMessage, "findOne").returns({lean: async () => null} as any);
    const store = sandbox.stub(submission, "storeMailClientAttachments").rejects(new Error("An attachment could not be stored"));
    const create = sandbox.stub(inboxThread, "create");
    await expect(appendMailClientRfc822(role, sent, raw, member)).rejects.toThrow("attachment could not be stored");
    expect(store.calledOnce).toBe(true);
    expect(create.called).toBe(false);
  });
});
