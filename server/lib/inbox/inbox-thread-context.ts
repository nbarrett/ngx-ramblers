import { Request, Response } from "express";
import debug from "debug";
import { isString } from "es-toolkit/compat";
import { InboxAddress, InboxAliasConfig, InboxMailboxConnection, InboxMessage, InboxMessageDirection, InboxReaderProvider, InboxThread, InboxThreadFolder } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { envConfig } from "../env-config/env-config";
import { inboxThread as inboxThreadModel } from "../mongo/models/inbox-thread";
import { inboxMessage as inboxMessageModel } from "../mongo/models/inbox-message";
import { inboxMailboxConnection as inboxMailboxConnectionModel } from "../mongo/models/inbox-mailbox-connection";
import { defaultTenantSlug, connectionIdentifier as connectionId, derivedAliasForRoleType, internalEmailsForConnection } from "./inbox-aliases";
import { permittedInboxRoleTypes, permittedToReadJunk, requireInboxRoleAccess } from "./inbox-access";
import { inboxThreadByIdOrSlug } from "./inbox-thread-lookup";
import { isAutoReplyMessage, resolveThreadExternalAddress, statedReplyAddress } from "./inbox-message-import";
import { fetchFullMessage, fetchMessageReplyTo, findGmailMessageIdByRfcHeader } from "./gmail-inbox-reader";

const messageType = "inbox";
const debugLog = debug(envConfig.logNamespace("inbox-thread-context"));

export async function accessibleThread(req: Request, res: Response, threadId: string): Promise<InboxThread | null> {
  const allowedRoles = await permittedInboxRoleTypes(req);
  const junkAllowed = await permittedToReadJunk(req);
  const thread = await inboxThreadByIdOrSlug(defaultTenantSlug(), threadId, allowedRoles, junkAllowed, isString(req.query.roleType) ? req.query.roleType : null);
  if (!thread) {
    res.status(404).json({request: {messageType}, error: `Thread ${threadId} not found`});
    return null;
  } else if (thread.folder === InboxThreadFolder.JUNK) {
    if (junkAllowed) {
      return thread;
    } else {
      res.status(403).json({request: {messageType}, error: "You do not have access to junk mail"});
      return null;
    }
  } else {
    const accessible = await requireInboxRoleAccess(req, res, thread.roleType);
    return accessible ? thread : null;
  }
}

export async function resolveThreadConnection(thread: InboxThread, messages: InboxMessage[]): Promise<InboxMailboxConnection | null> {
  const alias = await aliasForThread(thread);
  const viaAlias = alias ? await connectionForAlias(alias) : null;
  if (viaAlias) {
    return viaAlias;
  } else {
    const messageConnectionId = messages.map(message => message.mailboxConnectionId).find(Boolean);
    return messageConnectionId
      ? inboxMailboxConnectionModel.findOne({_id: messageConnectionId, tenantSlug: defaultTenantSlug()}).lean() as Promise<InboxMailboxConnection | null>
      : null;
  }
}

export async function aliasForThread(thread: InboxThread): Promise<InboxAliasConfig | null> {
  return derivedAliasForRoleType(thread.roleType);
}

export async function connectionForAlias(alias: InboxAliasConfig): Promise<InboxMailboxConnection | null> {
  return alias.mailboxConnectionId
    ? inboxMailboxConnectionModel.findOne({_id: alias.mailboxConnectionId, tenantSlug: alias.tenantSlug}).lean() as Promise<InboxMailboxConnection | null>
    : null;
}

export async function connectionForMessage(message: InboxMessage, fallback: InboxMailboxConnection): Promise<InboxMailboxConnection> {
  if (!message.mailboxConnectionId || message.mailboxConnectionId === connectionId(fallback)) {
    return fallback;
  } else {
    const storedConnection = await inboxMailboxConnectionModel.findOne({_id: message.mailboxConnectionId, tenantSlug: defaultTenantSlug()}).lean() as InboxMailboxConnection | null;
    return storedConnection ?? fallback;
  }
}

