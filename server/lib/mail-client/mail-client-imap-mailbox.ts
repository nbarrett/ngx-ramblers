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
import { inboxThreadId, inboxFolderSlug, uniqueInboxFolderSlug } from "../../../projects/ngx-ramblers/src/app/functions/inbox-thread";
import mongoose from "mongoose";
import { execute } from "../mongo/mongoose-client";
import { imapMailboxKey, imapUidMemberships, imapUidState, IMAP_UID_MEMBERSHIPS_COLLECTION, synchroniseImapThreadUids } from "./mail-client-imap-uid-store";
import { IMAP_SHARED_FOLDER_ROLE, MailClientUidMailbox, MailClientUidState } from "./mail-client-imap-uid.model";
import { roleMatchingFrom } from "./mail-client-auth";
import { sentFolderFilter, sentMessageFilter } from "../inbox/inbox-sent";
import { moveUserFolderThreadsToDeleted } from "../inbox/inbox-deleted";
import { MailClientImapMessage, MailClientMailbox } from "./mail-client-imap.model";
import { chunk } from "es-toolkit/compat";

const IMAP_LISTING_EXCLUSIONS = "-bodyHtml -bodyText";

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

const MAILBOX_NAME_ALIASES: Record<string, string> = {
  "deleted items": "Deleted",
  "junk email": "Junk",
  "sent items": "Sent",
  inbox: "INBOX"
};

const TRASH_PARENTS = ["deleted", "deleted items", "trash"];
const CLIENT_ONLY_MAILBOXES = ["archive", "conversation history", "outbox", "snoozed", "sync issues", "conflicts", "local failures", "server failures"];

export function clientOnlyMailboxName(name: string): boolean {
  const wanted = normalisedMailboxName(name).toLowerCase();
  return CLIENT_ONLY_MAILBOXES.includes(wanted) || renamedIntoDeleted(name);
}

export function renamedIntoDeleted(name: string): boolean {
  const normalised = normalisedMailboxName(name);
  const slash = normalised.indexOf("/");
  if (slash <= 0) {
    return false;
  } else {
    return TRASH_PARENTS.includes(normalised.slice(0, slash).toLowerCase());
  }
}

