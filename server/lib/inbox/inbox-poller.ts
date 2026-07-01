import debug from "debug";
import { createErrorDebugLog } from "../shared/error-debug-log";
import { envConfig } from "../env-config/env-config";
import { inboxMailboxConnection as inboxMailboxConnectionModel } from "../mongo/models/inbox-mailbox-connection";
import { inboxThread as inboxThreadModel } from "../mongo/models/inbox-thread";
import { derivedAliasesForConnection, generalAliasFor, messageRecipientEmails, roleIdentityEmailsByType, roleMatchesMessageAddresses } from "./inbox-aliases";
import {
  InboxAliasConfig,
  InboxAliasConnectionStatus,
  InboxConnectionHealthResult,
  InboxMailboxConnection,
  InboxPollResult,
  InboxReaderProvider,
  InboxSyncMode,
  InboxThreadFolder,
  isInboxGeneralRoleType
} from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import {
  fetchFullMessage,
  listAllInboxMessageIds,
  listHistoryDelta,
  listRecentInboxMessageIds,
  listSpamMessageIds,
  mailboxHistoryId,
  registerGmailWatch
} from "./gmail-inbox-reader";
import { storeInboundMessage } from "./inbox-message-import";
import { sendInboxAlertToAllSubscribers } from "./inbox-web-push";
import { AdminPath } from "../../../projects/ngx-ramblers/src/app/models/admin-route-paths.model";
import { dateTimeNow } from "../shared/dates";
import { pluraliseWithCount } from "../shared/string-utils";

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
    await pollSpamForConnection(connection, aliases)
      .catch(spamError => errorDebugLog(`spam scan failed for Gmail inbox ${connection.gmailAccountEmail}: ${(spamError as Error).message}`));
    await inboxMailboxConnectionModel.updateOne({_id: mailboxConnectionId}, {
      $set: {
        lastPolledAt: dateTimeNow().toMillis(),
        connectionStatus: InboxAliasConnectionStatus.CONNECTED,
        lastErrorMessage: null
      }
    });
    if (importedIds.length > 0) {
      debugLog(`polled Gmail inbox ${connection.gmailAccountEmail}: imported ${pluraliseWithCount(importedIds.length, "new message")}`);
    }
    return {mailboxConnectionId, importedCount: importedIds.length, error: null};
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
  const {newMessageIds, latestHistoryId} = await listHistoryDelta(connection, startHistoryId);
  const imported = await processGmailMessageIds(connection, aliases, newMessageIds);
  if (latestHistoryId) {
    await inboxMailboxConnectionModel.updateOne({_id: identifier(connection)}, {$set: {lastHistoryId: latestHistoryId}});
  }
  return imported;
}

async function processGmailMessageIds(connection: InboxMailboxConnection, aliases: InboxAliasConfig[], gmailMessageIds: string[]): Promise<string[]> {
  const realAliases = aliases.filter(alias => !isInboxGeneralRoleType(alias.roleType));
  const generalAlias = aliases.find(alias => isInboxGeneralRoleType(alias.roleType)) ?? null;
  const identityEmailsByType = await roleIdentityEmailsByType();
  const mailboxEmails = connection.gmailAccountEmail ? [connection.gmailAccountEmail] : [];
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
      if (!existingThread) {
        await storeInboundMessage(alias, parsed);
        return true;
      }
      return existingStored;
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
  const spamMessageIds = await listSpamMessageIds(connection, 50);
  return spamMessageIds.reduce<Promise<number>>(async (acc, gmailMessageId) => {
    const accumulator = await acc;
    const parsed = await fetchFullMessage(connection, gmailMessageId);
    const alreadyStored = await inboxThreadModel.findOne({
      tenantSlug: connection.tenantSlug,
      folder: InboxThreadFolder.JUNK,
      messageIds: parsed.messageId
    }).lean();
    if (alreadyStored) {
      return accumulator;
    }
    const addressedRealAliases = realAliases.filter(alias =>
      roleMatchesMessageAddresses(alias.roleType, alias.roleEmail, messageRecipientEmails(parsed), identityEmailsByType, mailboxEmails));
    const alias = addressedRealAliases[0] ?? generalAlias;
    await storeInboundMessage(alias, parsed, InboxThreadFolder.JUNK);
    return accumulator + 1;
  }, Promise.resolve(0));
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