export async function hydrateMessage(connection: InboxMailboxConnection, storedMessage: InboxMessage): Promise<InboxMessage> {
  const needsBody = storedMessage.externalSource === InboxReaderProvider.GMAIL_API && storedMessage.bodyHtml === null && storedMessage.bodyText === null;
  if (needsBody) {
    const externalId = storedMessage.externalId || (storedMessage.messageId ? await findGmailMessageIdByRfcHeader(connection, storedMessage.messageId).catch(lookupError => {
      debugLog(`hydrateMessage: lookup failed for ${storedMessage.messageId}: ${(lookupError as Error).message}`);
      return null;
    }) : null);
    if (externalId) {
      const fetchedMessage = await fetchFullMessage(connection, externalId);
      const hydratedMessage = {...storedMessage, externalId, bodyHtml: fetchedMessage.bodyHtml, bodyText: fetchedMessage.bodyText, attachments: fetchedMessage.attachments, deliveryRecipients: fetchedMessage.deliveryRecipients};
      await inboxMessageModel.updateOne({threadId: storedMessage.threadId, messageId: storedMessage.messageId}, {$set: {externalId, bodyHtml: hydratedMessage.bodyHtml, bodyText: hydratedMessage.bodyText, attachments: hydratedMessage.attachments, deliveryRecipients: hydratedMessage.deliveryRecipients}});
      return hydratedMessage;
    } else {
      debugLog(`hydrateMessage: no Gmail message found for ${storedMessage.messageId}`);
      return storedMessage;
    }
  } else {
    return storedMessage;
  }
}

export async function hydrateReplyTo(connection: InboxMailboxConnection, message: InboxMessage): Promise<InboxAddress | null> {
  const stated = statedReplyAddress(message);
  const lookupNeeded = !stated
    && message.replyTo === undefined
    && message.direction === InboxMessageDirection.INBOUND
    && message.externalSource === InboxReaderProvider.GMAIL_API
    && Boolean(message.externalId);
  const fetched = lookupNeeded ? await fetchMessageReplyTo(connection, message.externalId)
    .catch(lookupError => {
      debugLog(`hydrateReplyTo: Reply-To lookup failed for ${message.messageId}: ${(lookupError as Error).message}`);
      return null;
    }) : null;
  if (lookupNeeded) {
    await inboxMessageModel.updateOne({threadId: message.threadId, messageId: message.messageId}, {$set: {replyTo: fetched}});
    debugLog(`hydrateReplyTo: stored Reply-To ${JSON.stringify(fetched)} on message ${message.messageId}`);
  }
  return stated ?? (fetched?.email ? fetched : null);
}

export async function threadCorrespondent(connection: InboxMailboxConnection, messages: InboxMessage[]): Promise<InboxAddress | null> {
  const latestInbound = messages
    .filter(message => message.direction === InboxMessageDirection.INBOUND && !isAutoReplyMessage(message))
    .reduce<InboxMessage | null>((latest, candidate) =>
      (candidate.receivedAt ?? candidate.sentAt ?? 0) > (latest?.receivedAt ?? latest?.sentAt ?? -1) ? candidate : latest, null);
  if (latestInbound) {
    const stated = await hydrateReplyTo(connection, latestInbound);
    const sender = stated ?? latestInbound.from ?? null;
    return sender;
  } else {
    const latestOutbound = messages
      .filter(message => message.direction === InboxMessageDirection.OUTBOUND)
      .reduce<InboxMessage | null>((latest, candidate) =>
        (candidate.receivedAt ?? candidate.sentAt ?? 0) > (latest?.receivedAt ?? latest?.sentAt ?? -1) ? candidate : latest, null);
    if (!latestOutbound) {
      return null;
    } else {
      const internalEmails = await internalEmailsForConnection(connection);
      const counterparty = resolveThreadExternalAddress(latestOutbound, undefined, internalEmails);
      return counterparty;
    }
  }
}
