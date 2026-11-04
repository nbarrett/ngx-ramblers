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
import { imapMailboxKey, imapUidMailboxState, imapUidMemberships, imapUidState, IMAP_UID_MAILBOXES_COLLECTION, IMAP_UID_MEMBERSHIPS_COLLECTION, synchroniseImapThreadUids } from "./mail-client-imap-uid-store";
import { IMAP_SHARED_FOLDER_ROLE, MailClientUidMailbox, MailClientUidState, MailClientUidMailboxRecord } from "./mail-client-imap-uid.model";
import { roleMatchingFrom } from "./mail-client-auth";
import { sentFolderFilter, sentMessageFilter } from "../inbox/inbox-sent";
import { moveUserFolderThreadsToDeleted } from "../inbox/inbox-deleted";
import { MailClientImapMessage, MailClientMailbox, MailClientMailboxSnapshot } from "./mail-client-imap.model";
import { chunk, toPairs } from "es-toolkit/compat";
import {MailClientMessageMetadata, RFC822_BODY_ESCAPES} from "./mail-client-mime.model";
import debug from "debug";
import { envConfig } from "../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("mail-client:imap"));

const IMAP_THREAD_FIELDS = "_id tenantSlug roleType folder userFolderId lastDirection unread readByMemberIds";
const IMAP_UID_SYNC_BATCH = 25;
const mailboxSnapshots = new Map<string, MailClientMailboxSnapshot>();
const MAX_MAILBOX_SNAPSHOTS = 8;

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
  const messages = await inboxMessageModel.find({messageId: rfc822MessageId, ...(documentId ? {_id: documentId} : {})}).select("_id threadId").lean() as {_id: {toString(): string}; threadId?: string}[];
  const ids = messages.map(message => String(message._id));
  const listedMailbox = uidMailboxFor(role, mailbox);
  const memberships = ids.length ? await execute(async () => {
    const existing = await imapUidMemberships(mongoose.connection.db, listedMailbox, ids);
    if (existing[0]?.uid) {
      return existing;
    } else {
      const threadIds = [...new Set(messages.map(message => String(message.threadId)).filter(Boolean))];
      if (threadIds.length) {
        await synchroniseImapThreadUids(mongoose.connection.db, mongoose.connection.getClient(), threadIds);
      }
      return imapUidMemberships(mongoose.connection.db, listedMailbox, ids);
    }
  }) : [];
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
  const listedMailbox = uidMailboxFor(role, mailbox);
  const state = await execute(async () => imapUidMailboxState(mongoose.connection.db, listedMailbox));
  const key = JSON.stringify([imapMailboxKey(listedMailbox), member.id ?? null]);
  const snapshot = mailboxSnapshots.get(key);
  if (state && snapshot?.revision === state.revision && snapshot.uidValidity === state.uidValidity) {
    return (await snapshot.messages).map(message => ({...message}));
  } else {
    const messages = loadMailboxMessages(role, mailbox, member);
    if (state) {
      if (!mailboxSnapshots.has(key) && mailboxSnapshots.size >= MAX_MAILBOX_SNAPSHOTS) {
        mailboxSnapshots.delete(mailboxSnapshots.keys().next().value);
      }
      mailboxSnapshots.set(key, {revision: state.revision, uidValidity: state.uidValidity, messages});
    }
    try {
      return (await messages).map(message => ({...message}));
    } catch (error) {
      if (mailboxSnapshots.get(key)?.messages === messages) {
        mailboxSnapshots.delete(key);
      }
      throw error;
    }
  }
}

