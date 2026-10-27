import expect from "expect";
import sinon from "sinon";
import { afterEach, beforeEach, describe, it } from "mocha";
import { inboxThread } from "../mongo/models/inbox-thread";
import { inboxMessage } from "../mongo/models/inbox-message";
import { inboxFolder } from "../mongo/models/inbox-folder";
import * as uidStore from "./mail-client-imap-uid-store";
import * as mongooseClient from "../mongo/mongoose-client";
import { listMailboxes, mailboxByName, messagesInMailbox, mailboxUidState, mailboxMessageUid } from "./mail-client-imap-mailbox";
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
    sandbox.stub(uidStore, "synchroniseImapThreadUids").resolves();
  });
  afterEach(() => sandbox.restore());

  it("looks up only the saved message's persistent identifiers in the selected role and mailbox", async () => {
    sandbox.stub(inboxMessage, "find").returns({select: () => ({lean: async () => [{_id: "message-0"}]})} as any);
    const uid = await mailboxMessageUid(role, {name: "Sent", folder: InboxThreadFolder.SENT, userFolderId: null}, "<saved@group.example.org.uk>");
    expect(uid).toBe(10);
    expect((uidStore.imapUidMemberships as sinon.SinonStub).firstCall.args.slice(1)).toEqual([
      expect.objectContaining({roleType: "chair", folder: InboxThreadFolder.SENT, userFolderId: null}), ["message-0"]
    ]);
  });

  it("lists the website folders alongside the standard mailboxes", async () => {
    sandbox.stub(inboxFolder, "find").returns({sort: () => ({lean: async () => [{_id: "folder-1", name: "Walk planning"}]})} as any);
    const mailboxes = await listMailboxes();
    expect(mailboxes.map(mailbox => mailbox.name)).toEqual(["INBOX", "Sent", "Drafts", "Junk", "Deleted", "Walk planning"]);
    expect(mailboxByName(mailboxes, "Deleted Items")?.name).toEqual("Deleted");
    expect(mailboxByName(mailboxes, "Junk Email")?.name).toEqual("Junk");
    expect(mailboxes[5].userFolderId).toBe("folder-1");
  });

  it("shows sent replies even when their conversation is still in Inbox or a custom folder", async () => {
    const threads = [
      {_id: "thread-1", roleType: "chair", folder: InboxThreadFolder.INBOX},
      {_id: "thread-2", roleType: "chair", folder: InboxThreadFolder.INBOX, userFolderId: "folder-1"}
    ];
    const threadFind = sandbox.stub(inboxThread, "find").returns({sort: () => ({lean: async () => threads})} as any);
    const messages = threads.map((thread, index) => ({_id: `message-${index}`, threadId: thread._id, messageId: `<sent-${index}@group.example.org.uk>`, direction: InboxMessageDirection.OUTBOUND}));
    const messageFind = sandbox.stub(inboxMessage, "find").returns({select: () => ({sort: () => ({lean: async () => messages})})} as any);
    const result = await messagesInMailbox(role, {name: "Sent", folder: InboxThreadFolder.SENT, userFolderId: null}, member);
    expect(threadFind.firstCall.args[0]).toMatchObject({roleType: "chair", folder: {$nin: [InboxThreadFolder.JUNK, InboxThreadFolder.DELETED]}});
    expect(messageFind.firstCall.args[0]).toEqual({threadId: {$in: ["thread-1", "thread-2"]}, direction: InboxMessageDirection.OUTBOUND, autoReply: {$ne: true}});
    expect(result.map(entry => entry.message.messageId)).toEqual(messages.map(message => message.messageId));
    expect(result.map(entry => entry.seq)).toEqual([1, 2]);
    expect((uidStore.synchroniseImapThreadUids as sinon.SinonStub).called).toBe(false);
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
    expect(find.firstCall.args[0]).toMatchObject({userFolderId: "folder-1", folder: {$nin: foldersExcludedFromInboxList()}});
    expect(find.firstCall.args[0].roleType).toBeUndefined();
    expect(update.called).toBe(false);
    expect((uidStore.synchroniseImapThreadUids as sinon.SinonStub).called).toBe(false);
  });

  it("assigns missing persistent identifiers the first time a mailbox is opened", async () => {
    sandbox.stub(inboxThread, "find").returns({sort: () => ({lean: async () => [{_id: "thread-3", roleType: "_general_example", folder: InboxThreadFolder.INBOX, userFolderId: "folder-1"}]})} as any);
    sandbox.stub(inboxMessage, "find").returns({select: () => ({sort: () => ({lean: async () => [{_id: "message-9", threadId: "thread-3"}]})})} as any);
    (uidStore.imapUidMemberships as sinon.SinonStub)
      .onFirstCall().resolves([])
      .onSecondCall().resolves([{_id: "uid-9", mailboxKey: "folder", threadId: "thread-3", messageId: "message-9", uid: 4, active: true}]);
    const result = await messagesInMailbox(role, {name: "Walk planning", folder: null, userFolderId: "folder-1"}, member);
    expect((uidStore.synchroniseImapThreadUids as sinon.SinonStub).calledOnce).toBe(true);
    expect((uidStore.synchroniseImapThreadUids as sinon.SinonStub).firstCall.args[2]).toEqual(["thread-3"]);
    expect(result.map(entry => entry.uid)).toEqual([4]);
  });
});
