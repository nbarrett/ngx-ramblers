import debug from "debug";
import { createErrorDebugLog } from "../shared/error-debug-log";
import { envConfig } from "../env-config/env-config";
import { inboxMailboxConnection as inboxMailboxConnectionModel } from "../mongo/models/inbox-mailbox-connection";
import { inboxThread as inboxThreadModel } from "../mongo/models/inbox-thread";
import { derivedAliasesForConnection, generalAliasFor, internalDomainsForConnection, internalEmailsForConnection, messageRecipientEmails, roleIdentityEmailsByType, roleMatchesMessageAddresses } from "./inbox-aliases";
import {
  InboxAliasConfig,
  InboxAliasConnectionStatus,
  InboxConnectionHealthResult,
  InboxMailboxConnection,
  InboxMessage,
  InboxMessageDirection,
  InboxPollResult,
  InboxReaderProvider,
  InboxSyncMode,
  InboxThread,
  InboxThreadFolder,
  isInboxGeneralRoleType
} from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import {
  fetchFullMessage,
  fetchFullMessageDetailed,
  listAllInboxMessageIds,
  listHistoryDelta,
  listRecentInboxMessageIds,
  listSpamMessageIds,
  mailboxHistoryId,
  registerGmailWatch,
  removeSpamLabel
} from "./gmail-inbox-reader";
import { recordOutboundMessage, storeInboundMessage } from "./inbox-message-import";
import { sendInboxAlertToAllSubscribers } from "./inbox-web-push";
import { AdminPath } from "../../../projects/ngx-ramblers/src/app/models/admin-route-paths.model";
import { dateTimeNow } from "../shared/dates";
import { pluraliseWithCount } from "../shared/string-utils";
import { emailDomain, normaliseEmail } from "../../../projects/ngx-ramblers/src/app/functions/strings";
import { inboxMessage as inboxMessageModel } from "../mongo/models/inbox-message";
import { emailComposition as emailCompositionModel } from "../mongo/models/email-composition";
import { member as memberModel } from "../mongo/models/member";
import { ComposerFragmentKind, EmailCompositionDocument, EmailCompositionStatus } from "../../../projects/ngx-ramblers/src/app/models/email-composer.model";
import { renderEmailComposerMarkdown } from "../../../projects/ngx-ramblers/src/app/functions/email-composer-markdown";

const debugLog = debug(envConfig.logNamespace("inbox-poller"));
debugLog.enabled = true;
const errorDebugLog = createErrorDebugLog("inbox-poller");

let pollTimer: ReturnType<typeof setInterval> | null = null;
let pollInProgress = false;
const connectionSyncInFlight = new Set<string>();
const connectionSyncRerunRequested = new Set<string>();

export async function pollAllAliases(): Promise<InboxPollResult[]> {
  const enabledConnections = await inboxMailboxConnectionModel.find({
    enabled: true,
    provider: InboxReaderProvider.GMAIL_API,
    oauthRefreshTokenEncrypted: {$ne: null},
    syncMode: {$ne: InboxSyncMode.WATCH}
  }).lean();
  return enabledConnections.reduce<Promise<InboxPollResult[]>>(async (acc, connectionRecord) => {
    const accumulator = await acc;
    const result = await pollConnection(connectionRecord as InboxMailboxConnection);
    return accumulator.concat(result);
  }, Promise.resolve([]));
}