async function loadMailboxMessages(role: CommitteeMember, mailbox: MailClientMailbox, member: Member): Promise<MailClientImapMessage[]> {
  const tenantSlug = defaultTenantSlug();
  const threadQuery = threadQueryForMailbox(role, mailbox, tenantSlug);
  const listedMailbox = uidMailboxFor(role, mailbox);
  const threads = await inboxThreadModel.find(threadQuery).select(IMAP_THREAD_FIELDS).sort({lastSeenAt: -1}).lean() as InboxThread[];
  const threadIds = threads.map(thread => inboxThreadId(thread)).filter(Boolean);
  const messages = await chunk(threadIds, 150).reduce(async (previous, batch) => {
    const loaded = await previous;
    const messageQuery = {
      threadId: {$in: batch},
      ...(mailbox.folder === InboxThreadFolder.SENT ? sentMessageFilter() : {})
    };
    const batchMessages = await inboxMessageModel.find(messageQuery).select(messageHeaderProjection(false)).sort({sentAt: 1, receivedAt: 1}).lean() as InboxMessage[];
    return loaded.concat(batchMessages);
  }, Promise.resolve([] as InboxMessage[]));
  const messageIds = messages.map(message => message.id ?? (message as unknown as {_id: {toString(): string}})._id?.toString()).filter(Boolean);
  const memberships = messageIds.length
    ? await execute(async () => imapUidMemberships(mongoose.connection.db, listedMailbox, messageIds))
    : [];
  const threadsById = new Map(threads.map(thread => [inboxThreadId(thread), thread]));
  const uids = new Map(memberships.map(entry => [entry.messageId, entry.uid]));
  const unsyncedThreadIds = [...new Set(messages.flatMap(message => {
    const withId = message.id ?? (message as unknown as {_id: {toString(): string}})._id?.toString();
    return withId && !uids.has(withId) ? [String(message.threadId)] : [];
  }))].slice(0, IMAP_UID_SYNC_BATCH);
  const syncedMemberships = unsyncedThreadIds.length
    ? await execute(async () => {
      await synchroniseImapThreadUids(mongoose.connection.db, mongoose.connection.getClient(), unsyncedThreadIds);
      return imapUidMemberships(mongoose.connection.db, listedMailbox, messageIds);
    }).catch((error: Error) => {
      debugLog(`IMAP UID sync skipped ${error.message}`);
      return memberships;
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

export async function mailboxMessagesById(messageIds: string[], metadataOnly = false): Promise<MailClientMessageMetadata[]> {
  const query = inboxMessageModel.find({_id: {$in: messageIds}});
  const documents = (metadataOnly ? await query.select(messageHeaderProjection()).lean() : await query.lean()) as MailClientMessageMetadata[];
  return documents.map(document => ({...document, id: document.id ?? (document as unknown as {_id: {toString(): string}})._id?.toString()}));
}

function messageHeaderProjection(includeAttachmentBodies = true) {
  const escapedText = toPairs(RFC822_BODY_ESCAPES).reduce<Record<string, unknown> | string>((input, [find, replacement]) => ({$replaceAll: {input, find, replacement}}), "$$text");
  const body = {$let: {vars: {html: {$ifNull: ["$bodyHtml", ""]}, text: {$ifNull: ["$bodyText", ""]}},
    in: {$cond: [{$ne: ["$$html", ""]}, "$$html", {$cond: [{$ne: ["$$text", ""]}, {$concat: ["<pre>", escapedText, "</pre>"]}, ""]}]}}};
  const hasAttachments = {$gt: [{$size: {$ifNull: ["$attachments", []]}}, 0]};
  return {_id: 1, threadId: 1, messageId: 1, inReplyTo: 1, references: 1, from: 1, replyTo: 1, to: 1, cc: 1, subject: 1,
    receivedAt: 1, sentAt: 1, direction: 1, autoReply: 1, attachments: 1,
    bodyHtml: includeAttachmentBodies ? {$cond: [hasAttachments, "$bodyHtml", "$$REMOVE"]} : "$$REMOVE",
    bodyText: includeAttachmentBodies ? {$cond: [hasAttachments, "$bodyText", "$$REMOVE"]} : "$$REMOVE",
    bodySizeBytes: {$strLenBytes: body}};
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
    const result = await memberships.updateMany({mailboxKey, messageId, active: true}, {$set: {active: false}});
    if (result.modifiedCount > 0) {
      await mongoose.connection.db.collection<MailClientUidMailboxRecord>(IMAP_UID_MAILBOXES_COLLECTION).updateOne({_id: mailboxKey}, {$inc: {revision: 1}});
    }
    const remaining = await memberships.countDocuments({threadId, active: true});
    if (remaining === 0) {
      await markThreadDeleted(thread);
    }
  });
}