export function normalisedMailboxName(name: string): string {
  const decoded = decodeModifiedUtf7(name.trim().replace(/^"/, "").replace(/"$/, ""));
  const withoutDelimiter = decoded.replace(/\/+$/, "");
  return withoutDelimiter.replace(/^inbox\//i, "").trim();
}

function decodeModifiedUtf7(value: string): string {
  return value.replace(/&([^-]*)-/g, (_match, encoded: string) => {
    if (!encoded) {
      return "&";
    } else {
      const bytes = Buffer.from(encoded.replace(/,/g, "/"), "base64");
      return chunk(Array.from(bytes), 2).map(pair => String.fromCharCode(((pair[0] ?? 0) << 8) | (pair[1] ?? 0))).join("");
    }
  });
}

export function mailboxByName(mailboxes: MailClientMailbox[], name: string): MailClientMailbox | null {
  const wanted = normalisedMailboxName(name);
  const canonical = MAILBOX_NAME_ALIASES[wanted.toLowerCase()] ?? wanted;
  return mailboxes.find(mailbox => mailbox.name.toLowerCase() === canonical.toLowerCase()) ?? null;
}

export function uidMailboxFor(role: CommitteeMember, mailbox: MailClientMailbox): MailClientUidMailbox {
  return {
    tenantSlug: defaultTenantSlug(),
    roleType: mailbox.userFolderId ? IMAP_SHARED_FOLDER_ROLE : role.type,
    folder: mailbox.folder,
    userFolderId: mailbox.userFolderId
  };
}

export async function mailboxUidState(role: CommitteeMember, mailbox: MailClientMailbox): Promise<MailClientUidState> {
  return execute(async () => imapUidState(mongoose.connection.db, uidMailboxFor(role, mailbox)));
}

export async function mailboxMessageUid(role: CommitteeMember, mailbox: MailClientMailbox, rfc822MessageId: string, documentId: string | null = null): Promise<number | null> {
  const messages = await inboxMessageModel.find({messageId: rfc822MessageId, ...(documentId ? {_id: documentId} : {})}).select("_id").lean();
  const ids = messages.map(message => String(message._id));
  const memberships = ids.length ? await execute(async () => imapUidMemberships(mongoose.connection.db, uidMailboxFor(role, mailbox), ids)) : [];
  return memberships[0]?.uid ?? null;
}

function threadQueryForMailbox(role: CommitteeMember, mailbox: MailClientMailbox, tenantSlug: string): Record<string, unknown> {
  if (mailbox.userFolderId) {
    return {tenantSlug, userFolderId: mailbox.userFolderId, folder: {$nin: foldersExcludedFromInboxList()}};
  } else if (mailbox.folder === InboxThreadFolder.SENT) {
    return {tenantSlug, roleType: role.type, folder: sentFolderFilter()};
  } else if (mailbox.folder === InboxThreadFolder.INBOX) {
    return {tenantSlug, roleType: role.type, folder: {$nin: foldersExcludedFromInboxList()}, userFolderId: null};
  } else if (mailbox.folder) {
    return {tenantSlug, roleType: role.type, folder: mailbox.folder};
  } else {
    return {tenantSlug, roleType: role.type};
  }
}

export async function messagesInMailbox(role: CommitteeMember, mailbox: MailClientMailbox, member: Member): Promise<MailClientImapMessage[]> {
  const tenantSlug = defaultTenantSlug();
  const threadQuery = threadQueryForMailbox(role, mailbox, tenantSlug);
  const threads = await inboxThreadModel.find(threadQuery).sort({lastSeenAt: 1}).lean() as InboxThread[];
  const threadIds = threads.map(thread => inboxThreadId(thread)).filter(Boolean);
  const messageQuery = {
    threadId: {$in: threadIds},
    ...(mailbox.folder === InboxThreadFolder.SENT ? sentMessageFilter() : {})
  };
  const messages = threadIds.length
    ? await inboxMessageModel.find(messageQuery).select(IMAP_LISTING_EXCLUSIONS).sort({sentAt: 1, receivedAt: 1}).lean() as InboxMessage[]
    : [];
  const threadsById = new Map(threads.map(thread => [inboxThreadId(thread), thread]));
  const listedMailbox = uidMailboxFor(role, mailbox);
  const memberships = messages.length
    ? await execute(async () => imapUidMemberships(mongoose.connection.db, listedMailbox))
    : [];
  const uids = new Map(memberships.map(entry => [entry.messageId, entry.uid]));
  const unsyncedThreadIds = [...new Set(messages.flatMap(message => {
    const withId = message.id ?? (message as unknown as {_id: {toString(): string}})._id?.toString();
    return withId && !uids.has(withId) ? [String(message.threadId)] : [];
  }))];
  const syncedMemberships = unsyncedThreadIds.length
    ? await execute(async () => {
      await synchroniseImapThreadUids(mongoose.connection.db, mongoose.connection.getClient(), unsyncedThreadIds);
      return imapUidMemberships(mongoose.connection.db, listedMailbox);
    })
    : memberships;
  const syncedUids = new Map(syncedMemberships.map(entry => [entry.messageId, entry.uid]));
  return messages.flatMap(message => {
    const thread = threadsById.get(String(message.threadId));
    if (!thread) {
      return [];
    } else {
      const withId = {...message, id: message.id ?? (message as unknown as {_id: {toString(): string}})._id?.toString()};
      const uid = syncedUids.get(withId.id);
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

export async function mailboxMessageById(messageId: string): Promise<InboxMessage | null> {
  return (await mailboxMessagesById([messageId]))[0] ?? null;
}

export async function mailboxMessagesById(messageIds: string[]): Promise<InboxMessage[]> {
  const documents = await inboxMessageModel.find({_id: {$in: messageIds}}).lean() as InboxMessage[];
  return documents.map(document => ({...document, id: document.id ?? (document as unknown as {_id: {toString(): string}})._id?.toString()}));
}

export async function createMailboxFolder(name: string, memberId: string): Promise<MailClientMailbox> {
  const tenantSlug = defaultTenantSlug();
  const trimmed = normalisedMailboxName(name);
  if (!trimmed) {
    throw new Error("Mailbox name is empty");
  }
  const existing = await listMailboxes();
  const match = existing.find(mailbox => mailbox.name.toLowerCase() === trimmed.toLowerCase());
  if (match) {
    return match;
  } else {
    const folders = await inboxFolderModel.find({tenantSlug}).select("slug name sortIndex").lean() as InboxUserFolder[];
    const highest = folders.reduce((max, folder) => Math.max(max, folder.sortIndex ?? 0), -1);
    const created = await inboxFolderModel.create({
      tenantSlug,
      name: trimmed,
      slug: uniqueInboxFolderSlug(inboxFolderSlug(trimmed), folders.map(folder => folder.slug || inboxFolderSlug(folder.name))),
      sortIndex: highest + 1,
      createdByMemberId: memberId
    });
    return {name: created.name, folder: null, userFolderId: created.id ?? created._id?.toString() ?? null};
  }
}

export async function renameMailboxFolder(fromName: string, toName: string): Promise<MailClientMailbox> {
  const from = normalisedMailboxName(fromName);
  const to = normalisedMailboxName(toName);
  const existing = await listMailboxes();
  const source = mailboxByName(existing, from);
  const destination = mailboxByName(existing, to);
  if (!from || !to) {
    throw new Error("Mailbox name is empty");
  } else if (!source?.userFolderId || (destination && !destination.userFolderId)) {
    throw new Error(source ? "Mailbox cannot be renamed" : "Mailbox does not exist");
  } else if (destination?.userFolderId && destination.userFolderId !== source.userFolderId) {
    throw new Error("Mailbox already exists");
  } else {
    const tenantSlug = defaultTenantSlug();
    const folders = await inboxFolderModel.find({tenantSlug}).select("slug name").lean() as InboxUserFolder[];
    const slug = uniqueInboxFolderSlug(inboxFolderSlug(to), folders
      .filter(folder => (folder.id ?? folder["_id"]?.toString()) !== source.userFolderId)
      .map(folder => folder.slug || inboxFolderSlug(folder.name)));
    await inboxFolderModel.updateOne({_id: source.userFolderId, tenantSlug}, {$set: {name: to, slug}});
    return {name: to, folder: null, userFolderId: source.userFolderId};
  }
}

export async function deleteMailboxFolder(name: string): Promise<void> {
  const wanted = normalisedMailboxName(name);
  const source = mailboxByName(await listMailboxes(), wanted);
  if (!wanted || !source?.userFolderId) {
    throw new Error(source ? "Mailbox cannot be deleted" : "Mailbox does not exist");
  } else {
    await moveUserFolderThreadsToDeleted(source.userFolderId, defaultTenantSlug());
    await inboxFolderModel.deleteOne({_id: source.userFolderId, tenantSlug: defaultTenantSlug()});
  }
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

export async function expungeImapMessage(role: CommitteeMember, mailbox: MailClientMailbox, message: InboxMessage, thread: InboxThread): Promise<void> {
  const mailboxKey = imapMailboxKey(uidMailboxFor(role, mailbox));
  const messageId = message.id ?? (message as unknown as {_id: {toString(): string}})._id?.toString();
  const threadId = inboxThreadId(thread);
  await execute(async () => {
    const memberships = mongoose.connection.db.collection(IMAP_UID_MEMBERSHIPS_COLLECTION);
    await memberships.updateMany({mailboxKey, messageId, active: true}, {$set: {active: false}});
    const remaining = await memberships.countDocuments({threadId, active: true});
    if (remaining === 0) {
      await markThreadDeleted(thread);
    }
  });
}