export async function pollConnection(connection: InboxMailboxConnection): Promise<InboxPollResult> {
  const mailboxConnectionId = identifier(connection);
  const aliases = await derivedAliasesForConnection(connection);
  try {
    const importedIds = connection.lastHistoryId
      ? await pollViaHistoryDelta(connection, aliases)
      : await pollViaListing(connection, aliases);
    const recoveredSentCount = await reconcileRecentSentCompositions(connection, aliases);
    await pollSpamForConnection(connection, aliases)
      .catch(spamError => errorDebugLog(`spam scan failed for Gmail inbox ${connection.gmailAccountEmail}: ${(spamError as Error).message}`));
    await inboxMailboxConnectionModel.updateOne({_id: mailboxConnectionId}, {
      $set: {
        lastPolledAt: dateTimeNow().toMillis(),
        connectionStatus: InboxAliasConnectionStatus.CONNECTED,
        lastErrorMessage: null
      }
    });
    if (importedIds.length > 0 || recoveredSentCount > 0) {
      debugLog(`polled Gmail inbox ${connection.gmailAccountEmail}: imported ${pluraliseWithCount(importedIds.length, "new message")}, recovered ${pluraliseWithCount(recoveredSentCount, "sent message")}`);
    }
    return {mailboxConnectionId, importedCount: importedIds.length + recoveredSentCount, error: null};
  } catch (error) {
    const message = (error as Error).message;
    const status = looksLikeAuthFailure(message) ? InboxAliasConnectionStatus.TOKEN_REVOKED : InboxAliasConnectionStatus.ERROR;
    await inboxMailboxConnectionModel.updateOne({_id: mailboxConnectionId}, {
      $set: {
        connectionStatus: status,
        lastErrorMessage: message
      }
    });
    await alertIfTokenJustRevoked(connection, status, message);
    errorDebugLog(`poll failed for Gmail inbox ${connection.gmailAccountEmail}: ${message}`);
    return {mailboxConnectionId, importedCount: 0, error: message};
  }
}

export function syncConnectionCoalesced(connection: InboxMailboxConnection): void {
  const mailboxConnectionId = identifier(connection);
  if (!mailboxConnectionId) {
    errorDebugLog("push sync skipped - connection has no identifier");
    return;
  }
  if (connectionSyncInFlight.has(mailboxConnectionId)) {
    connectionSyncRerunRequested.add(mailboxConnectionId);
    debugLog(`push sync for ${connection.gmailAccountEmail} already running; coalescing into a single rerun`);
    return;
  }
  void runConnectionSync(connection, mailboxConnectionId);
}

