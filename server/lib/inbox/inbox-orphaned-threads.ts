import { normaliseEmail } from "../../../projects/ngx-ramblers/src/app/functions/strings";
import { InboxAliasConfig, InboxMessage, InboxMessageDirection, InboxRemapCandidate, InboxThread, InboxThreadFolder, OrphanedInboxThread } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { inboxThread as inboxThreadModel } from "../mongo/models/inbox-thread";
import { inboxMessage as inboxMessageModel } from "../mongo/models/inbox-message";
import { derivedAliases, defaultTenantSlug } from "./inbox-aliases";

export function configuredRoleTypeSet(aliases: InboxAliasConfig[]): Set<string> {
  return new Set(aliases.map(alias => alias.roleType));
}

export function isOrphanedRoleType(roleType: string, configuredRoleTypes: Set<string>): boolean {
  return !configuredRoleTypes.has(roleType);
}

export function aliasesByRoleEmail(aliases: InboxAliasConfig[]): Map<string, InboxAliasConfig> {
  return aliases.reduce((map, alias) => {
    [alias.roleEmail, ...(alias.additionalEmails ?? [])].forEach(address => {
      const key = normaliseEmail(address);
      if (key && !map.has(key)) {
        map.set(key, alias);
      }
    });
    return map;
  }, new Map<string, InboxAliasConfig>());
}

export function proposedTargetFromInbound(inboundMessages: Pick<InboxMessage, "to">[], aliasesByEmail: Map<string, InboxAliasConfig>): InboxAliasConfig | null {
  const candidateEmails = inboundMessages.flatMap(message => (message.to ?? [])
    .map(address => normaliseEmail(address.email))
    .filter(email => email.length > 0));
  return candidateEmails.map(email => aliasesByEmail.get(email)).find(alias => !!alias) ?? null;
}

export function remapCandidatesFrom(aliases: InboxAliasConfig[]): InboxRemapCandidate[] {
  return aliases
    .filter(alias => alias.enabled)
    .map(alias => ({roleType: alias.roleType, roleEmail: alias.roleEmail}));
}

function inboundMessagesByThread(messages: Pick<InboxMessage, "threadId" | "to">[]): Map<string, Pick<InboxMessage, "to">[]> {
  return messages.reduce((map, message) => {
    const existing = map.get(message.threadId) ?? [];
    existing.push({to: message.to});
    map.set(message.threadId, existing);
    return map;
  }, new Map<string, Pick<InboxMessage, "to">[]>());
}

export async function orphanedInboxThreads(): Promise<OrphanedInboxThread[]> {
  const aliases = await derivedAliases();
  const configuredRoleTypes = configuredRoleTypeSet(aliases);
  const aliasesByEmail = aliasesByRoleEmail(aliases);
  const tenantSlug = defaultTenantSlug();
  const threads = await inboxThreadModel.find({tenantSlug}).sort({lastSeenAt: -1}).lean() as unknown as (InboxThread & {_id: {toString(): string}})[];
  const orphaned = threads
    .filter(thread => isOrphanedRoleType(thread.roleType, configuredRoleTypes))
    .map(thread => ({...thread, id: thread._id.toString()}));
  const orphanIds = orphaned.map(thread => thread.id);
  const inbound = orphanIds.length === 0
    ? []
    : await inboxMessageModel
      .find({threadId: {$in: orphanIds}, direction: InboxMessageDirection.INBOUND})
      .select("threadId to")
      .lean() as unknown as Pick<InboxMessage, "threadId" | "to">[];
  const inboundByThread = inboundMessagesByThread(inbound);
  return orphaned.map(thread => {
    const proposal = proposedTargetFromInbound(inboundByThread.get(thread.id) ?? [], aliasesByEmail);
    return {
      thread,
      proposedRoleType: proposal?.roleType ?? null,
      proposedRoleEmail: proposal?.roleEmail ?? null
    };
  });
}

export async function folderlessThreadIds(): Promise<string[]> {
  const threads = await inboxThreadModel.find({
    tenantSlug: defaultTenantSlug(),
    $or: [{folder: {$exists: false}}, {folder: null}]
  }).select("_id").lean() as unknown as {_id: {toString(): string}}[];
  return threads.map(thread => thread._id.toString());
}

export async function restoreThreadsToInbox(threadIds: string[]): Promise<{matched: number; modified: number}> {
  const result = await inboxThreadModel.updateMany(
    {_id: {$in: threadIds}, tenantSlug: defaultTenantSlug()},
    {$set: {folder: InboxThreadFolder.INBOX}}
  );
  return {matched: result.matchedCount ?? 0, modified: result.modifiedCount ?? 0};
}

export async function remapInboxThreads(threadIds: string[], targetRoleType: string): Promise<{matched: number; modified: number; targetRoleType: string}> {
  const configuredRoleTypes = configuredRoleTypeSet(await derivedAliases());
  if (!configuredRoleTypes.has(targetRoleType)) {
    throw new Error(`Cannot remap threads to ${targetRoleType} because it is not a configured inbox mailbox`);
  }
  const result = await inboxThreadModel.updateMany(
    {_id: {$in: threadIds}, tenantSlug: defaultTenantSlug()},
    {$set: {roleType: targetRoleType}}
  );
  return {matched: result.matchedCount ?? 0, modified: result.modifiedCount ?? 0, targetRoleType};
}
