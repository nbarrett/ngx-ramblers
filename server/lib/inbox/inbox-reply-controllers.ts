import { Request, Response } from "express";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { createErrorDebugLog } from "../shared/error-debug-log";
import { errorResponse } from "../shared/error-response";
import { InboxAddress, InboxMessage, InboxMessageDirection, InboxReplyComposeRequest, InboxReplyComposeResponse } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { MemberCookie } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { CommitteeConfig, CommitteeMember, roleEmailAddresses } from "../../../projects/ngx-ramblers/src/app/models/committee.model";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { normaliseEmail } from "../../../projects/ngx-ramblers/src/app/functions/strings";
import { inboxThreadId } from "../../../projects/ngx-ramblers/src/app/functions/inbox-thread";
import { inboxMessage as inboxMessageModel } from "../mongo/models/inbox-message";
import * as config from "../mongo/controllers/config";
import { requestMember } from "./inbox-access";
import { assignedMembersByMemberId, derivedAliasesForConnection, internalEmailsForConnection, connectionIdentifier as connectionId } from "./inbox-aliases";
import { accessibleThread, aliasForThread, connectionForAlias, connectionForMessage, hydrateMessage, hydrateReplyTo } from "./inbox-thread-context";
import { buildQuotedForwardHtml, buildQuotedReplyHtml, buildReplyHeaders, correctThreadExternalAddress, isAutoReplyMessage, replyTargetExcludingViewer } from "./inbox-message-import";

const messageType = "inbox";
const debugLog = debug(envConfig.logNamespace("inbox-reply"));
const errorDebugLog = createErrorDebugLog("inbox-reply");

export async function composeInboxReply(req: Request, res: Response): Promise<void> {
  try {
    const composeRequest = req.body as InboxReplyComposeRequest;
    const thread = await accessibleThread(req, res, req.params.id);
    if (thread) {
      const alias = await aliasForThread(thread);
      if (alias) {
        const connection = await connectionForAlias(alias);
        if (connection) {
          const selected = await inboxMessageModel.findOne({threadId: inboxThreadId(thread), ...(composeRequest?.messageId ? {messageId: composeRequest.messageId} : {})}).sort({receivedAt: -1, sentAt: -1}).lean();
          if (selected) {
            const storedMessage = selected as InboxMessage;
            const sourceConnection = await connectionForMessage(storedMessage, connection);
            const hydratedMessage = await hydrateMessage(sourceConnection, storedMessage);
            const aliasId = (alias.id ?? (alias as unknown as {_id: {toString(): string}})._id?.toString() ?? "").toString();
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
            const internalEmails = await internalEmailsForConnection(sourceConnection);
            const messageAddress = stated ?? (hydratedMessage.direction === InboxMessageDirection.OUTBOUND ? hydratedMessage.to?.[0] : hydratedMessage.from);
            const correspondent = messageAddress?.email && !internalEmails.has(normaliseEmail(messageAddress.email)) ? messageAddress : null;
            const candidateReplyTo = messageAddress ?? hydratedMessage.from;
            const currentMemberEmail = currentMemberId ? (await assignedMembersByMemberId([currentMemberId])).get(currentMemberId)?.email ?? null : null;
            const replyTo = replyTargetExcludingViewer(candidateReplyTo, hydratedMessage.from, currentMemberEmail);
            if (correspondent && !isAutoReplyMessage(hydratedMessage) && hydratedMessage.direction === InboxMessageDirection.INBOUND) {
              await correctThreadExternalAddress(inboxThreadId(thread), correspondent, internalEmails);
            }
            const threadRole = rolesByType.get(thread.roleType);
            const threadRoleAddresses = threadRole ? roleEmailAddresses(threadRole).map(normaliseEmail) : [];
            const inboundRecipientEmails = [...(hydratedMessage.deliveryRecipients ?? []), ...(hydratedMessage.to ?? []), ...(hydratedMessage.cc ?? [])]
              .filter(Boolean)
              .map(address => normaliseEmail(address.email));
            const receivedOnAddress = threadRoleAddresses.find(address => inboundRecipientEmails.includes(address)) ?? null;
            const reply = buildComposeResponse(hydratedMessage, replyTo, inboxThreadId(thread), aliasId, connectionId(sourceConnection), thread.roleType, otherRoleCc, composeRequest?.forward === true, receivedOnAddress ?? alias.roleEmail);
            debugLog(`compose-reply: thread ${req.params.id} externalAddress=${JSON.stringify(thread.externalAddress)} reply.to=${JSON.stringify(reply.to)} message.from=${JSON.stringify(hydratedMessage.from)} message.replyTo=${JSON.stringify(hydratedMessage.replyTo)} messageId=${composeRequest?.messageId ?? "latest"}`);
            res.json({request: {messageType}, response: reply});
          } else {
            res.status(404).json({request: {messageType}, error: "No message found on this thread"});
          }
        } else {
          res.status(404).json({request: {messageType}, error: `No mailbox connection found for role ${thread.roleType}`});
        }
      } else {
        res.status(404).json({request: {messageType}, error: `No alias config found for role ${thread.roleType}`});
      }
    }
  } catch (error) {
    errorDebugLog("Error composing reply:", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
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