async function reconcileRecentSentCompositions(connection: InboxMailboxConnection, aliases: InboxAliasConfig[]): Promise<number> {
  const earliestSentAt = dateTimeNow().minus({days: 14}).toMillis();
  const roleTypes = aliases.map(alias => alias.roleType);
  const ownerMemberIds = aliases.map(alias => alias.memberId).filter((memberId): memberId is string => Boolean(memberId));
  if (roleTypes.length === 0 && ownerMemberIds.length === 0) {
    return 0;
  }
  const compositions = await emailCompositionModel.find({
    status: EmailCompositionStatus.Sent,
    sentAt: {$gte: earliestSentAt},
    $or: [
      {"state.unbrandedSenderRoleType": {$in: roleTypes}},
      {ownerMemberId: {$in: ownerMemberIds}}
    ]
  }).sort({sentAt: 1}).lean() as EmailCompositionDocument[];
  const compositionIds = compositions.map(compositionId);
  const existingMessages = await inboxMessageModel.find({
    direction: InboxMessageDirection.OUTBOUND,
    $or: [
      {externalSource: InboxReaderProvider.EMAIL_COMPOSER, externalId: {$in: compositionIds}},
      {mailboxConnectionId: identifier(connection), sentAt: {$gte: earliestSentAt}}
    ]
  }).select("externalSource externalId subject sentAt from.email bodyHtml").lean();
  const repairedMessagesByCompositionId = new Map(existingMessages
    .filter(message => message.externalSource === InboxReaderProvider.EMAIL_COMPOSER && message.externalId)
    .map(message => [message.externalId as string, message]));
  const styleUpgradeOperations = compositions.flatMap(composition => {
    const existingMessage = repairedMessagesByCompositionId.get(compositionId(composition));
    const bodyHtml = renderedCompositionBodyHtml(composition);
    return existingMessage && bodyHtml !== null && existingMessage.bodyHtml !== bodyHtml
      ? [{updateOne: {filter: {_id: (existingMessage as unknown as {_id: unknown})._id}, update: {$set: {bodyHtml, bodyText: composition.state?.introMarkdown ?? ""}}}}]
      : [];
  });
  if (styleUpgradeOperations.length > 0) {
    await inboxMessageModel.bulkWrite(styleUpgradeOperations);
  }
  const repairedCompositionIds = new Set(existingMessages
    .filter(message => message.externalSource === InboxReaderProvider.EMAIL_COMPOSER && message.externalId)
    .map(message => message.externalId as string));
  const storedMessageTimes = existingMessages.reduce((timesByIdentity, message) => {
    const key = messageIdentity(message.subject, message.from?.email ?? "");
    const times = timesByIdentity.get(key) ?? [];
    if (message.sentAt) {
      times.push(message.sentAt);
      timesByIdentity.set(key, times);
    }
    return timesByIdentity;
  }, new Map<string, number[]>());
  const candidates = compositions
    .map(composition => {
      const alias = aliases.find(candidate => candidate.roleType === composition.state?.unbrandedSenderRoleType)
        ?? aliases.find(candidate => candidate.memberId === composition.ownerMemberId);
      return {composition, alias, compositionId: compositionId(composition)};
    })
    .filter(candidate => {
      const sentAt = candidate.composition.sentAt;
      const matchingTimes = candidate.alias
        ? storedMessageTimes.get(messageIdentity(candidate.composition.state?.subject ?? "", candidate.alias.roleEmail)) ?? []
        : [];
      return candidate.alias
        && sentAt
        && !repairedCompositionIds.has(candidate.compositionId)
        && !matchingTimes.some(storedAt => Math.abs(storedAt - sentAt) <= 60_000);
    });
  const selectedMemberIds = candidates.flatMap(candidate => candidate.composition.state?.selectedMemberIds ?? []);
  const selectedMembers = selectedMemberIds.length > 0
    ? await memberModel.find({_id: {$in: selectedMemberIds}}).select("firstName lastName email").lean()
    : [];
  const memberById = new Map(selectedMembers.map(selectedMember => [selectedMember._id.toString(), selectedMember]));
  const internalEmails = await internalEmailsForConnection(connection);
  return candidates.reduce<Promise<number>>(async (acc, candidate) => {
    const recoveredCount = await acc;
    try {
      const {composition, alias, compositionId} = candidate;
      const state = composition.state;
      const sentAt = composition.sentAt ?? null;
      const messageId = `<composition-${compositionId}@ngx-ramblers.org.uk>`;
      const externalRecipients = state?.externalRecipients ?? [];
      const memberRecipients = (state?.selectedMemberIds ?? []).map((memberId: string) => memberById.get(memberId))
        .filter(Boolean)
        .map(selectedMember => ({
          name: [selectedMember.firstName, selectedMember.lastName].filter(Boolean).join(" "),
          email: selectedMember.email ?? ""
        }))
        .filter(recipient => recipient.email);
      const to = externalRecipients.concat(memberRecipients);
      const bodyHtml = renderedCompositionBodyHtml(composition);
      if (!alias || !sentAt || to.length === 0 || bodyHtml === null) {
        return recoveredCount;
      }
      const outboundMessage = {
        threadId: "",
        mailboxConnectionId: identifier(connection),
        direction: InboxMessageDirection.OUTBOUND,
        messageId,
        inReplyTo: null,
        references: [],
        from: {name: "", email: alias.roleEmail},
        to,
        cc: state.ccRecipients ?? [],
        subject: state.subject ?? "",
        bodyHtml,
        bodyText: state.introMarkdown ?? "",
        receivedAt: null,
        sentAt,
        externalSource: InboxReaderProvider.EMAIL_COMPOSER,
        externalId: compositionId,
        attachments: state.attachments ?? []
      };
      const stored = await recordOutboundMessage(alias, outboundMessage, internalEmails);
      return stored ? recoveredCount + 1 : recoveredCount;
    } catch (error) {
      errorDebugLog(`sent composition repair failed for ${candidate.composition.title}: ${(error as Error).message}`);
      return recoveredCount;
    }
  }, Promise.resolve(0));
}

