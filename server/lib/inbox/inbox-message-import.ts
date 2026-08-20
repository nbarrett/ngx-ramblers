import { randomUUID } from "crypto";
import debug from "debug";
import { keys } from "es-toolkit/compat";
import { envConfig } from "../env-config/env-config";
import {
  InboxAddress,
  InboxAliasConfig,
  InboxMessage,
  InboxMessageDirection,
  InboxNewMessageEvent,
  InboxThread,
  InboxThreadFolder,
  isInboxGeneralRoleType
} from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { emailDomain, normaliseEmail } from "../../../projects/ngx-ramblers/src/app/functions/strings";
import { MessageType } from "../../../projects/ngx-ramblers/src/app/models/websocket.model";
import { inboxThread as inboxThreadModel } from "../mongo/models/inbox-thread";
import { inboxMessage as inboxMessageModel } from "../mongo/models/inbox-message";
import { broadcast } from "../websockets/websocket-broadcaster";
import { unreadConversationCountForRole } from "./inbox-unread-counts";
import { dateTimeFromMillis, dateTimeNow } from "../shared/dates";
import { pluraliseWithCount } from "../shared/string-utils";
import { sendInboxPushToMember } from "./inbox-web-push";
import { derivedAliasForEmail } from "./inbox-aliases";
import * as config from "../mongo/controllers/config";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { CommitteeConfig } from "../../../projects/ngx-ramblers/src/app/models/committee.model";

const debugLog = debug(envConfig.logNamespace("inbox-message-import"));
debugLog.enabled = true;

const SUBJECT_LINK_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

function isReplyMessage(message: InboxMessage): boolean {
  return Boolean(message.inReplyTo) || (message.references?.length ?? 0) > 0 || /^\s*(re|fwd?|aw)\s*:/i.test(message.subject ?? "");
}

async function conversationKeyBySubject(tenantSlug: string, message: InboxMessage, seenAt: number): Promise<string | null> {
  if (message.conversationKey) {
    return message.conversationKey;
  }
  if (!isReplyMessage(message)) {
    return null;
  }
  const normalisedSubject = normaliseSubject(message.subject);
  if (!normalisedSubject) {
    return null;
  }
  const candidates = await inboxThreadModel.find({
    tenantSlug,
    folder: {$ne: InboxThreadFolder.JUNK},
    normalisedSubject,
    lastSeenAt: {$gte: seenAt - SUBJECT_LINK_WINDOW_MS}
  }).lean() as unknown as InboxThread[];
  if (candidates.length === 0) {
    return null;
  }
  const existingKey = candidates.map(candidate => candidate.conversationKey).find(Boolean);
  const conversationKey = existingKey ?? `subject:${randomUUID()}`;
  const idsToStamp = candidates
    .filter(candidate => candidate.conversationKey !== conversationKey)
    .map(candidate => (candidate as unknown as {_id: unknown})._id);
  if (idsToStamp.length > 0) {
    await inboxThreadModel.updateMany({_id: {$in: idsToStamp}}, {$set: {conversationKey}});
  }
  return conversationKey;
}

export function replyAddress(message: InboxMessage): InboxAddress {
  return message.direction === InboxMessageDirection.INBOUND && message.replyTo?.email ? message.replyTo : message.from;
}

const AUTO_REPLY_SUBJECT_PATTERN = /^\s*(automatic reply|auto[- ]?reply|auto[- ]?response|out of (the )?office)\b/i;
const AUTO_REPLY_PRECEDENCE = ["auto_reply", "auto-reply"];

export function autoReplyFromHeaders(headerValue: (name: string) => string | null | undefined, subject: string): boolean {
  const autoSubmitted = (headerValue("auto-submitted") ?? "").trim().toLowerCase();
  const precedence = (headerValue("precedence") ?? "").trim().toLowerCase();
  return (autoSubmitted.length > 0 && autoSubmitted !== "no")
    || AUTO_REPLY_PRECEDENCE.includes(precedence)
    || Boolean(headerValue("x-autoreply"))
    || Boolean(headerValue("x-autorespond"))
    || AUTO_REPLY_SUBJECT_PATTERN.test(subject ?? "");
}

