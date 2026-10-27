import expect from "expect";
import sinon from "sinon";
import { afterEach, beforeEach, describe, it } from "mocha";
import { inboxThread } from "../mongo/models/inbox-thread";
import { inboxMessage } from "../mongo/models/inbox-message";
import { inboxFolder } from "../mongo/models/inbox-folder";
import * as uidStore from "./mail-client-imap-uid-store";
import * as mongooseClient from "../mongo/mongoose-client";
import { listMailboxes, messagesInMailbox, mailboxUidState } from "./mail-client-imap-mailbox";
import { CommitteeMember } from "../../../projects/ngx-ramblers/src/app/models/committee.model";
import { Member } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { foldersExcludedFromInboxList, InboxMessageDirection, InboxThreadFolder } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";

const role = {type: "chair"} as CommitteeMember;
const member = {id: "member-1"} as Member;

describe("mail application mailbox contents", () => {
  const sandbox = sinon.createSandbox();
  beforeEach(() => {
    sandbox.stub(mongooseClient, "execute").callsFake(async operation => operation());
    sandbox.stub(uidStore, "imapUidMemberships").resolves([
      {_id: "uid-1", mailboxKey: "sent", threadId: "thread-1", messageId: "message-0", uid: 10, active: true},
      {_id: "uid-2", mailboxKey: "sent", threadId: "thread-2", messageId: "message-1", uid: 20, active: true}
    ]);
  });
  afterEach(() => sandbox.restore());

  it("lists the website folders alongside the standard mailboxes", async () => {
    sandbox.stub(inboxFolder, "find").returns({sort: () => ({lean: async () => [{_id: "folder-1", name: "Walk planning"}]})} as any);
    const mailboxes = await listMailboxes();
    expect(mailboxes.map(mailbox => mailbox.name)).toEqual(["INBOX", "Sent", "Drafts", "Junk", "Deleted", "Walk planning"]);
    expect(mailboxes[5].userFolderId).toBe("folder-1");
  });

  it("shows sent replies even when their conversation is still in Inbox or a custom folder", async () => {
    const threads = [
      {_id: "thread-1", roleType: "chair", folder: InboxThreadFolder.INBOX},
      {_id: "thread-2", roleType: "chair", folder: InboxThreadFolder.INBOX, userFolderId: "folder-1"}
    ];
    const threadFind = sandbox.stub(inboxThread, "find").returns({sort: () => ({lean: async () => threads})} as any);
    const messages = threads.map((thread, index) => ({_id: `message-${index}`, threadId: thread._id, messageId: `<sent-${index}@group.example.org.uk>`, direction: InboxMessageDirection.OUTBOUND}));
    const messageFind = sandbox.stub(inboxMessage, "find").returns({sort: () => ({lean: async () => messages})} as any);
    const result = await messagesInMailbox(role, {name: "Sent", folder: InboxThreadFolder.SENT, userFolderId: null}, member);
    expect(threadFind.firstCall.args[0]).toMatchObject({roleType: "chair", folder: {$nin: [InboxThreadFolder.JUNK, InboxThreadFolder.DELETED]}});
    expect(messageFind.firstCall.args[0]).toEqual({threadId: {$in: ["thread-1", "thread-2"]}, direction: InboxMessageDirection.OUTBOUND, autoReply: {$ne: true}});
    expect(result.map(entry => entry.message.messageId)).toEqual(messages.map(message => message.messageId));
    expect(result.map(entry => entry.seq)).toEqual([1, 2]);
  });

  it("keeps filed conversations out of Inbox and includes legacy unfiled conversations", async () => {
    const find = sandbox.stub(inboxThread, "find").returns({sort: () => ({lean: async () => []})} as any);
    await messagesInMailbox(role, {name: "INBOX", folder: InboxThreadFolder.INBOX, userFolderId: null}, member);
    expect(find.firstCall.args[0]).toMatchObject({roleType: "chair", userFolderId: null, folder: {$nin: foldersExcludedFromInboxList()}});
  });

  it("reads persistent UIDVALIDITY and UIDNEXT without allocating identifiers", async () => {
    const state = sandbox.stub(uidStore, "imapUidState").resolves({uidValidity: 41, uidNext: 73});
    expect(await mailboxUidState(role, {name: "INBOX", folder: InboxThreadFolder.INBOX, userFolderId: null})).toEqual({uidValidity: 41, uidNext: 73});
    expect(state.calledOnce).toBe(true);
  });

  it("loads a website folder by its id without including deleted or junk conversations", async () => {
    const find = sandbox.stub(inboxThread, "find").returns({sort: () => ({lean: async () => []})} as any);
    const update = sandbox.stub(inboxThread, "updateOne");
    const mailbox = {name: "Walk planning", folder: null, userFolderId: "folder-1"};
    await messagesInMailbox(role, mailbox, member);
    await messagesInMailbox(role, mailbox, member);
    expect(find.firstCall.args[0]).toMatchObject({roleType: "chair", userFolderId: "folder-1", folder: {$nin: foldersExcludedFromInboxList()}});
    expect(update.called).toBe(false);
  });
});