function compositionId(composition: EmailCompositionDocument): string {
  return (composition as unknown as {_id: {toString(): string}})._id.toString();
}

function renderedCompositionBodyHtml(composition: EmailCompositionDocument): string | null {
  const state = composition.state;
  const supportedFragments = (state?.fragmentOrder ?? [])
    .every((fragment: {kind: ComposerFragmentKind}) => fragment.kind === ComposerFragmentKind.INTRO);
  return supportedFragments ? renderEmailComposerMarkdown(state?.introMarkdown ?? "") : null;
}

function messageIdentity(subject: string, senderEmail: string): string {
  return `${subject.trim().toLowerCase()}|${normaliseEmail(senderEmail)}`;
}

async function runConnectionSync(connection: InboxMailboxConnection, mailboxConnectionId: string): Promise<void> {
  connectionSyncInFlight.add(mailboxConnectionId);
  try {
    const result = await pollConnection(connection);
    debugLog(`push sync for ${connection.gmailAccountEmail}: imported ${result.importedCount}`);
  } catch (error) {
    errorDebugLog(`push sync failed for ${connection.gmailAccountEmail}: ${(error as Error).message}`);
  } finally {
    connectionSyncInFlight.delete(mailboxConnectionId);
    if (connectionSyncRerunRequested.delete(mailboxConnectionId)) {
      const refreshed = await inboxMailboxConnectionModel.findById(mailboxConnectionId).lean() as InboxMailboxConnection | null;
      if (refreshed) {
        void runConnectionSync(refreshed, mailboxConnectionId);
      }
    }
  }
}

async function pollViaListing(connection: InboxMailboxConnection, aliases: InboxAliasConfig[]): Promise<string[]> {
  const realAliases = aliases.filter(alias => !isInboxGeneralRoleType(alias.roleType));
  const generalAliasPresent = aliases.some(alias => isInboxGeneralRoleType(alias.roleType));
  const perAliasIdLists = await Promise.all(realAliases.map(alias => listRecentInboxMessageIds(connection, alias, 50)));
  const broadIds = generalAliasPresent ? await listAllInboxMessageIds(connection, 50) : [];
  const gmailMessageIds = [...new Set([...perAliasIdLists.flatMap(ids => ids), ...broadIds])];
  const imported = await processGmailMessageIds(connection, aliases, gmailMessageIds);
  const latestHistoryId = await mailboxHistoryId(connection);
  if (latestHistoryId) {
    await inboxMailboxConnectionModel.updateOne({_id: identifier(connection)}, {$set: {lastHistoryId: latestHistoryId}});
  }
  return imported;
}

async function pollViaHistoryDelta(connection: InboxMailboxConnection, aliases: InboxAliasConfig[]): Promise<string[]> {
  const startHistoryId = connection.lastHistoryId ?? "";
  try {
    const {newMessageIds, latestHistoryId} = await listHistoryDelta(connection, startHistoryId);
    const imported = await processGmailMessageIds(connection, aliases, newMessageIds);
    if (latestHistoryId) {
      await inboxMailboxConnectionModel.updateOne({_id: identifier(connection)}, {$set: {lastHistoryId: latestHistoryId}});
    }
    return imported;
  } catch (error) {
    if (!looksLikeExpiredHistory((error as Error).message)) {
      throw error;
    }
    errorDebugLog(`history cursor expired for Gmail inbox ${connection.gmailAccountEmail}; resetting and re-listing in full`);
    await inboxMailboxConnectionModel.updateOne({_id: identifier(connection)}, {$set: {lastHistoryId: null}});
    return pollViaListing({...connection, lastHistoryId: null}, aliases);
  }
}

