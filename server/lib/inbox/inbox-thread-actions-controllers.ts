import { inboxThreadId } from "../../../projects/ngx-ramblers/src/app/functions/inbox-thread";
import { accessibleThread, resolveThreadConnection, connectionForMessage, hydrateMessage, threadCorrespondent } from "./inbox-thread-context";
import { Request, Response } from "express";
import debug from "debug";
import { createErrorDebugLog } from "../shared/error-debug-log";
import { envConfig } from "../env-config/env-config";
import { errorResponse } from "../shared/error-response";
import { inboxMailboxConnection as inboxMailboxConnectionModel } from "../mongo/models/inbox-mailbox-connection";
import { inboxThread as inboxThreadModel } from "../mongo/models/inbox-thread";
import { inboxMessage as inboxMessageModel } from "../mongo/models/inbox-message";
import { InboxMailboxConnection, InboxMessage, InboxMessageDirection, InboxNewMessageEvent, InboxReaderProvider, InboxThreadFolder, InboxThreadMessagesResponse, isInboxGeneralRoleType } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { markMessagesRead, markMessagesUnread, removeSpamLabel, trashMessage } from "./gmail-inbox-reader";
import { permanentlyDeleteThread, recordThreadDeletion, restoreDeletedThread } from "./inbox-deleted";
import { broadcast } from "../websockets/websocket-broadcaster";
import { MessageType } from "../../../projects/ngx-ramblers/src/app/models/websocket.model";
import { requireInboxConfigurationAdministrator, requestingMemberId } from "./inbox-access";
import { defaultTenantSlug, connectionIdentifier as connectionId, derivedAliases, messageAddressEmails, roleIdentityEmailsByType, roleMatchesMessageAddresses } from "./inbox-aliases";
import { threadUnreadForMember, unreadConversationCountForRole } from "./inbox-unread-counts";
const messageType = "inbox";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = true;
const errorDebugLog = createErrorDebugLog(messageType);
export async function readInboxThread(req: Request, res: Response): Promise<void> {
  try {
    const thread = await accessibleThread(req, res, req.params.id);
    if (thread) {
      const threadId = inboxThreadId(thread);
      const storedMessages = await inboxMessageModel.find({ threadId }).sort({ receivedAt: 1, sentAt: 1 }).lean();
      const connection = await resolveThreadConnection(thread, storedMessages as InboxMessage[]);
      if (!connection) {
        res.status(404).json({ request: { messageType }, error: `No Gmail mailbox connection found for role ${thread.roleType}` });
      }
      else {
        const messages = await Promise.all(storedMessages.map(async (message) => {
          const storedMessage = message as InboxMessage;
          return hydrateMessage(await connectionForMessage(storedMessage, connection), storedMessage);
        }));
        const correspondent = await threadCorrespondent(connection, messages);
        const threadForMember = {
          ...thread,
          ...(correspondent ? { externalAddress: correspondent } : {}),
          unread: threadUnreadForMember(thread, requestingMemberId(req))
        };
        const response: InboxThreadMessagesResponse = { thread: threadForMember, messages };
        res.json({ request: { messageType }, response });
      }
    }
  }
  catch (error) {
    errorDebugLog("Error fetching thread:", (error as Error).message);
    res.status(500).json({ request: { messageType }, error: errorResponse(error) });
  }
}
export async function markThreadRead(req: Request, res: Response): Promise<void> {
  try {
    await updateThreadReadState(req, res, false);
  }
  catch (error) {
    errorDebugLog("Error marking thread read:", (error as Error).message);
    res.status(500).json({ request: { messageType }, error: errorResponse(error) });
  }
}
export async function markThreadUnread(req: Request, res: Response): Promise<void> {
  try {
    await updateThreadReadState(req, res, true);
  }
  catch (error) {
    errorDebugLog("Error marking thread unread:", (error as Error).message);
    res.status(500).json({ request: { messageType }, error: errorResponse(error) });
  }
}
export async function deleteInboxThread(req: Request, res: Response): Promise<void> {
  try {
    const thread = await accessibleThread(req, res, req.params.id);
    if (thread) {
      const storedMessages = await inboxMessageModel.find({ threadId: inboxThreadId(thread) }).lean() as InboxMessage[];
      if (thread.folder === InboxThreadFolder.JUNK) {
        const connection = await resolveThreadConnection(thread, storedMessages);
        if (connection) {
          await Promise.all(gmailMessageIds(storedMessages).map(externalId => trashMessage(connection, externalId).catch(trashError => debugLog(`trash failed for ${externalId}: ${(trashError as Error).message}`))));
        }
      }
      const threadId = inboxThreadId(thread);
      if (thread.folder === InboxThreadFolder.DELETED) {
        await permanentlyDeleteThread(threadId);
        res.json({ request: { messageType }, response: { deletedCount: 1 } });
      }
      else {
        await recordThreadDeletion(thread, storedMessages, threadId);
        res.json({ request: { messageType }, response: { deletedCount: 1 } });
      }
    }
  }
  catch (error) {
    errorDebugLog("Error deleting inbox thread:", (error as Error).message);
    res.status(500).json({ request: { messageType }, error: errorResponse(error) });
  }
}
export async function restoreInboxThread(req: Request, res: Response): Promise<void> {
  try {
    const thread = await accessibleThread(req, res, req.params.id);
    if (thread) {
      const restored = thread.folder === InboxThreadFolder.DELETED;
      if (restored) {
        await restoreDeletedThread(inboxThreadId(thread));
      }
      res.json({ request: { messageType }, response: { restored, roleType: thread.roleType } });
    }
  }
  catch (error) {
    errorDebugLog("Error restoring inbox thread:", (error as Error).message);
    res.status(500).json({ request: { messageType }, error: errorResponse(error) });
  }
}
export async function moveThreadToInbox(req: Request, res: Response): Promise<void> {
  try {
    if (requireInboxConfigurationAdministrator(req, res)) {
      const thread = await accessibleThread(req, res, req.params.id);
      if (thread) {
        if (thread.folder === InboxThreadFolder.DELETED) {
          await restoreDeletedThread(inboxThreadId(thread));
          res.json({ request: { messageType }, response: { moved: true, roleType: thread.roleType } });
        }
        else if (thread.folder !== InboxThreadFolder.JUNK) {
          res.json({ request: { messageType }, response: { moved: false, roleType: thread.roleType } });
        }
        else {
          const storedMessages = await inboxMessageModel.find({ threadId: inboxThreadId(thread) }).lean() as InboxMessage[];
          const connection = await resolveThreadConnection(thread, storedMessages);
          if (!connection) {
            res.status(404).json({ request: { messageType }, error: `No Gmail mailbox connection found for thread ${req.params.id}` });
          }
          else {
            await Promise.all(gmailMessageIds(storedMessages).map(externalId => removeSpamLabel(connection, externalId).catch(spamError => debugLog(`un-spam failed for ${externalId}: ${(spamError as Error).message}`))));
            const roleType = await resolveInboxRoleTypeForThread(connection, storedMessages, thread.roleType);
            await inboxThreadModel.updateOne({ _id: req.params.id, tenantSlug: defaultTenantSlug() }, { $set: { folder: InboxThreadFolder.INBOX, roleType, unread: true, readByMemberIds: [] } });
            res.json({ request: { messageType }, response: { moved: true, roleType } });
          }
        }
      }
    }
  }
  catch (error) {
    errorDebugLog("Error moving inbox thread to inbox:", (error as Error).message);
    res.status(500).json({ request: { messageType }, error: errorResponse(error) });
  }
}
async function updateThreadReadState(req: Request, res: Response, unread: boolean): Promise<void> {
  const thread = await accessibleThread(req, res, req.params.id);
  if (thread) {
    const threadId = inboxThreadId(thread);
    const storedMessages = await inboxMessageModel.find({ threadId }).lean() as InboxMessage[];
    const connection = await resolveThreadConnection(thread, storedMessages);
    if (!connection) {
      res.status(404).json({ request: { messageType }, error: `No Gmail mailbox connection found for thread ${req.params.id}` });
    }
    else {
      const inboundMessages = storedMessages.filter(message => message.direction === InboxMessageDirection.INBOUND
        && message.externalSource === InboxReaderProvider.GMAIL_API && Boolean(message.externalId));
      const defaultConnectionId = connectionId(connection);
      const idsByConnection = inboundMessages.reduce<Map<string, string[]>>((map, storedMessage) => {
        const cid = storedMessage.mailboxConnectionId ?? defaultConnectionId;
        const existing = map.get(cid) ?? [];
        existing.push(storedMessage.externalId!);
        map.set(cid, existing);
        return map;
      }, new Map());
      const memberId = requestingMemberId(req);
      const readStateUpdate = memberId
        ? (unread
          ? { $pull: { readByMemberIds: memberId }, $set: { unread: true } }
          : { $addToSet: { readByMemberIds: memberId }, $set: { unread: false } })
        : { $set: { unread } };
      await inboxThreadModel.updateOne({ _id: threadId }, readStateUpdate);
      const unreadCountForRole = await unreadConversationCountForRole(thread.roleType, memberId);
      broadcast(MessageType.INBOX_THREAD_UPDATED, { threadId, messageId: "", roleType: thread.roleType, unreadCountForRole } as InboxNewMessageEvent);
      res.json({ request: { messageType }, response: { marked: true } });
      Array.from(idsByConnection.entries()).reduce<Promise<void>>(async (acc, [cid, ids]) => {
        await acc;
        const targetConnection = cid === defaultConnectionId
          ? connection
          : (await inboxMailboxConnectionModel.findOne({ _id: cid, tenantSlug: defaultTenantSlug() }).lean() as InboxMailboxConnection | null) ?? connection;
        try {
          await (unread ? markMessagesUnread(targetConnection, ids) : markMessagesRead(targetConnection, ids));
        }
        catch (markError) {
          errorDebugLog(`background mark-${unread ? "unread" : "read"} failed:`, (markError as Error).message);
        }
      }, Promise.resolve());
    }
  }
}
function gmailMessageIds(messages: InboxMessage[]): string[] {
  return messages.map(message => message.externalId).filter((externalId): externalId is string => Boolean(externalId));
}
async function resolveInboxRoleTypeForThread(connection: InboxMailboxConnection, messages: InboxMessage[], currentRoleType: string): Promise<string> {
  const realAliases = (await derivedAliases()).filter(alias => !isInboxGeneralRoleType(alias.roleType) && alias.mailboxConnectionId === connectionId(connection));
  const identityEmailsByType = await roleIdentityEmailsByType();
  const messageEmails = messages.flatMap(messageAddressEmails);
  const mailboxEmails = connection.gmailAccountEmail ? [connection.gmailAccountEmail] : [];
  const matched = realAliases.find(alias => roleMatchesMessageAddresses(alias.roleType, alias.roleEmail, messageEmails, identityEmailsByType, mailboxEmails));
  return matched ? matched.roleType : currentRoleType;
}
