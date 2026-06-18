import debug from "debug";
import { envConfig } from "../env-config/env-config";
import {
  InboxAliasConfig,
  InboxMessage,
  InboxMessageDirection,
  InboxNewMessageEvent,
  InboxThread,
  InboxThreadFolder
} from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { MessageType } from "../../../projects/ngx-ramblers/src/app/models/websocket.model";
import { inboxThread as inboxThreadModel } from "../mongo/models/inbox-thread";
import { inboxMessage as inboxMessageModel } from "../mongo/models/inbox-message";
import { broadcast } from "../websockets/websocket-broadcaster";
import { dateTimeFromMillis, dateTimeNow } from "../shared/dates";
import { sendInboxPushToMember } from "./inbox-web-push";
import * as config from "../mongo/controllers/config";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { CommitteeConfig } from "../../../projects/ngx-ramblers/src/app/models/committee.model";

const debugLog = debug(envConfig.logNamespace("inbox-message-import"));
debugLog.enabled = true;

export async function storeInboundMessage(aliasConfig: InboxAliasConfig, message: InboxMessage, folder: InboxThreadFolder = InboxThreadFolder.INBOX): Promise<InboxMessage> {
  const isJunk = folder === InboxThreadFolder.JUNK;
  const existingThread = await findExistingThread(aliasConfig, message, folder);
  const now = dateTimeNow().toMillis();
  const thread = existingThread ?? await createThread(aliasConfig, message, now, folder);
  const threadId = thread.id ?? thread["_id"]?.toString() ?? "";
  const alreadyStored = await inboxMessageModel.findOne({threadId, messageId: message.messageId}).lean();
  if (alreadyStored) {
    debugLog(`↩︎ message ${message.messageId} already stored on thread ${threadId}; skipping duplicate`);
    return alreadyStored as unknown as InboxMessage;
  }
  const persistedMessage = await inboxMessageModel.create({...message, threadId, mailboxConnectionId: aliasConfig.mailboxConnectionId});
  await inboxThreadModel.updateOne({_id: thread.id ?? thread["_id"]}, {
    $set: {
      lastSeenAt: now,
      lastDirection: InboxMessageDirection.INBOUND,
      unread: !isJunk,
      ...(isJunk ? {} : {readByMemberIds: []})
    },
    $addToSet: {messageIds: message.messageId}
  });
  if (isJunk) {
    debugLog(`✅ stored junk message ${message.messageId} on thread ${persistedMessage.threadId}`);
    return persistedMessage.toObject();
  }
  const unreadCountForRole = await inboxThreadModel.countDocuments({
    tenantSlug: aliasConfig.tenantSlug,
    roleType: aliasConfig.roleType,
    unread: true
  });
  const event: InboxNewMessageEvent = {
    threadId: persistedMessage.threadId,
    messageId: message.messageId,
    roleType: aliasConfig.roleType,
    unreadCountForRole
  };
  broadcast(MessageType.INBOX_NEW_MESSAGE, event);
  notifyAssignedRoleMembers(aliasConfig, message)
    .catch(notifyError => debugLog(`inbox push notify failed: ${(notifyError as Error).message}`));
  debugLog(`✅ stored inbound message ${message.messageId} on thread ${persistedMessage.threadId}`);
  return persistedMessage.toObject();
}

async function notifyAssignedRoleMembers(aliasConfig: InboxAliasConfig, message: InboxMessage): Promise<void> {
  const committeeConfigDocument = await config.queryKey(ConfigKey.COMMITTEE);
  const committeeConfig: CommitteeConfig = committeeConfigDocument?.value;
  const assigneeIds = (committeeConfig?.roles ?? [])
    .filter(role => role.type === aliasConfig.roleType && Boolean(role.memberId))
    .map(role => role.memberId as string);
  if (assigneeIds.length === 0) {
    return;
  }
  const senderLabel = message.from.name || message.from.email || "Someone";
  const subjectLabel = message.subject?.trim() ? message.subject.trim() : "(no subject)";
  await Promise.all(assigneeIds.map(memberId => sendInboxPushToMember(memberId, {
    title: `${senderLabel} → ${aliasConfig.roleType}`,
    body: subjectLabel,
    threadId: message.threadId,
    roleType: aliasConfig.roleType
  }).catch(memberError => debugLog(`push to ${memberId} failed: ${(memberError as Error).message}`))));
}