export function isAutoReplyMessage(message: InboxMessage): boolean {
  return message.autoReply ?? AUTO_REPLY_SUBJECT_PATTERN.test(message.subject ?? "");
}

export function statedReplyAddress(message: InboxMessage): InboxAddress | null {
  return message.direction === InboxMessageDirection.INBOUND && message.replyTo?.email ? message.replyTo : null;
}

export async function correctThreadExternalAddress(threadId: string, sender: InboxAddress, internalEmails?: Set<string>): Promise<InboxAddress | null> {
  const thread = threadId ? await inboxThreadModel.findById(threadId).lean() as unknown as InboxThread | null : null;
  const currentExternal = thread?.externalAddress?.email ? normaliseEmail(thread.externalAddress.email) : null;
  const senderEmail = sender?.email ? normaliseEmail(sender.email) : null;
  const correctable = Boolean(internalEmails && senderEmail && !internalEmails.has(senderEmail) && currentExternal !== senderEmail);
  if (correctable) {
    await inboxThreadModel.updateOne({_id: threadId}, {$set: {externalAddress: sender}});
    debugLog(`externalAddress moved on thread ${threadId}: ${currentExternal} -> ${senderEmail}`);
  }
  return correctable ? sender : null;
}

export async function backfillStatedReplyAddress(message: InboxMessage, internalEmails?: Set<string>): Promise<number> {
  const stated = statedReplyAddress(message);
  const storedWithoutReplyTo = stated
    ? await inboxMessageModel.find({
      messageId: message.messageId,
      direction: InboxMessageDirection.INBOUND,
      "replyTo.email": {$exists: false}
    }).lean() as unknown as InboxMessage[]
    : [];
  await storedWithoutReplyTo.reduce<Promise<void>>(async (previous, storedMessage) => {
    await previous;
    await inboxMessageModel.updateOne({_id: storedMessage["_id"]}, {$set: {replyTo: stated}});
    await correctThreadExternalAddress(storedMessage.threadId, stated, internalEmails);
  }, Promise.resolve());
  if (storedWithoutReplyTo.length > 0) {
    debugLog(`stored Reply-To ${stated.email} on ${pluraliseWithCount(storedWithoutReplyTo.length, "existing copy", "existing copies")} of message ${message.messageId}`);
  }
  return storedWithoutReplyTo.length;
}

function domainsFromEmails(internalEmails: Set<string>): Set<string> {
  return new Set(Array.from(internalEmails).map(emailDomain).filter(Boolean));
}

function addressIsInternal(address: InboxAddress | null | undefined, internalEmails: Set<string>, internalDomains: Set<string>): boolean {
  const email = address?.email ? normaliseEmail(address.email) : "";
  const domain = email ? emailDomain(email) : "";
  return Boolean(email) && (internalEmails.has(email) || (Boolean(domain) && internalDomains.has(domain)));
}

export function isOwnSentCopy(message: InboxMessage, internalEmails?: Set<string>): boolean {
  const emails = internalEmails ?? new Set<string>();
  const domains = domainsFromEmails(emails);
  const recipients = [...(message.to ?? []), ...(message.cc ?? [])];
  return emails.size > 0
    && !isAutoReplyMessage(message)
    && addressIsInternal(message.from, emails, domains)
    && recipients.some(address => address?.email && !addressIsInternal(address, emails, domains));
}

export function outboundCopyFromInbound(message: InboxMessage, internalEmails?: Set<string>): InboxMessage {
  const emails = internalEmails ?? new Set<string>();
  const domains = domainsFromEmails(emails);
  const keepExternal = (address: InboxAddress) => Boolean(address?.email) && !addressIsInternal(address, emails, domains);
  const to = (message.to ?? []).filter(keepExternal);
  const cc = (message.cc ?? []).filter(keepExternal);
  return {
    ...message,
    direction: InboxMessageDirection.OUTBOUND,
    to: to.length > 0 ? to : (message.to ?? []),
    cc,
    sentAt: message.sentAt ?? message.receivedAt,
    receivedAt: null
  };
}

