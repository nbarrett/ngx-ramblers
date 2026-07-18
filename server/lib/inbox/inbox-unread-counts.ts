import { isArray } from "es-toolkit/compat";
import { inboxThread as inboxThreadModel } from "../mongo/models/inbox-thread";
import { InboxThread, InboxThreadFolder } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { defaultTenantSlug } from "./inbox-aliases";

const conversationGroupId = {$ifNull: ["$conversationKey", {$toString: "$_id"}]};

export function threadUnreadForMember(thread: InboxThread, memberId: string | null): boolean {
  return memberId ? !(thread.readByMemberIds ?? []).includes(memberId) : thread.unread;
}

export function unreadConditionForMember(memberId: string | null): Record<string, unknown> {
  return memberId ? {readByMemberIds: {$ne: memberId}} : {unread: true};
}

export async function conversationCount(filter: Record<string, unknown>): Promise<number> {
  const [result] = await inboxThreadModel.aggregate([
    {$match: filter},
    {$group: {_id: conversationGroupId}},
    {$count: "conversations"}
  ]);
  return result?.conversations ?? 0;
}

export async function conversationCountsByRole(filter: Record<string, unknown>): Promise<{ roleType: string; unreadCount: number }[]> {
  const counts = await inboxThreadModel.aggregate([
    {$match: filter},
    {$group: {_id: {roleType: "$roleType", conversation: conversationGroupId}}},
    {$group: {_id: "$_id.roleType", unreadCount: {$sum: 1}}}
  ]);
  return counts.map(row => ({roleType: row._id, unreadCount: row.unreadCount}));
}

export function unreadConversationFilter(roleTypes: string[] | string, memberId: string | null): Record<string, unknown> {
  return {
    tenantSlug: defaultTenantSlug(),
    roleType: isArray(roleTypes) ? {$in: roleTypes} : roleTypes,
    folder: {$ne: InboxThreadFolder.JUNK},
    ...unreadConditionForMember(memberId)
  };
}

export async function unreadConversationCountForRole(roleType: string, memberId: string | null): Promise<number> {
  return conversationCount(unreadConversationFilter(roleType, memberId));
}
