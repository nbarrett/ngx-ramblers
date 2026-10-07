import { withResolvedDisplayRecipients } from "./inbox-display-addresses";
import { Request, Response } from "express";
import debug from "debug";
import { createErrorDebugLog } from "../shared/error-debug-log";
import { isString } from "es-toolkit/compat";
import { envConfig } from "../env-config/env-config";
import { errorResponse } from "../shared/error-response";
import { inboxThread as inboxThreadModel } from "../mongo/models/inbox-thread";
import { inboxMessage as inboxMessageModel } from "../mongo/models/inbox-message";
import { InboxMessage, InboxMessageDirection, InboxThread, foldersExcludedFromInboxList, InboxThreadFolder, InboxThreadListResponse, InboxUnreadCountsResponse, InboxUserFolderQuery, InboxViewScope } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { MemberCookie } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { assignedInboxRoleTypesForMember, permittedInboxRoleTypes, permittedToReadJunk, requestMember, requestingMemberId } from "./inbox-access";
import { defaultTenantSlug } from "./inbox-aliases";
import { sentMessageRows, sentThreadObjectIds } from "./inbox-sent";
import { conversationCount, conversationCountsByRole, threadUnreadForMember, unreadConditionForMember, unreadConversationFilter } from "./inbox-unread-counts";
const messageType = "inbox";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = true;
const errorDebugLog = createErrorDebugLog(messageType);
export async function readInboxUnreadCounts(req: Request, res: Response): Promise<void> {
  try {
    const [allowedRoleTypes, assignedRoleTypes] = await Promise.all([
      permittedInboxRoleTypes(req),
      assignedInboxRoleTypesForMember(requestMember(req))
    ]);
    const scopeRoleTypes = req.query.scope === InboxViewScope.ASSIGNED_ROLES
      ? assignedRoleTypes.filter(assignedRoleType => allowedRoleTypes.includes(assignedRoleType))
      : allowedRoleTypes;
    if (scopeRoleTypes.length === 0) {
      const empty: InboxUnreadCountsResponse = { total: 0, byRole: [] };
      res.json({ request: { messageType }, response: empty });
    }
    else {
      const unreadFilter = unreadConversationFilter(scopeRoleTypes, requestingMemberId(req));
      const [byRole, total] = await Promise.all([conversationCountsByRole(unreadFilter), conversationCount(unreadFilter)]);
      const response: InboxUnreadCountsResponse = { total, byRole };
      res.json({ request: { messageType }, response });
    }
  }
  catch (error) {
    errorDebugLog("Error fetching inbox unread counts:", (error as Error).message);
    res.status(500).json({ request: { messageType }, error: errorResponse(error) });
  }
}
export async function listInboxThreads(req: Request, res: Response): Promise<void> {
  try {
    const limit = req.query.limit ? Math.min(parseInt(req.query.limit as string, 10) || 50, 200) : 50;
    const offset = req.query.offset ? Math.max(parseInt(req.query.offset as string, 10) || 0, 0) : 0;
    if (req.query.folder === InboxThreadFolder.JUNK) {
      if (!(await permittedToReadJunk(req))) {
        res.status(403).json({ request: { messageType }, error: "You do not have access to junk mail" });
      }
      else {
        const junkMemberId = requestingMemberId(req);
        const junkFilter = await threadSearchFilter({ tenantSlug: defaultTenantSlug(), folder: InboxThreadFolder.JUNK }, req.query.search);
        const junkListFilter = req.query.unreadOnly === "true"
          ? { ...junkFilter, ...unreadConditionForMember(junkMemberId) }
          : junkFilter;
        const junkThreads = await inboxThreadModel.find(junkListFilter).sort({ lastSeenAt: -1 }).skip(offset).limit(limit).lean();
        const junkThreadsForMember = (junkThreads as InboxThread[]).map(thread => ({ ...thread, unread: threadUnreadForMember(thread, junkMemberId) }));
        const junkResponse: InboxThreadListResponse = {
          threads: await withResolvedDisplayRecipients(junkThreadsForMember),
          unreadCount: await conversationCount({ ...junkFilter, ...unreadConditionForMember(junkMemberId) }),
          totalCount: await conversationCount(junkFilter)
        };
        res.json({ request: { messageType }, response: junkResponse });
      }
    }
    else {
      const [allowedRoleTypes, assignedRoleTypes] = await Promise.all([
        permittedInboxRoleTypes(req),
        assignedInboxRoleTypesForMember(requestMember(req))
      ]);
      const roleType = req.query.roleType;
      if (isString(roleType) && !allowedRoleTypes.includes(roleType)) {
        res.status(403).json({ request: { messageType }, error: "You do not have access to this role mailbox" });
      }
      else {
        const scopeRoleTypes = req.query.scope === InboxViewScope.ASSIGNED_ROLES
          ? assignedRoleTypes.filter(assignedRoleType => allowedRoleTypes.includes(assignedRoleType))
          : allowedRoleTypes;
        const memberId = requestingMemberId(req);
        if (req.query.folder === InboxThreadFolder.SENT) {
          const sentSearchTermRaw = isString(req.query.search) ? req.query.search.trim() : "";
          const outboundFilter: Record<string, unknown> = sentSearchTermRaw
            ? { direction: InboxMessageDirection.OUTBOUND, autoReply: { $ne: true }, $or: messageSearchOr({ $regex: escapeSearchRegex(sentSearchTermRaw), $options: "i" }) }
            : { direction: InboxMessageDirection.OUTBOUND, autoReply: { $ne: true } };
          const outboundMessages = await inboxMessageModel.find(outboundFilter)
            .select("threadId messageId subject from to sentAt receivedAt direction").lean();
          const sentThreadIds = Array.from(new Set(outboundMessages.map(message => String(message.threadId))));
          const sentFilter: Record<string, unknown> = {
            tenantSlug: defaultTenantSlug(),
            _id: { $in: sentThreadObjectIds(sentThreadIds) },
            roleType: isString(roleType) ? roleType : { $in: scopeRoleTypes },
            folder: { $nin: [InboxThreadFolder.JUNK, InboxThreadFolder.DELETED] }
          };
          const sentThreads = await inboxThreadModel.find(sentFilter).lean();
          const { rows } = sentMessageRows(sentThreads as InboxThread[], outboundMessages as InboxMessage[], 0, Number.MAX_SAFE_INTEGER);
          const rowsForMember = rows.map(row => ({ ...row, unread: threadUnreadForMember(row, memberId) }));
          const unreadRows = rowsForMember.filter(row => row.unread);
          const visibleRows = (req.query.unreadOnly === "true" ? unreadRows : rowsForMember).slice(offset, offset + limit);
          const sentResponse: InboxThreadListResponse = {
            threads: visibleRows,
            unreadCount: unreadRows.length,
            totalCount: rowsForMember.length
          };
          res.json({ request: { messageType }, response: sentResponse });
        }
        else {
          const userFolderId = isString(req.query.userFolderId) ? req.query.userFolderId : null;
          const roleScopeFilter: Record<string, unknown> = {
            tenantSlug: defaultTenantSlug(),
            roleType: isString(roleType) ? roleType : { $in: scopeRoleTypes },
            folder: req.query.folder === InboxThreadFolder.DELETED
              ? InboxThreadFolder.DELETED
              : { $nin: foldersExcludedFromInboxList() }
          };
          if (req.query.folder !== InboxThreadFolder.DELETED) {
            if (userFolderId === InboxUserFolderQuery.ALL) {
              roleScopeFilter.userFolderId = {$ne: null};
            } else {
              roleScopeFilter.userFolderId = userFolderId || null;
            }
          }
          const scopeFilter = await threadSearchFilter(roleScopeFilter, req.query.search);
          const filter = req.query.unreadOnly === "true"
            ? { ...scopeFilter, ...unreadConditionForMember(memberId) }
            : scopeFilter;
          const [threads, unreadCount, totalCount] = await Promise.all([
            inboxThreadModel.find(filter).sort({ lastSeenAt: -1 }).skip(offset).limit(limit).lean(),
            conversationCount({ ...scopeFilter, ...unreadConditionForMember(memberId) }),
            conversationCount(scopeFilter)
          ]);
          const threadsForMember = (threads as InboxThread[]).map(thread => ({ ...thread, unread: threadUnreadForMember(thread, memberId) }));
          const response: InboxThreadListResponse = { threads: await withResolvedDisplayRecipients(threadsForMember), unreadCount, totalCount };
          res.json({ request: { messageType }, response });
        }
      }
    }
  }
  catch (error) {
    errorDebugLog("Error listing inbox threads:", (error as Error).message);
    res.status(500).json({ request: { messageType }, error: errorResponse(error) });
  }
}
function escapeSearchRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function messageSearchOr(rx: {
  $regex: string;
  $options: string;
}): Record<string, unknown>[] {
  return [
    { subject: rx },
    { bodyText: rx },
    { "from.email": rx },
    { "from.name": rx },
    { "to.email": rx },
    { "to.name": rx },
    { "cc.email": rx }
  ];
}
async function threadSearchFilter(baseFilter: Record<string, unknown>, search: unknown): Promise<Record<string, unknown>> {
  const term = isString(search) ? escapeSearchRegex(search.trim()) : "";
  if (!term) {
    return baseFilter;
  }
  else {
    const rx = { $regex: term, $options: "i" };
    const matchingThreadIds = await inboxMessageModel.distinct("threadId", {
      $or: messageSearchOr(rx)
    });
    return {
      ...baseFilter,
      $or: [
        { normalisedSubject: rx },
        { subject: rx },
        { "externalAddress.name": rx },
        { "externalAddress.email": rx },
        { _id: { $in: matchingThreadIds } }
      ]
    };
  }
}