export async function reclassifyOwnSentInboundMessages(internalEmails: Set<string>): Promise<number> {
  const candidates = internalEmails.size === 0
    ? []
    : await inboxMessageModel.find({
      direction: InboxMessageDirection.INBOUND,
      "from.email": {$in: Array.from(internalEmails)}
    }).select("_id threadId direction from to cc sentAt receivedAt subject autoReply").lean() as unknown as (InboxMessage & {_id: unknown})[];
  const ownSends = candidates.filter(candidate => isOwnSentCopy(candidate, internalEmails));
  await ownSends.reduce<Promise<void>>(async (previous, storedMessage) => {
    await previous;
    const outbound = outboundCopyFromInbound(storedMessage, internalEmails);
    await inboxMessageModel.updateOne({_id: storedMessage._id}, {
      $set: {
        direction: InboxMessageDirection.OUTBOUND,
        to: outbound.to,
        cc: outbound.cc,
        sentAt: outbound.sentAt,
        receivedAt: null
      }
    });
  }, Promise.resolve());
  const threadIds = Array.from(new Set(ownSends.map(storedMessage => storedMessage.threadId).filter(Boolean)));
  await threadIds.reduce<Promise<void>>(async (previous, threadId) => {
    await previous;
    await refreshThreadAfterOwnSentReclassify(threadId, internalEmails);
  }, Promise.resolve());
  if (ownSends.length > 0) {
    debugLog(`reclassified ${pluraliseWithCount(ownSends.length, "own-sent inbox copy")} as outbound`);
  }
  const backfilled = await backfillMissingSentFrom();
  return ownSends.length + backfilled;
}

async function backfillMissingSentFrom(): Promise<number> {
  const threads = await inboxThreadModel.find({
    lastDirection: InboxMessageDirection.OUTBOUND,
    $or: [
      {sentFrom: {$exists: false}},
      {sentFrom: null},
      {"sentFrom.email": {$in: [null, ""]}}
    ]
  }).select("_id roleType").lean() as {_id: {toString(): string}; roleType: string}[];
  const progress = {count: 0};
  await threads.reduce<Promise<void>>(async (previous, thread) => {
    await previous;
    const latestOutbound = await inboxMessageModel.findOne({
      threadId: thread._id.toString(),
      direction: InboxMessageDirection.OUTBOUND
    }).select("from").sort({sentAt: -1, receivedAt: -1}).lean() as InboxMessage | null;
    const sentFrom = latestOutbound?.from?.email ? latestOutbound.from : null;
    if (sentFrom) {
      const senderAlias = await derivedAliasForEmail(sentFrom.email);
      const senderRoleType = senderAlias && !isInboxGeneralRoleType(senderAlias.roleType) ? senderAlias.roleType : null;
      const updates: Record<string, unknown> = {
        sentFrom,
        ...(senderRoleType && senderRoleType !== thread.roleType ? {roleType: senderRoleType} : {})
      };
      await inboxThreadModel.updateOne({_id: thread._id}, {$set: updates});
      progress.count += 1;
    }
  }, Promise.resolve());
  if (threads.length > 0) {
    debugLog(`backfilled sentFrom on ${pluraliseWithCount(progress.count, "outbound thread")} (${threads.length} missing)`);
  }
  return progress.count;
}

async function refreshThreadAfterOwnSentReclassify(threadId: string, internalEmails: Set<string>): Promise<void> {
  const messages = await inboxMessageModel.find({threadId}).lean() as unknown as InboxMessage[];
  const latest = messages.reduce<InboxMessage | null>((current, candidate) => {
    const currentAt = current?.receivedAt ?? current?.sentAt ?? -1;
    const candidateAt = candidate.receivedAt ?? candidate.sentAt ?? -1;
    return candidateAt >= currentAt ? candidate : current;
  }, null);
  if (latest) {
    const lastDirection = latest.direction;
    const thread = await inboxThreadModel.findById(threadId).lean() as unknown as InboxThread | null;
    const externalAddress = resolveThreadExternalAddress(latest, thread?.externalAddress, internalEmails);
    const sentFrom = lastDirection === InboxMessageDirection.OUTBOUND && latest.from?.email ? latest.from : null;
    const senderAlias = sentFrom ? await derivedAliasForEmail(sentFrom.email) : null;
    const senderRoleType = senderAlias && !isInboxGeneralRoleType(senderAlias.roleType) ? senderAlias.roleType : null;
    await inboxThreadModel.updateOne({_id: threadId}, {
      $set: {
        lastDirection,
        unread: thread?.folder !== InboxThreadFolder.JUNK && lastDirection === InboxMessageDirection.INBOUND,
        externalAddress,
        sentFrom,
        ...(senderRoleType ? {roleType: senderRoleType} : {})
      }
    });
  }
}