async function processGmailMessageIds(connection: InboxMailboxConnection, aliases: InboxAliasConfig[], gmailMessageIds: string[]): Promise<string[]> {
  const realAliases = aliases.filter(alias => !isInboxGeneralRoleType(alias.roleType));
  const generalAlias = aliases.find(alias => isInboxGeneralRoleType(alias.roleType)) ?? null;
  const identityEmailsByType = await roleIdentityEmailsByType();
  const mailboxEmails = connection.gmailAccountEmail ? [connection.gmailAccountEmail] : [];
  const internalEmails = await internalEmailsForConnection(connection);
  return gmailMessageIds.reduce<Promise<string[]>>(async (acc, gmailMessageId) => {
    const accumulator = await acc;
    const parsed = await fetchFullMessage(connection, gmailMessageId);
    const messageEmails = messageRecipientEmails(parsed);
    const addressedRealAliases = realAliases.filter(alias =>
      roleMatchesMessageAddresses(alias.roleType, alias.roleEmail, messageEmails, identityEmailsByType, mailboxEmails));
    const aliasesToStoreUnder = addressedRealAliases.length > 0
      ? addressedRealAliases
      : (generalAlias ? [generalAlias] : []);
    const storedForAliases = await aliasesToStoreUnder.reduce<Promise<boolean>>(async (stored, alias) => {
      const existingStored = await stored;
      const existingThread = await inboxThreadModel.findOne({
        tenantSlug: alias.tenantSlug,
        roleType: alias.roleType,
        messageIds: parsed.messageId
      }).lean();
      if (existingThread) {
        return existingStored;
      }
      await storeInboundMessage(alias, parsed, undefined, internalEmails);
      return true;
    }, Promise.resolve(false));
    return storedForAliases ? accumulator.concat(parsed.messageId) : accumulator;
  }, Promise.resolve([]));
}

async function pollSpamForConnection(connection: InboxMailboxConnection, aliases: InboxAliasConfig[]): Promise<number> {
  if (!connection.gmailAccountEmail) {
    return 0;
  }
  const realAliases = aliases.filter(alias => !isInboxGeneralRoleType(alias.roleType));
  const generalAlias = generalAliasFor(connection, connection.tenantSlug);
  const identityEmailsByType = await roleIdentityEmailsByType();
  const mailboxEmails = connection.gmailAccountEmail ? [connection.gmailAccountEmail] : [];
  const internalEmails = await internalEmailsForConnection(connection);
  const internalDomains = await internalDomainsForConnection(connection);
  const spamMessageIds = await listSpamMessageIds(connection, 50);
  return spamMessageIds.reduce<Promise<number>>(async (acc, gmailMessageId) => {
    const accumulator = await acc;
    const {message: parsed, authentication} = await fetchFullMessageDetailed(connection, gmailMessageId);
    const rescue = authentication.dmarcPass && isOwnDomain(emailDomain(parsed.from?.email ?? ""), internalDomains);
    const existingThread = await inboxThreadModel.findOne({
      tenantSlug: connection.tenantSlug,
      messageIds: parsed.messageId
    }).lean() as InboxThread | null;
    const addressedRealAliases = realAliases.filter(alias =>
      roleMatchesMessageAddresses(alias.roleType, alias.roleEmail, messageRecipientEmails(parsed), identityEmailsByType, mailboxEmails));
    const alias = addressedRealAliases[0] ?? generalAlias;
    return accumulator + await fileSpamScanMessage(connection, parsed, alias, gmailMessageId, rescue, internalEmails, existingThread);
  }, Promise.resolve(0));
}

