import { Request, Response } from "express";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { createErrorDebugLog } from "../shared/error-debug-log";
import { errorResponse } from "../shared/error-response";
import { InboxAddress, InboxMessage, InboxReplyComposeRequest, InboxReplyComposeResponse } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { CommitteeConfig, CommitteeMember, roleEmailAddresses } from "../../../projects/ngx-ramblers/src/app/models/committee.model";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { normaliseEmail } from "../../../projects/ngx-ramblers/src/app/functions/strings";
import { inboxMessageIdKey, inboxThreadId } from "../../../projects/ngx-ramblers/src/app/functions/inbox-thread";
import { inboxMessage as inboxMessageModel } from "../mongo/models/inbox-message";
import * as config from "../mongo/controllers/config";
import { requestMember } from "./inbox-access";
import { assignedMembersByMemberId, derivedAliasesForConnection, internalEmailsForConnection, connectionIdentifier as connectionId } from "./inbox-aliases";
import { accessibleThread, aliasForThread, connectionForAlias, connectionForMessage, hydrateMessage, hydrateReplyTo, resolveThreadConnection } from "./inbox-thread-context";
import { buildQuotedForwardHtml, buildQuotedReplyHtml, buildReplyHeaders, composeReplyAddress } from "./inbox-message-import";

const messageType = "inbox";
const debugLog = debug(envConfig.logNamespace("inbox-reply"));
const errorDebugLog = createErrorDebugLog("inbox-reply");

export async function composeInboxReply(req: Request, res: Response): Promise<void> {
  try {
    const composeRequest = req.body as InboxReplyComposeRequest;
    const thread = await accessibleThread(req, res, req.params.id);
    if (thread) {
      const threadId = inboxThreadId(thread);
      const storedMessage = await storedMessageForCompose(threadId, composeRequest?.messageId ?? null);
      if (storedMessage) {
        const alias = await aliasForThread(thread);
        const connection = (alias ? await connectionForAlias(alias) : null) ?? await resolveThreadConnection(thread, [storedMessage]);
        if (connection) {
          const sourceConnection = await connectionForMessage(storedMessage, connection);
          const hydratedMessage = await hydrateMessage(sourceConnection, storedMessage);
          const aliasId = (alias?.id ?? (alias as unknown as {_id: {toString(): string}})?._id?.toString() ?? "").toString();
          const committeeConfigDocument = await config.queryKey(ConfigKey.COMMITTEE);
          const rolesByType = new Map<string, CommitteeMember>(((committeeConfigDocument?.value as CommitteeConfig)?.roles ?? []).map(role => [role.type, role]));
          const currentMemberId = requestMember(req).memberId;
          const otherRoleCc: InboxAddress[] = (await derivedAliasesForConnection(connection))
            .filter(connectionAlias => connectionAlias.roleType !== thread.roleType)
            .filter(connectionAlias => !(currentMemberId && rolesByType.get(connectionAlias.roleType)?.memberId === currentMemberId))
            .filter(connectionAlias => connectionAlias.roleEmail.toLowerCase() !== (connection.gmailAccountEmail ?? "").toLowerCase())
            .filter(connectionAlias => rolesByType.has(connectionAlias.roleType))
            .map(connectionAlias => ({name: rolesByType.get(connectionAlias.roleType)?.description ?? null, email: connectionAlias.roleEmail}));
          const stated = await hydrateReplyTo(sourceConnection, hydratedMessage);
          const messageForReply = stated ? {...hydratedMessage, replyTo: stated} : hydratedMessage;
          const internalEmails = await internalEmailsForConnection(sourceConnection);
          const currentMemberEmail = currentMemberId ? (await assignedMembersByMemberId([currentMemberId])).get(currentMemberId)?.email ?? null : null;
          const replyTo = composeReplyAddress(messageForReply, internalEmails, currentMemberEmail, thread.externalAddress);
          const threadRole = rolesByType.get(thread.roleType);
          const threadRoleAddresses = threadRole ? roleEmailAddresses(threadRole).map(normaliseEmail) : [];
          const inboundRecipientEmails = [...(messageForReply.deliveryRecipients ?? []), ...(messageForReply.to ?? []), ...(messageForReply.cc ?? [])]
            .filter(Boolean)
            .map(address => normaliseEmail(address.email));
          const receivedOnAddress = threadRoleAddresses.find(address => inboundRecipientEmails.includes(address)) ?? null;
          const reply = buildComposeResponse(messageForReply, replyTo, threadId, aliasId, connectionId(sourceConnection), thread.roleType, otherRoleCc, composeRequest?.forward === true, receivedOnAddress ?? alias?.roleEmail);
          debugLog(`compose-reply: thread ${req.params.id} externalAddress=${JSON.stringify(thread.externalAddress)} reply.to=${JSON.stringify(reply.to)} message.from=${JSON.stringify(messageForReply.from)} message.replyTo=${JSON.stringify(messageForReply.replyTo)} messageId=${composeRequest?.messageId ?? "latest"}`);
          res.json({request: {messageType}, response: reply});
        } else {
          res.status(404).json({request: {messageType}, error: `No mailbox connection found for role ${thread.roleType}`});
        }
      } else {
        res.status(404).json({request: {messageType}, error: "No message found on this thread"});
      }
    }
  } catch (error) {
    errorDebugLog("Error composing reply:", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
}

async function storedMessageForCompose(threadId: string, messageId: string | null): Promise<InboxMessage | null> {
  if (messageId) {
    const exact = await inboxMessageModel.findOne({threadId, messageId}).sort({receivedAt: -1, sentAt: -1}).lean() as InboxMessage | null;
    if (exact) {
      return exact;
    } else {
      const key = inboxMessageIdKey(messageId);
      const candidates = Array.from(new Set([messageId, key, `<${key}>`]));
      return await inboxMessageModel.findOne({threadId, messageId: {$in: candidates}}).sort({receivedAt: -1, sentAt: -1}).lean() as InboxMessage | null;
    }
  } else {
    return await inboxMessageModel.findOne({threadId}).sort({receivedAt: -1, sentAt: -1}).lean() as InboxMessage | null;
  }
}

function buildComposeResponse(selectedMessage: InboxMessage, replyTo: InboxAddress, threadId: string, aliasId: string, mailboxConnectionId: string, senderRoleType: string, cc: InboxAddress[], forward = false, senderRoleEmail: string = null): InboxReplyComposeResponse {
  const {inReplyTo, references, subject} = buildReplyHeaders(selectedMessage, forward);
  return {
    to: replyTo,
    cc: forward ? [] : cc,
    subject,
    inReplyTo,
    references,
    quotedHtml: forward ? buildQuotedForwardHtml(selectedMessage) : buildQuotedReplyHtml(selectedMessage),
    senderRoleType,
    senderRoleEmail,
    threadId,
    aliasId,
    mailboxConnectionId,
    inboxMessageId: selectedMessage.messageId,
    ...(forward ? {forward: true, attachments: selectedMessage.attachments ?? []} : {})
  };
}