export function resolveThreadExternalAddress(message: InboxMessage, counterparty?: InboxAddress, internalEmails?: Set<string>): InboxAddress {
  const isInternal = (address?: InboxAddress | null) =>
    Boolean(address?.email && internalEmails?.has(normaliseEmail(address.email)));
  const sender = replyAddress(message);
  const recipients = [...(message.to ?? []), ...(message.cc ?? [])].filter(address => address?.email);
  const preferred = message.direction === InboxMessageDirection.OUTBOUND
    ? [
      counterparty,
      recipients.find(address => !isInternal(address)),
      recipients[0],
      sender
    ].find(address => address?.email)
    : [
      counterparty,
      isInternal(sender) ? null : sender,
      recipients.find(address => !isInternal(address)),
      recipients[0],
      sender
    ].find(address => address?.email);
  return preferred?.email ? {name: preferred.name ?? null, email: preferred.email} : {name: null, email: "unknown@local"};
}

export function shouldRefreshUnreadForInbound(isJunk: boolean, messageAt: number, previousLastSeenAt: number | null | undefined): boolean {
  if (isJunk) {
    return false;
  }
  if (previousLastSeenAt == null) {
    return true;
  }
  return messageAt > previousLastSeenAt;
}

async function aliasForOwnSentCopy(fallback: InboxAliasConfig, message: InboxMessage): Promise<InboxAliasConfig> {
  const senderAlias = await derivedAliasForEmail(message.from?.email ?? "");
  return senderAlias && !isInboxGeneralRoleType(senderAlias.roleType) ? senderAlias : fallback;
}

export async function storeInboundMessage(aliasConfig: InboxAliasConfig, message: InboxMessage, folder: InboxThreadFolder = InboxThreadFolder.INBOX, internalEmails?: Set<string>): Promise<InboxMessage> {
  const outbound = folder !== InboxThreadFolder.JUNK && isOwnSentCopy(message, internalEmails)
    ? outboundCopyFromInbound(message, internalEmails)
    : null;
  const storedOutbound = outbound
    ? await recordOutboundMessage(await aliasForOwnSentCopy(aliasConfig, outbound), outbound, internalEmails)
    : null;
  return outbound ? (storedOutbound ?? outbound) : storeReceivedInboundMessage(aliasConfig, message, folder, internalEmails);
}

