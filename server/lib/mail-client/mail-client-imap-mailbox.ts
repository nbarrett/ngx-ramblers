import { CommitteeMember } from "../../../projects/ngx-ramblers/src/app/models/committee.model";
import {
  foldersExcludedFromInboxList,
  InboxMessage,
  InboxThread,
  InboxThreadFolder,
  InboxUserFolder
} from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { Member } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { inboxThread as inboxThreadModel } from "../mongo/models/inbox-thread";
import { inboxMessage as inboxMessageModel } from "../mongo/models/inbox-message";
import { inboxFolder as inboxFolderModel } from "../mongo/models/inbox-folder";
import { defaultTenantSlug } from "../inbox/inbox-aliases";
import { threadUnreadForMember } from "../inbox/inbox-unread-counts";
import { inboxThreadId } from "../../../projects/ngx-ramblers/src/app/functions/inbox-thread";
import mongoose from "mongoose";
import { execute } from "../mongo/mongoose-client";
import { imapUidMemberships, imapUidState } from "./mail-client-imap-uid-store";
import { MailClientUidState } from "./mail-client-imap-uid.model";
import { roleMatchingFrom } from "./mail-client-auth";
import { sentFolderFilter, sentMessageFilter } from "../inbox/inbox-sent";
import { MailClientImapMessage, MailClientMailbox } from "./mail-client-imap.model";

const SYSTEM_MAILBOXES: MailClientMailbox[] = [
  {name: "INBOX", folder: InboxThreadFolder.INBOX, userFolderId: null},
  {name: "Sent", folder: InboxThreadFolder.SENT, userFolderId: null},
  {name: "Drafts", folder: InboxThreadFolder.DRAFTS, userFolderId: null},
  {name: "Junk", folder: InboxThreadFolder.JUNK, userFolderId: null},
  {name: "Deleted", folder: InboxThreadFolder.DELETED, userFolderId: null}
];

export function selectedRoleForUsername(roles: CommitteeMember[], username: string): CommitteeMember | null {
  return roleMatchingFrom(roles, username) ?? roles[0] ?? null;
}

export async function listMailboxes(): Promise<MailClientMailbox[]> {
  const userFolders = await inboxFolderModel.find({tenantSlug: defaultTenantSlug()}).sort({sortIndex: 1, name: 1}).lean() as InboxUserFolder[];
  return SYSTEM_MAILBOXES.concat(userFolders.map(folder => ({
    name: folder.name,
    folder: null,
    userFolderId: folder.id ?? (folder as unknown as {_id: {toString(): string}})._id?.toString() ?? null
  })));
}

export function mailboxByName(mailboxes: MailClientMailbox[], name: string): MailClientMailbox | null {
  const wanted = name.replace(/^"/, "").replace(/"$/, "");
  return mailboxes.find(mailbox => mailbox.name.toLowerCase() === wanted.toLowerCase()) ?? null;
}

export async function mailboxUidState(role: CommitteeMember, mailbox: MailClientMailbox): Promise<MailClientUidState> {
  return execute(async () => imapUidState(mongoose.connection.db, {tenantSlug: defaultTenantSlug(), roleType: role.type, folder: mailbox.folder, userFolderId: mailbox.userFolderId}));
}

export async function messagesInMailbox(role: CommitteeMember, mailbox: MailClientMailbox, member: Member): Promise<MailClientImapMessage[]> {
  const tenantSlug = defaultTenantSlug();
  const threadQuery: Record<string, unknown> = {tenantSlug, roleType: role.type};
  if (mailbox.userFolderId) {
    threadQuery.userFolderId = mailbox.userFolderId;
    threadQuery.folder = {$nin: foldersExcludedFromInboxList()};
  } else if (mailbox.folder === InboxThreadFolder.SENT) {
    threadQuery.folder = sentFolderFilter();
  } else if (mailbox.folder === InboxThreadFolder.INBOX) {
    threadQuery.folder = {$nin: foldersExcludedFromInboxList()};
    threadQuery.userFolderId = null;
  } else if (mailbox.folder) {
    threadQuery.folder = mailbox.folder;
  }
  const threads = await inboxThreadModel.find(threadQuery).sort({lastSeenAt: 1}).lean() as InboxThread[];
  const threadIds = threads.map(thread => inboxThreadId(thread)).filter(Boolean);
  const messageQuery = {
    threadId: {$in: threadIds},
    ...(mailbox.folder === InboxThreadFolder.SENT ? sentMessageFilter() : {})
  };
  const messages = threadIds.length
    ? await inboxMessageModel.find(messageQuery).sort({sentAt: 1, receivedAt: 1}).lean() as InboxMessage[]
    : [];
  const threadsById = new Map(threads.map(thread => [inboxThreadId(thread), thread]));
  const memberships = messages.length
    ? await execute(async () => imapUidMemberships(mongoose.connection.db, {tenantSlug, roleType: role.type, folder: mailbox.folder, userFolderId: mailbox.userFolderId}))
    : [];
  const uids = new Map(memberships.map(entry => [entry.messageId, entry.uid]));
  return messages.flatMap(message => {
    const thread = threadsById.get(String(message.threadId));
    if (!thread) {
      return [];
    } else {
      const withId = {...message, id: message.id ?? (message as unknown as {_id: {toString(): string}})._id?.toString()};
      const uid = uids.get(withId.id);
      if (uid) {
        return [{
          uid,
          seq: 0,
          message: withId,
          thread,
          seen: !threadUnreadForMember(thread, member.id ?? null),
          deleted: false
        }];
      } else {
        return [];
      }
    }
  }).sort((left, right) => left.uid - right.uid).map((entry, index) => ({...entry, seq: index + 1}));
}

export async function markThreadSeen(thread: InboxThread, memberId: string, seen: boolean): Promise<void> {
  const threadId = inboxThreadId(thread);
  if (seen) {
    await inboxThreadModel.updateOne({_id: threadId}, {$addToSet: {readByMemberIds: memberId}, $set: {unread: false}});
  } else {
    await inboxThreadModel.updateOne({_id: threadId}, {$pull: {readByMemberIds: memberId}, $set: {unread: true}});
  }
}

export async function markThreadDeleted(thread: InboxThread): Promise<void> {
  await inboxThreadModel.updateOne(
    {_id: inboxThreadId(thread)},
    {$set: {folder: InboxThreadFolder.DELETED}, $unset: {userFolderId: 1}}
  );
}