async function fileSpamScanMessage(connection: InboxMailboxConnection, parsed: InboxMessage, alias: InboxAliasConfig, gmailMessageId: string, rescue: boolean, internalEmails: Set<string>, existingThread: InboxThread | null): Promise<number> {
  const rehomeExisting = Boolean(existingThread && rescue && existingThread.folder === InboxThreadFolder.JUNK);
  const storeFresh = !existingThread;
  if (rehomeExisting) {
    await removeSpamLabel(connection, gmailMessageId)
      .catch(error => debugLog(`un-spam failed for ${gmailMessageId}: ${(error as Error).message}`));
    await inboxThreadModel.updateOne(
      {tenantSlug: connection.tenantSlug, messageIds: parsed.messageId, folder: InboxThreadFolder.JUNK},
      {$set: {folder: InboxThreadFolder.INBOX, unread: true, readByMemberIds: []}});
    debugLog(`re-homed already-junked message ${parsed.messageId} from ${parsed.from?.email} to inbox`);
  } else if (storeFresh && rescue) {
    await removeSpamLabel(connection, gmailMessageId)
      .catch(error => debugLog(`un-spam failed for ${gmailMessageId}: ${(error as Error).message}`));
    await storeInboundMessage(alias, parsed, InboxThreadFolder.INBOX, internalEmails);
    debugLog(`rescued authenticated internal message ${parsed.messageId} from ${parsed.from?.email} out of spam`);
  } else if (storeFresh) {
    await storeInboundMessage(alias, parsed, InboxThreadFolder.JUNK, internalEmails);
  }
  return rehomeExisting || storeFresh ? 1 : 0;
}

function isOwnDomain(fromDomain: string, internalDomains: Set<string>): boolean {
  return Boolean(fromDomain) && Array.from(internalDomains).some(domain =>
    fromDomain === domain || fromDomain.endsWith(`.${domain}`) || domain.endsWith(`.${fromDomain}`));
}

export async function runInboxTokenHealthCheck(): Promise<InboxConnectionHealthResult[]> {
  const connections = await inboxMailboxConnectionModel.find({
    enabled: true,
    provider: InboxReaderProvider.GMAIL_API,
    oauthRefreshTokenEncrypted: {$ne: null}
  }).lean();
  return connections.reduce<Promise<InboxConnectionHealthResult[]>>(async (acc, connectionRecord) => {
    const accumulator = await acc;
    return accumulator.concat(await checkConnectionHealth(connectionRecord as InboxMailboxConnection));
  }, Promise.resolve([]));
}

export async function checkConnectionHealth(connection: InboxMailboxConnection): Promise<InboxConnectionHealthResult> {
  const mailboxConnectionId = identifier(connection);
  const checkedAt = dateTimeNow().toMillis();
  try {
    await mailboxHistoryId(connection);
    await inboxMailboxConnectionModel.updateOne({_id: mailboxConnectionId}, {
      $set: {
        connectionStatus: InboxAliasConnectionStatus.CONNECTED,
        lastErrorMessage: null,
        lastHealthCheckAt: checkedAt
      }
    });
    return {mailboxConnectionId, gmailAccountEmail: connection.gmailAccountEmail, healthy: true, connectionStatus: InboxAliasConnectionStatus.CONNECTED, error: null};
  } catch (error) {
    const message = (error as Error).message;
    const status = looksLikeAuthFailure(message) ? InboxAliasConnectionStatus.TOKEN_REVOKED : InboxAliasConnectionStatus.ERROR;
    await inboxMailboxConnectionModel.updateOne({_id: mailboxConnectionId}, {
      $set: {
        connectionStatus: status,
        lastErrorMessage: message,
        lastHealthCheckAt: checkedAt
      }
    });
    await alertIfTokenJustRevoked(connection, status, message);
    errorDebugLog(`token health check failed for Gmail inbox ${connection.gmailAccountEmail}: ${message}`);
    return {mailboxConnectionId, gmailAccountEmail: connection.gmailAccountEmail, healthy: false, connectionStatus: status, error: message};
  }
}

export async function renewInboxWatches(): Promise<void> {
  const watchConnections = await inboxMailboxConnectionModel.find({
    enabled: true,
    provider: InboxReaderProvider.GMAIL_API,
    oauthRefreshTokenEncrypted: {$ne: null},
    syncMode: InboxSyncMode.WATCH
  }).lean();
  await watchConnections.reduce<Promise<void>>(async (acc, connectionRecord) => {
    await acc;
    await renewWatch(connectionRecord as InboxMailboxConnection);
  }, Promise.resolve());
}

