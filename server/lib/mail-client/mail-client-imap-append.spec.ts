import expect from "expect";
import sinon from "sinon";
import {afterEach, beforeEach, describe, it} from "mocha";
import {appendMailClientRfc822, copyMailClientMessage} from "./mail-client-imap-append";
import * as aliases from "../inbox/inbox-aliases";
import * as mailboxQueries from "./mail-client-imap-mailbox";
import * as submission from "./mail-client-submit";
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
    sandbox.stub(mailboxQueries, "mailboxUidState").resolves({uidValidity: 4, uidNext: 12});
  });
  afterEach(() => sandbox.restore());

  it("saves the existing outbound message without moving its conversation out of Inbox", async () => {
    const existing = {threadId: "thread-1", messageId, direction: InboxMessageDirection.OUTBOUND, attachments: []};
    const find = sandbox.stub(inboxMessage, "findOne").returns({lean: async () => existing} as any);
    const update = sandbox.stub(inboxThread, "updateOne");
    sandbox.stub(mailboxQueries, "mailboxMessageUid").resolves(11);
    const list = sandbox.stub(mailboxQueries, "messagesInMailbox");
    const store = sandbox.stub(submission, "storeMailClientAttachments");
    expect(await appendMailClientRfc822(role, sent, raw, member)).toEqual({uidValidity: 4, uid: 11});
    expect(find.firstCall.args[0]).toEqual({messageId});
    expect(update.called).toBe(false);
    expect(list.called).toBe(false);
    expect(store.called).toBe(false);
  });

  it("copies into Deleted with its own identifier and preserves the source and attachment references", async () => {
    const source = {id: "source-message", _id: "source-message", threadId: "source-thread", messageId, direction: InboxMessageDirection.INBOUND, attachments: [{filename: "notes.pdf", s3Key: "inbox-attachments/notes.pdf"}]} as unknown as InboxMessage;
    const destination = {name: "Deleted", folder: InboxThreadFolder.DELETED, userFolderId: null};
    const threadCreate = sandbox.stub(inboxThread, "create").resolves({id: "copied-thread"} as any);
    const messageCreate = sandbox.stub(inboxMessage, "create").resolves({id: "copied-message", toObject: () => ({id: "copied-message"})} as any);
    const update = sandbox.stub(inboxThread, "updateOne");
    const uid = sandbox.stub(mailboxQueries, "mailboxMessageUid").resolves(15);
    const upload = sandbox.stub(submission, "storeMailClientAttachments");
    expect(await copyMailClientMessage(role, destination, source)).toEqual({uidValidity: 4, uid: 15});
    expect(threadCreate.firstCall.args[0]).toMatchObject({roleType: "chair", folder: InboxThreadFolder.DELETED, lastDirection: InboxMessageDirection.INBOUND});
    expect(messageCreate.firstCall.args[0]).toMatchObject({threadId: "copied-thread", messageId, direction: InboxMessageDirection.INBOUND, attachments: source.attachments});
    expect(messageCreate.firstCall.args[0]).not.toHaveProperty("_id");
    expect(messageCreate.firstCall.args[0]).not.toHaveProperty("id");
    expect(uid.firstCall.args).toEqual([role, destination, messageId, "copied-message"]);
    expect(source.threadId).toBe("source-thread");
    expect(update.called).toBe(false);
    expect(upload.called).toBe(false);
  });

  it("does not report another message's identifier when the saved message is absent", async () => {
    sandbox.stub(inboxMessage, "findOne").returns({lean: async () => ({threadId: "thread-1", messageId, attachments: []})} as any);
    sandbox.stub(mailboxQueries, "mailboxMessageUid").resolves(null);
    await expect(appendMailClientRfc822(role, sent, raw, member)).rejects.toThrow("without an IMAP identifier");
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