export async function recordOutboundReply(aliasConfig: InboxAliasConfig, replyMessage: InboxMessage, originalThreadId: string): Promise<InboxMessage> {
  const now = dateTimeNow().toMillis();
  const persistedMessage = await inboxMessageModel.create({...replyMessage, threadId: originalThreadId, mailboxConnectionId: replyMessage.mailboxConnectionId ?? aliasConfig.mailboxConnectionId});
  await inboxThreadModel.updateOne({_id: originalThreadId}, {
    $set: {
      lastSeenAt: now,
      lastDirection: InboxMessageDirection.OUTBOUND,
      unread: false
    },
    $addToSet: {messageIds: replyMessage.messageId}
  });
  const unreadCountForRole = await inboxThreadModel.countDocuments({
    tenantSlug: aliasConfig.tenantSlug,
    roleType: aliasConfig.roleType,
    unread: true
  });
  broadcast(MessageType.INBOX_THREAD_UPDATED, {
    threadId: originalThreadId,
    messageId: replyMessage.messageId,
    roleType: aliasConfig.roleType,
    unreadCountForRole
  });
  debugLog(`✅ recorded outbound reply ${replyMessage.messageId} on thread ${originalThreadId}`);
  return persistedMessage.toObject();
}

async function findExistingThread(aliasConfig: InboxAliasConfig, message: InboxMessage, folder: InboxThreadFolder): Promise<InboxThread | null> {
  const folderFilter = folder === InboxThreadFolder.JUNK
    ? {folder: InboxThreadFolder.JUNK}
    : {folder: {$ne: InboxThreadFolder.JUNK}};
  const messageIdsToTry = [message.inReplyTo, ...message.references].filter((value): value is string => Boolean(value));
  if (messageIdsToTry.length > 0) {
    const threadByReference = await inboxThreadModel.findOne({
      tenantSlug: aliasConfig.tenantSlug,
      roleType: aliasConfig.roleType,
      ...folderFilter,
      messageIds: {$in: messageIdsToTry}
    });
    if (threadByReference) {
      return threadByReference.toObject();
    }
  }
  const normalisedSubject = normaliseSubject(message.subject);
  const threadByAddress = await inboxThreadModel.findOne({
    tenantSlug: aliasConfig.tenantSlug,
    roleType: aliasConfig.roleType,
    ...folderFilter,
    "externalAddress.email": message.from.email,
    normalisedSubject
  });
  return threadByAddress ? threadByAddress.toObject() : null;
}

async function createThread(aliasConfig: InboxAliasConfig, message: InboxMessage, now: number, folder: InboxThreadFolder): Promise<InboxThread> {
  const created = await inboxThreadModel.create({
    tenantSlug: aliasConfig.tenantSlug,
    roleType: aliasConfig.roleType,
    externalAddress: message.from,
    subject: (message.subject ?? "").trim(),
    normalisedSubject: normaliseSubject(message.subject),
    folder,
    messageIds: [message.messageId],
    firstSeenAt: now,
    lastSeenAt: now,
    lastDirection: InboxMessageDirection.INBOUND,
    unread: folder !== InboxThreadFolder.JUNK
  });
  return created.toObject();
}

export function normaliseSubject(raw: string): string {
  if (!raw) {
    return "";
  }
  return raw.replace(/^(?:re|fwd?|aw)\s*:\s*/gi, "").trim().toLowerCase();
}

export function buildReplyHeaders(originalMessage: InboxMessage): { inReplyTo: string; references: string[]; subject: string } {
  const normalisedBase = normaliseSubject(originalMessage.subject);
  const subject = normalisedBase.length > 0 ? `Re: ${originalMessage.subject.replace(/^(?:re|fwd?|aw)\s*:\s*/gi, "").trim()}` : "Re:";
  const references = [...originalMessage.references, originalMessage.messageId].filter((value): value is string => Boolean(value));
  return {inReplyTo: originalMessage.messageId, references, subject};
}

export function buildQuotedReplyHtml(originalMessage: InboxMessage): string {
  const dateLabel = originalMessage.receivedAt ? dateTimeFromMillis(originalMessage.receivedAt).toUTC().toRFC2822() : "";
  const senderLabel = originalMessage.from.name
    ? `${originalMessage.from.name} &lt;${originalMessage.from.email}&gt;`
    : originalMessage.from.email;
  const quotedBody = originalMessage.bodyHtml ?? (originalMessage.bodyText ? `<pre>${escapeHtml(originalMessage.bodyText)}</pre>` : "");
  return `<p></p><blockquote style="border-left: 2px solid #ccc; padding-left: 1em; color: #555;"><p>On ${dateLabel}, ${senderLabel} wrote:</p>${quotedBody}</blockquote>`;
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