async function renewWatch(connection: InboxMailboxConnection): Promise<void> {
  const mailboxConnectionId = identifier(connection);
  try {
    await pollConnection(connection);
    const refreshed = await inboxMailboxConnectionModel.findById(mailboxConnectionId).lean() as InboxMailboxConnection | null;
    if (!refreshed?.pubsubTopicName) {
      return;
    }
    const registration = await registerGmailWatch(refreshed, refreshed.pubsubTopicName);
    await inboxMailboxConnectionModel.updateOne({_id: mailboxConnectionId}, {
      $set: {
        watchExpiresAt: registration.expiration,
        lastHistoryId: registration.historyId ?? refreshed.lastHistoryId
      }
    });
    debugLog(`renewed Gmail watch for ${connection.gmailAccountEmail}, expires ${registration.expiration}`);
  } catch (error) {
    errorDebugLog(`failed to renew Gmail watch for ${connection.gmailAccountEmail}: ${(error as Error).message}`);
  }
}

export async function activateConnectionAfterReconnect(mailboxConnectionId: string): Promise<void> {
  const connection = await inboxMailboxConnectionModel.findById(mailboxConnectionId).lean() as InboxMailboxConnection | null;
  if (!connection) {
    errorDebugLog(`activate after reconnect skipped - connection ${mailboxConnectionId} not found`);
    return;
  }
  if (connection.syncMode === InboxSyncMode.WATCH) {
    await renewWatch(connection);
  } else {
    await pollConnection(connection);
  }
  debugLog(`activated Gmail inbox ${connection.gmailAccountEmail} after reconnect (${connection.syncMode} mode)`);
}

async function alertIfTokenJustRevoked(connection: InboxMailboxConnection, newStatus: InboxAliasConnectionStatus, message: string): Promise<void> {
  if (newStatus !== InboxAliasConnectionStatus.TOKEN_REVOKED || connection.connectionStatus === InboxAliasConnectionStatus.TOKEN_REVOKED) {
    return;
  }
  await sendInboxAlertToAllSubscribers({
    title: "Gmail inbox disconnected",
    body: `${connection.gmailAccountEmail} needs reconnecting. Google rejected the saved access (${message}).`,
    url: "/" + AdminPath.MAIL_SETTINGS + "?tab=inbox"
  }).catch(alertError => errorDebugLog(`failed to send inbox revocation alert: ${(alertError as Error).message}`));
}

function identifier(connection: InboxMailboxConnection): string {
  return (connection.id ?? (connection as unknown as {_id: {toString(): string}})._id?.toString() ?? "").toString();
}

function looksLikeAuthFailure(message: string): boolean {
  const lowered = message.toLowerCase();
  return lowered.includes("invalid_grant") || lowered.includes("token has been expired or revoked") || lowered.includes("invalid credentials");
}

function looksLikeExpiredHistory(message: string): boolean {
  const lowered = message.toLowerCase();
  return lowered.includes("requested entity was not found") || lowered.includes("\"code\": 404") || lowered.includes("failedprecondition");
}

export function startInboxPolling(intervalMs: number = 30_000): void {
  if (pollTimer) {
    debugLog("inbox polling already started; skipping duplicate start");
    return;
  }
  debugLog(`inbox polling starting (every ${intervalMs}ms)`);
  pollTimer = setInterval(() => {
    if (pollInProgress) {
      return;
    }
    pollInProgress = true;
    pollAllAliases()
      .catch(error => errorDebugLog("Polling iteration failed:", (error as Error).message))
      .finally(() => {
        pollInProgress = false;
      });
  }, intervalMs);
}

export function stopInboxPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    debugLog("inbox polling stopped");
  }
}