async function storeReceivedInboundMessage(aliasConfig: InboxAliasConfig, message: InboxMessage, folder: InboxThreadFolder, internalEmails?: Set<string>): Promise<InboxMessage> {
  const isJunk = folder === InboxThreadFolder.JUNK;
  const now = dateTimeNow().toMillis();
  const messageAt = message.receivedAt ?? message.sentAt ?? now;
  if (!isJunk) {
    const resolvedKey = await conversationKeyBySubject(aliasConfig.tenantSlug, message, messageAt);
    if (resolvedKey) {
      message.conversationKey = resolvedKey;
    }
  }
  const externalAddress = resolveThreadExternalAddress(message, undefined, internalEmails);
  const existingThread = await findExistingThread(aliasConfig, message, folder, externalAddress);
  const thread = existingThread ?? await createThread(aliasConfig, message, messageAt, folder, externalAddress, InboxMessageDirection.INBOUND, internalEmails);
  const threadId = thread.id ?? thread["_id"]?.toString() ?? "";
  if (existingThread && !isAutoReplyMessage(message)) {
    const corrected = await correctThreadExternalAddress(threadId, replyAddress(message), internalEmails);
    if (corrected) {
      thread.externalAddress = corrected;
    }
  }
  await backfillStatedReplyAddress(message, internalEmails);
  const alreadyStored = await inboxMessageModel.findOne({threadId, messageId: message.messageId}).lean();
  if (alreadyStored) {
    await inboxThreadModel.updateOne({_id: thread.id ?? thread["_id"]}, {
      $addToSet: {messageIds: message.messageId},
      ...(message.conversationKey ? {$set: {conversationKey: message.conversationKey}} : {})
    });
    debugLog(`↩︎ message ${message.messageId} already stored on thread ${threadId}; preserving read state`);
    return alreadyStored as unknown as InboxMessage;
  }
  const previousLastSeenAt = existingThread?.lastSeenAt ?? null;
  const refreshUnread = shouldRefreshUnreadForInbound(isJunk, messageAt, previousLastSeenAt);
  const persistedMessage = await inboxMessageModel.create({...message, threadId, mailboxConnectionId: aliasConfig.mailboxConnectionId});
  const threadSet: Record<string, unknown> = {};
  if (refreshUnread) {
    threadSet.lastDirection = InboxMessageDirection.INBOUND;
    threadSet.unread = true;
    threadSet.readByMemberIds = [];
  } else if (isJunk) {
    threadSet.lastDirection = InboxMessageDirection.INBOUND;
  }
  if (message.conversationKey) {
    threadSet.conversationKey = message.conversationKey;
  }
  await inboxThreadModel.updateOne({_id: thread.id ?? thread["_id"]}, {
    ...(keys(threadSet).length > 0 ? {$set: threadSet} : {}),
    $max: {lastSeenAt: messageAt},
    $min: {firstSeenAt: messageAt},
    $addToSet: {messageIds: message.messageId}
  });
  if (isJunk) {
    debugLog(`✅ stored junk message ${message.messageId} on thread ${persistedMessage.threadId}`);
    return persistedMessage.toObject();
  }
  if (!refreshUnread) {
    debugLog(`✅ stored older inbound message ${message.messageId} on thread ${persistedMessage.threadId} without changing read state`);
    return persistedMessage.toObject();
  }
  const unreadCountForRole = await unreadConversationCountForRole(aliasConfig.roleType, null);
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

export async function recordOutboundMessage(aliasConfig: InboxAliasConfig, outboundMessage: InboxMessage, internalEmails?: Set<string>): Promise<InboxMessage | null> {
  const recipients = [...(outboundMessage.to ?? []), ...(outboundMessage.cc ?? [])].filter(recipient => recipient?.email);
  if (!recipients.length) {
    debugLog("recordOutboundMessage: no recipient address on message", outboundMessage.messageId, "- skipping");
    return null;
  }
  const counterparty = resolveThreadExternalAddress(outboundMessage, undefined, internalEmails);
  const existingThread = await findExistingThread(aliasConfig, outboundMessage, InboxThreadFolder.INBOX, counterparty);
  const now = dateTimeNow().toMillis();
  const thread = existingThread ?? await createThread(aliasConfig, outboundMessage, outboundMessage.sentAt ?? now, InboxThreadFolder.INBOX, counterparty, InboxMessageDirection.OUTBOUND, internalEmails);
  const threadId = thread.id ?? thread["_id"]?.toString() ?? "";
  return recordOutboundReply(aliasConfig, outboundMessage, threadId);
}

export async function recordOutboundReply(aliasConfig: InboxAliasConfig, replyMessage: InboxMessage, originalThreadId: string): Promise<InboxMessage> {
  const now = dateTimeNow().toMillis();
  const messageAt = replyMessage.sentAt ?? now;
  const persistedMessage = await persistOutboundOnThread(aliasConfig, replyMessage, originalThreadId);
  await inboxThreadModel.updateOne({_id: originalThreadId}, {
    $addToSet: {messageIds: replyMessage.messageId}
  });
  await inboxThreadModel.updateOne({_id: originalThreadId, lastSeenAt: {$lte: messageAt}}, {
    $set: {
      lastSeenAt: messageAt,
      lastDirection: InboxMessageDirection.OUTBOUND,
      unread: false,
      sentFrom: replyMessage.from?.email ? replyMessage.from : null
    }
  });
  const unreadCountForRole = await unreadConversationCountForRole(aliasConfig.roleType, null);
  broadcast(MessageType.INBOX_THREAD_UPDATED, {
    threadId: originalThreadId,
    messageId: replyMessage.messageId,
    roleType: aliasConfig.roleType,
    unreadCountForRole
  });
  debugLog(`✅ recorded outbound reply ${replyMessage.messageId} on thread ${originalThreadId}`);
  return persistedMessage;
}

async function persistOutboundOnThread(aliasConfig: InboxAliasConfig, replyMessage: InboxMessage, originalThreadId: string): Promise<InboxMessage> {
  const existing = await inboxMessageModel.findOne({
    threadId: originalThreadId,
    messageId: replyMessage.messageId
  }).lean() as unknown as (InboxMessage & {_id: unknown}) | null;
  if (existing && existing.direction === InboxMessageDirection.OUTBOUND) {
    return existing;
  } else if (existing) {
    const sentAt = replyMessage.sentAt ?? existing.sentAt ?? existing.receivedAt;
    await inboxMessageModel.updateOne({_id: existing._id}, {
      $set: {
        direction: InboxMessageDirection.OUTBOUND,
        to: replyMessage.to,
        cc: replyMessage.cc,
        sentAt,
        receivedAt: null
      }
    });
    return {...existing, direction: InboxMessageDirection.OUTBOUND, to: replyMessage.to, cc: replyMessage.cc, sentAt, receivedAt: null};
  } else {
    const created = await inboxMessageModel.create({
      ...replyMessage,
      threadId: originalThreadId,
      mailboxConnectionId: replyMessage.mailboxConnectionId ?? aliasConfig.mailboxConnectionId
    });
    return created.toObject();
  }
}

async function findExistingThread(aliasConfig: InboxAliasConfig, message: InboxMessage, folder: InboxThreadFolder, counterparty?: InboxAddress): Promise<InboxThread | null> {
  const folderFilter = folder === InboxThreadFolder.JUNK
    ? {folder: InboxThreadFolder.JUNK}
    : {folder: {$ne: InboxThreadFolder.JUNK}};
  if (message.conversationKey) {
    const threadByKey = await inboxThreadModel.findOne({
      tenantSlug: aliasConfig.tenantSlug,
      roleType: aliasConfig.roleType,
      ...folderFilter,
      conversationKey: message.conversationKey
    });
    if (threadByKey) {
      debugLog(`findExistingThread: matched by conversationKey=${message.conversationKey} thread=${threadByKey._id} externalAddress=${JSON.stringify(threadByKey.externalAddress)}`);
      return threadByKey.toObject();
    }
  }
  const messageIdsToTry = [message.inReplyTo, ...message.references].filter((value): value is string => Boolean(value));
  if (messageIdsToTry.length > 0) {
    const threadByReference = await inboxThreadModel.findOne({
      tenantSlug: aliasConfig.tenantSlug,
      roleType: aliasConfig.roleType,
      ...folderFilter,
      messageIds: {$in: messageIdsToTry}
    });
    if (threadByReference) {
      debugLog(`findExistingThread: matched by messageIds=${JSON.stringify(messageIdsToTry)} thread=${threadByReference._id} externalAddress=${JSON.stringify(threadByReference.externalAddress)}`);
      return threadByReference.toObject();
    }
  }
  const normalisedSubject = normaliseSubject(message.subject);
  const searchAddress = (counterparty ?? message.from)?.email;
  if (!searchAddress) {
    debugLog(`findExistingThread: no address to search for message=${message.messageId} from=${JSON.stringify(message.from)} counterparty=${JSON.stringify(counterparty)}`);
    return null;
  }
  const threadByAddress = await inboxThreadModel.findOne({
    tenantSlug: aliasConfig.tenantSlug,
    roleType: aliasConfig.roleType,
    ...folderFilter,
    "externalAddress.email": searchAddress,
    normalisedSubject
  });
  if (threadByAddress) {
    debugLog(`findExistingThread: matched by address=${searchAddress}+subject="${normalisedSubject}" thread=${threadByAddress._id} externalAddress=${JSON.stringify(threadByAddress.externalAddress)}`);
  } else {
    debugLog(`findExistingThread: no match for message=${message.messageId} from=${JSON.stringify(message.from)} counterparty=${JSON.stringify(counterparty)} subject="${message.subject}" normalisedSubject="${normalisedSubject}"`);
  }
  return threadByAddress ? threadByAddress.toObject() : null;
}

async function createThread(aliasConfig: InboxAliasConfig, message: InboxMessage, seenAt: number, folder: InboxThreadFolder, counterparty?: InboxAddress, lastDirection: InboxMessageDirection = InboxMessageDirection.INBOUND, internalEmails?: Set<string>): Promise<InboxThread> {
  const externalAddress = resolveThreadExternalAddress(message, counterparty, internalEmails);
  const created = await inboxThreadModel.create({
    tenantSlug: aliasConfig.tenantSlug,
    roleType: aliasConfig.roleType,
    externalAddress,
    subject: (message.subject ?? "").trim(),
    normalisedSubject: normaliseSubject(message.subject),
    folder,
    messageIds: [message.messageId],
    conversationKey: message.conversationKey ?? null,
    firstSeenAt: seenAt,
    lastSeenAt: seenAt,
    lastDirection,
    sentFrom: lastDirection === InboxMessageDirection.OUTBOUND && message.from?.email ? message.from : null,
    unread: folder !== InboxThreadFolder.JUNK && lastDirection === InboxMessageDirection.INBOUND
  });
  debugLog(`createThread: created thread ${created._id} with externalAddress=${JSON.stringify(externalAddress)} from=${JSON.stringify(message.from)} to=${JSON.stringify(message.to)} subject="${message.subject}" counterparty=${JSON.stringify(counterparty)}`);
  return created.toObject();
}

export function normaliseSubject(raw: string): string {
  if (!raw) {
    return "";
  }
  return raw.replace(/^(?:re|fwd?|aw)\s*:\s*/gi, "").trim().toLowerCase();
}

export function buildReplyHeaders(originalMessage: InboxMessage, forward = false): { inReplyTo: string; references: string[]; subject: string } {
  const prefix = forward ? "Fwd" : "Re";
  const normalisedBase = normaliseSubject(originalMessage.subject);
  const subject = normalisedBase.length > 0 ? `${prefix}: ${originalMessage.subject.replace(/^(?:re|fwd?|aw)\s*:\s*/gi, "").trim()}` : `${prefix}:`;
  const references = [...originalMessage.references, originalMessage.messageId].filter((value): value is string => Boolean(value));
  return {inReplyTo: originalMessage.messageId, references, subject};
}

export function buildQuotedReplyHtml(originalMessage: InboxMessage): string {
  const dateLabel = originalMessage.receivedAt ? dateTimeFromMillis(originalMessage.receivedAt).toUTC().toRFC2822() : "";
  const senderLabel = originalMessage.from.name
    ? `${originalMessage.from.name} &lt;${originalMessage.from.email}&gt;`
    : originalMessage.from.email;
  return `<p></p><blockquote style="border-left: 2px solid #ccc; padding-left: 1em; color: #555;"><p>On ${dateLabel}, ${senderLabel} wrote:</p>${quotedBodyHtml(originalMessage)}</blockquote>`;
}

export function buildQuotedForwardHtml(originalMessage: InboxMessage): string {
  const dateLabel = originalMessage.receivedAt ? dateTimeFromMillis(originalMessage.receivedAt).toUTC().toRFC2822() : "";
  const headerLines = [
    `From: ${escapeHtml(addressLabel(originalMessage.from))}`,
    dateLabel ? `Date: ${dateLabel}` : null,
    `Subject: ${escapeHtml(originalMessage.subject ?? "")}`,
    originalMessage.to?.length ? `To: ${originalMessage.to.map(address => escapeHtml(addressLabel(address))).join(", ")}` : null
  ].filter((line): line is string => Boolean(line));
  return `<p></p><p>---------- Forwarded message ---------</p><p>${headerLines.join("<br/>")}</p>${quotedBodyHtml(originalMessage)}`;
}

function addressLabel(address: InboxAddress): string {
  return address.name ? `${address.name} <${address.email}>` : address.email;
}

function quotedBodyHtml(originalMessage: InboxMessage): string {
  return originalMessage.bodyHtml ?? (originalMessage.bodyText ? `<pre>${escapeHtml(originalMessage.bodyText)}</pre>` : "");
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
