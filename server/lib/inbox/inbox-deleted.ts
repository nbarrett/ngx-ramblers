import { InboxDeletedIdentity, InboxMessage, InboxThread, InboxThreadFolder, INBOX_DELETED_RETENTION_DAYS } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { inboxDeletedIdentity as inboxDeletedIdentityModel } from "../mongo/models/inbox-deleted-identity";
import { inboxMessage as inboxMessageModel } from "../mongo/models/inbox-message";
import { inboxThread as inboxThreadModel } from "../mongo/models/inbox-thread";
import { dateTimeNow } from "../shared/dates";
import { defaultTenantSlug } from "./inbox-aliases";

function uniqueStrings(values: (string | null | undefined)[]): string[] {
  return values.filter((value): value is string => !!value).reduce<string[]>((unique, value) => unique.includes(value) ? unique : unique.concat(value), []);
}

export async function recordThreadDeletion(thread: InboxThread, messages: InboxMessage[], threadId = thread.id ?? ""): Promise<void> {
  const now = dateTimeNow().toMillis();
  const resolvedThreadId = threadId || (thread as unknown as {_id?: {toString(): string}})._id?.toString() || "";
  await inboxDeletedIdentityModel.create({
    tenantSlug: thread.tenantSlug,
    threadId: resolvedThreadId,
    messageIds: uniqueStrings([...(thread.messageIds ?? []), ...messages.map(message => message.messageId)]),
    externalIds: uniqueStrings(messages.map(message => message.externalId)),
    conversationKeys: uniqueStrings([thread.conversationKey, ...messages.map(message => message.conversationKey)]),
    deletedAt: now
  } satisfies Omit<InboxDeletedIdentity, "id">);
  await inboxThreadModel.updateOne(
    {_id: resolvedThreadId, tenantSlug: thread.tenantSlug},
    {$set: {folder: InboxThreadFolder.DELETED, deletedAt: now}}
  );
}

export async function isRecordedDeletedInbound(tenantSlug: string, message: InboxMessage): Promise<boolean> {
  const clauses = [
    message.messageId ? {messageIds: message.messageId} : null,
    message.externalId ? {externalIds: message.externalId} : null,
    message.conversationKey ? {conversationKeys: message.conversationKey} : null
  ].filter(Boolean);
  const found = clauses.length === 0
    ? null
    : await inboxDeletedIdentityModel.findOne({tenantSlug, $or: clauses});
  return Boolean(found);
}

export async function restoreDeletedThread(threadId: string, tenantSlug: string = defaultTenantSlug()): Promise<void> {
  await inboxThreadModel.updateOne(
    {_id: threadId, tenantSlug, folder: InboxThreadFolder.DELETED},
    {$set: {folder: InboxThreadFolder.INBOX, unread: true, readByMemberIds: []}, $unset: {deletedAt: 1}}
  );
  await inboxDeletedIdentityModel.deleteMany({tenantSlug, threadId});
}

export async function permanentlyDeleteThread(threadId: string, tenantSlug: string = defaultTenantSlug()): Promise<void> {
  await inboxMessageModel.deleteMany({threadId});
  await inboxThreadModel.deleteOne({_id: threadId, tenantSlug});
}

export async function permanentlyDeleteThreads(threadIds: string[], tenantSlug: string = defaultTenantSlug()): Promise<{matched: number; modified: number}> {
  const threads = await inboxThreadModel.find({_id: {$in: threadIds}, tenantSlug}).select("_id").lean();
  const matchedThreadIds = threads.map(thread => thread._id.toString());
  await inboxMessageModel.deleteMany({threadId: {$in: matchedThreadIds}});
  const result = await inboxThreadModel.deleteMany({_id: {$in: matchedThreadIds}, tenantSlug});
  return {matched: matchedThreadIds.length, modified: result.deletedCount};
}

export async function purgeExpiredDeletedThreads(tenantSlug: string = defaultTenantSlug()): Promise<number> {
  const cutoff = dateTimeNow().minus({days: INBOX_DELETED_RETENTION_DAYS}).toMillis();
  const expired = await inboxDeletedIdentityModel.find({tenantSlug, deletedAt: {$lte: cutoff}}).lean() as InboxDeletedIdentity[];
  await expired.reduce<Promise<void>>(async (previous, identity) => {
    await previous;
    await permanentlyDeleteThread(identity.threadId, tenantSlug);
    await inboxDeletedIdentityModel.deleteMany({tenantSlug, threadId: identity.threadId});
  }, Promise.resolve());
  return expired.length;
}
