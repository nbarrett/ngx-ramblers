import express, { Request, Response } from "express";
import { pluraliseWithCount } from "../shared/string-utils";
import debug from "debug";
import { createErrorDebugLog } from "../shared/error-debug-log";
import { isArray, isBoolean, isString } from "es-toolkit/compat";
import * as authConfig from "../auth/auth-config";
import { envConfig } from "../env-config/env-config";
import { errorResponse } from "../shared/error-response";
import { inboxMailboxConnection as inboxMailboxConnectionModel } from "../mongo/models/inbox-mailbox-connection";
import { inboxThread as inboxThreadModel } from "../mongo/models/inbox-thread";
import { inboxMessage as inboxMessageModel } from "../mongo/models/inbox-message";
import {
  InboxAddress,
  InboxAliasConfig,
  InboxAliasConfigView,
  InboxAccessMode,
  InboxAliasConnectionStatus,
  InboxMailboxConnection,
  InboxMailboxConnectionView,
  InboxMessage,
  InboxMessageDirection,
  InboxNewMessageEvent,
  InboxRoleNotificationSetting,
  InboxPushConfigResponse,
  InboxPushSubscribeRequest,
  InboxPushVapidPublicKeyResponse,
  InboxReaderProvider,
  InboxReplyComposeRequest,
  InboxReplyComposeResponse,
  InboxSyncMode,
  InboxThread,
  InboxThreadFolder,
  InboxThreadListResponse,
  InboxUnreadCountsResponse,
  InboxThreadMessagesResponse,
  InboxViewScope,
  inboxGeneralRoleTypeFor,
  isInboxGeneralRoleType
} from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { MemberCookie } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { fetchFullMessage, findGmailMessageIdByRfcHeader, markMessagesRead, markMessagesUnread, registerGmailWatch, removeSpamLabel, stopGmailWatch, trashMessage } from "./gmail-inbox-reader";
import { broadcast } from "../websockets/websocket-broadcaster";
import { MessageType } from "../../../projects/ngx-ramblers/src/app/models/websocket.model";
import { buildQuotedForwardHtml, buildQuotedReplyHtml, buildReplyHeaders } from "./inbox-message-import";
import { assignedInboxRoleTypesForMember, inboxConfigurationAdministrator, permittedInboxRoleTypes, permittedToReadJunk, requireInboxConfigurationAdministrator, requireInboxRoleAccess } from "./inbox-access";
import { assignedMembersByMemberId, derivedAliasForRoleType, derivedAliases, derivedAliasesForConnection, messageAddressEmails, roleIdentityEmailsByType, roleMatchesMessageAddresses } from "./inbox-aliases";
import { checkConnectionHealth, pollConnection, syncConnectionCoalesced } from "./inbox-poller";
import {
  conversationCount,
  conversationCountsByRole,
  threadUnreadForMember,
  unreadConditionForMember,
  unreadConversationCountForRole,
  unreadConversationFilter
} from "./inbox-unread-counts";
import { ensurePushVerificationToken, pushReceiverUrl, pushVerificationToken } from "./inbox-push";
import { registerPushSubscription, unregisterPushSubscription, vapidPublicKey } from "./inbox-web-push";
import { dateTimeNow } from "../shared/dates";
import * as systemConfig from "../config/system-config";
import * as config from "../mongo/controllers/config";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { CommitteeConfig, CommitteeMember } from "../../../projects/ngx-ramblers/src/app/models/committee.model";

const messageType = "inbox";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = true;
const errorDebugLog = createErrorDebugLog(messageType);

const router = express.Router();

function defaultTenantSlug(): string {
  return envConfig.value("APP_NAME" as never) ?? "default";
}

function requestingMemberId(req: Request): string | null {
  return (req.user as Partial<MemberCookie>).memberId ?? null;
}


function sanitiseConnection(record: InboxMailboxConnection): InboxMailboxConnectionView {
  const {oauthRefreshTokenEncrypted, ...safe} = record;
  return {...safe, id: connectionId(record), hasRefreshToken: Boolean(oauthRefreshTokenEncrypted)};
}

function connectionId(connection: InboxMailboxConnection): string {
  return (connection.id ?? (connection as unknown as {_id: {toString(): string}})._id?.toString() ?? "").toString();
}

function sanitiseAlias(record: InboxAliasConfig, connection: InboxMailboxConnection | null): InboxAliasConfigView {
  return {...record, mailboxConnection: connection ? sanitiseConnection(connection) : null, assignedMemberName: null, assignedMemberEmail: null};
}

async function withAssignedMemberNames(views: InboxAliasConfigView[]): Promise<InboxAliasConfigView[]> {
  const membersByMemberId = await assignedMembersByMemberId(views.map(view => view.memberId));
  return views.map(view => {
    const assigned = view.memberId ? membersByMemberId.get(view.memberId) ?? null : null;
    return {...view, assignedMemberName: assigned?.name ?? null, assignedMemberEmail: assigned?.email ?? null};
  });
}

async function accessibleThread(req: Request, res: Response, threadId: string): Promise<InboxThread | null> {
  const thread = await inboxThreadModel.findOne({_id: threadId, tenantSlug: defaultTenantSlug()}).lean();
  if (!thread) {
    res.status(404).json({request: {messageType}, error: `Thread ${threadId} not found`});
    return null;
  }
  if ((thread as InboxThread).folder === InboxThreadFolder.JUNK) {
    if (await permittedToReadJunk(req)) {
      return thread as InboxThread;
    }
    res.status(403).json({request: {messageType}, error: "You do not have access to junk mail"});
    return null;
  }
  const accessible = await requireInboxRoleAccess(req, res, thread.roleType);
  return accessible ? thread as InboxThread : null;
}

async function resolveThreadConnection(thread: InboxThread, messages: InboxMessage[]): Promise<InboxMailboxConnection | null> {
  const alias = await aliasForThread(thread);
  const viaAlias = alias ? await connectionForAlias(alias) : null;
  if (viaAlias) {
    return viaAlias;
  }
  const messageConnectionId = messages.map(message => message.mailboxConnectionId).find(Boolean);
  if (!messageConnectionId) {
    return null;
  }
  return inboxMailboxConnectionModel.findOne({_id: messageConnectionId, tenantSlug: defaultTenantSlug()}).lean() as Promise<InboxMailboxConnection | null>;
}

async function aliasForThread(thread: InboxThread): Promise<InboxAliasConfig | null> {
  return derivedAliasForRoleType(thread.roleType);
}

async function connectionForAlias(alias: InboxAliasConfig): Promise<InboxMailboxConnection | null> {
  if (!alias.mailboxConnectionId) {
    return null;
  }
  return inboxMailboxConnectionModel.findOne({_id: alias.mailboxConnectionId, tenantSlug: alias.tenantSlug}).lean() as Promise<InboxMailboxConnection | null>;
}

async function connectionForMessage(message: InboxMessage, fallback: InboxMailboxConnection): Promise<InboxMailboxConnection> {
  if (!message.mailboxConnectionId || message.mailboxConnectionId === connectionId(fallback)) {
    return fallback;
  }
  const storedConnection = await inboxMailboxConnectionModel.findOne({
    _id: message.mailboxConnectionId,
    tenantSlug: defaultTenantSlug()
  }).lean() as InboxMailboxConnection | null;
  return storedConnection ?? fallback;
}

async function hydrateMessage(connection: InboxMailboxConnection, storedMessage: InboxMessage): Promise<InboxMessage> {
  if (storedMessage.externalSource !== InboxReaderProvider.GMAIL_API) {
    return storedMessage;
  }
  if (storedMessage.bodyHtml !== null || storedMessage.bodyText !== null) {
    return storedMessage;
  }
  let externalId = storedMessage.externalId;
  if (!externalId) {
    if (!storedMessage.messageId) return storedMessage;
    try {
      externalId = await findGmailMessageIdByRfcHeader(connection, storedMessage.messageId);
    } catch (lookupError) {
      debugLog(`hydrateMessage: rfc822msgid lookup failed for ${storedMessage.messageId}: ${(lookupError as Error).message}`);
      return storedMessage;
    }
    if (!externalId) {
      debugLog(`hydrateMessage: no Gmail message found for rfc822msgid=${storedMessage.messageId}`);
      return storedMessage;
    }
  }
  const fetchedMessage = await fetchFullMessage(connection, externalId);
  const hydratedMessage = {
    ...storedMessage,
    externalId,
    bodyHtml: fetchedMessage.bodyHtml,
    bodyText: fetchedMessage.bodyText,
    attachments: fetchedMessage.attachments
  };
  await inboxMessageModel.updateOne(
    {threadId: storedMessage.threadId, messageId: storedMessage.messageId},
    {$set: {externalId, bodyHtml: hydratedMessage.bodyHtml, bodyText: hydratedMessage.bodyText, attachments: hydratedMessage.attachments}}
  );
  return hydratedMessage;
}

router.get("/mailbox-connections", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    if (!requireInboxConfigurationAdministrator(req, res)) {
      return;
    }
    const connections = await inboxMailboxConnectionModel.find({tenantSlug: defaultTenantSlug()}).sort({createdAt: 1}).lean() as InboxMailboxConnection[];
    res.json({request: {messageType}, response: connections.map(sanitiseConnection)});
  } catch (error) {
    errorDebugLog("Error fetching Gmail inbox mailbox connections:", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

router.post("/mailbox-connections", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    if (!requireInboxConfigurationAdministrator(req, res)) {
      return;
    }
    const now = dateTimeNow().toMillis();
    const currentMember = req.user as Partial<MemberCookie>;
    const changedBy = currentMember.memberId ?? "api";
    const existingUnconnected = await inboxMailboxConnectionModel.findOne({
      tenantSlug: defaultTenantSlug(),
      oauthRefreshTokenEncrypted: null
    }).lean() as InboxMailboxConnection | null;
    if (existingUnconnected) {
      res.json({request: {messageType}, response: sanitiseConnection(existingUnconnected)});
      return;
    }
    const connection = await inboxMailboxConnectionModel.create({
      tenantSlug: defaultTenantSlug(),
      provider: InboxReaderProvider.GMAIL_API,
      syncMode: InboxSyncMode.POLL,
      connectionStatus: InboxAliasConnectionStatus.NOT_CONNECTED,
      accessMode: InboxAccessMode.ALL_COMMITTEE_ROLES,
      enabled: true,
      createdAt: now,
      createdBy: changedBy,
      updatedAt: now,
      updatedBy: changedBy
    });
    res.json({request: {messageType}, response: sanitiseConnection(connection.toObject() as InboxMailboxConnection)});
  } catch (error) {
    errorDebugLog("Error creating Gmail inbox mailbox connection:", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

router.delete("/mailbox-connections/:id", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    if (!requireInboxConfigurationAdministrator(req, res)) {
      return;
    }
    const result = await inboxMailboxConnectionModel.deleteOne({_id: req.params.id, tenantSlug: defaultTenantSlug()});
    res.json({request: {messageType}, response: {deletedCount: result.deletedCount}});
  } catch (error) {
    errorDebugLog("Error deleting Gmail inbox mailbox connection:", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

router.put("/mailbox-connections/:id/access-mode", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    if (!requireInboxConfigurationAdministrator(req, res)) {
      return;
    }
    const accessMode = req.body?.accessMode;
    if (!isString(accessMode) || ![InboxAccessMode.ASSIGNED_ROLES, InboxAccessMode.ALL_COMMITTEE_ROLES].includes(accessMode as InboxAccessMode)) {
      res.status(400).json({request: {messageType}, error: "Choose assigned-roles or all-committee-roles for inbox access"});
      return;
    }
    const now = dateTimeNow().toMillis();
    const changedBy = (req.user as Partial<MemberCookie>).memberId ?? "api";
    const connection = await inboxMailboxConnectionModel.findOneAndUpdate(
      {_id: req.params.id, tenantSlug: defaultTenantSlug()},
      {$set: {accessMode, updatedAt: now, updatedBy: changedBy}},
      {new: true}
    );
    if (!connection) {
      res.status(404).json({request: {messageType}, error: "Gmail mailbox connection not found"});
      return;
    }
    res.json({request: {messageType}, response: sanitiseConnection(connection.toObject() as InboxMailboxConnection)});
  } catch (error) {
    errorDebugLog("Error updating shared inbox access mode:", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

router.put("/mailbox-connections/:id/import-all", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    if (!requireInboxConfigurationAdministrator(req, res)) {
      return;
    }
    const importAllMessages = req.body?.importAllMessages;
    if (!isBoolean(importAllMessages)) {
      res.status(400).json({request: {messageType}, error: "Pass importAllMessages as a boolean"});
      return;
    }
    const connection = await inboxMailboxConnectionModel.findOne({_id: req.params.id, tenantSlug: defaultTenantSlug()}).lean() as InboxMailboxConnection | null;
    if (!connection) {
      res.status(404).json({request: {messageType}, error: "Gmail mailbox connection not found"});
      return;
    }
    if (importAllMessages && !connection.gmailAccountEmail) {
      res.status(400).json({request: {messageType}, error: "Connect this Gmail mailbox before enabling 'import all messages'"});
      return;
    }
    const now = dateTimeNow().toMillis();
    const changedBy = (req.user as Partial<MemberCookie>).memberId ?? "api";
    const update: Record<string, unknown> = {importAllMessages, updatedAt: now, updatedBy: changedBy};
    if (importAllMessages) {
      update.lastHistoryId = null;
    }
    const updated = await inboxMailboxConnectionModel.findOneAndUpdate(
      {_id: req.params.id, tenantSlug: defaultTenantSlug()},
      {$set: update},
      {new: true}
    );
    const updatedConnection = updated.toObject() as InboxMailboxConnection;
    if (importAllMessages) {
      try {
        const pollResult = await pollConnection(updatedConnection);
        debugLog(`import-all: immediate poll of ${updatedConnection.gmailAccountEmail} imported ${pluraliseWithCount(pollResult.importedCount, "message")}${pollResult.error ? ` (error: ${pollResult.error})` : ""}`);
        res.json({request: {messageType}, response: {connection: sanitiseConnection(updatedConnection), importedCount: pollResult.importedCount, pollError: pollResult.error}});
        return;
      } catch (pollError) {
        errorDebugLog("import-all: immediate poll failed:", (pollError as Error).message);
      }
    }
    res.json({request: {messageType}, response: {connection: sanitiseConnection(updatedConnection), importedCount: 0, pollError: null}});
  } catch (error) {
    errorDebugLog("Error updating import-all flag:", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

router.post("/mailbox-connections/:id/rescan-general", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    if (!requireInboxConfigurationAdministrator(req, res)) {
      return;
    }
    const connection = await inboxMailboxConnectionModel.findOne({_id: req.params.id, tenantSlug: defaultTenantSlug()}).lean() as InboxMailboxConnection | null;
    if (!connection) {
      res.status(404).json({request: {messageType}, error: "Gmail mailbox connection not found"});
      return;
    }
    const health = await checkConnectionHealth(connection);
    if (!health.healthy) {
      res.json({request: {messageType}, response: {deletedThreads: 0, deletedMessages: 0, importedCount: 0, pollError: health.error, connection: sanitiseConnection(connection)}});
      return;
    }
    const generalRoleType = inboxGeneralRoleTypeFor(connectionId(connection));
    const threadsToDelete = await inboxThreadModel.find({tenantSlug: defaultTenantSlug(), roleType: generalRoleType}).lean();
    const threadIds = threadsToDelete.map(thread => (thread as unknown as {_id: {toString(): string}})._id.toString());
    const deletedMessages = threadIds.length > 0
      ? (await inboxMessageModel.deleteMany({threadId: {$in: threadIds}})).deletedCount ?? 0
      : 0;
    const deletedThreads = (await inboxThreadModel.deleteMany({tenantSlug: defaultTenantSlug(), roleType: generalRoleType})).deletedCount ?? 0;
    await inboxMailboxConnectionModel.updateOne(
      {_id: req.params.id, tenantSlug: defaultTenantSlug()},
      {$set: {lastHistoryId: null, importAllMessages: true, updatedAt: dateTimeNow().toMillis(), updatedBy: (req.user as Partial<MemberCookie>).memberId ?? "api"}}
    );
    const refreshed = await inboxMailboxConnectionModel.findOne({_id: req.params.id, tenantSlug: defaultTenantSlug()}).lean() as InboxMailboxConnection;
    let importedCount = 0;
    let pollError: string | null = null;
    try {
      const pollResult = await pollConnection(refreshed);
      importedCount = pollResult.importedCount;
      pollError = pollResult.error;
    } catch (pollFailure) {
      pollError = (pollFailure as Error).message;
      errorDebugLog("rescan-general: immediate poll failed:", pollError);
    }
    debugLog(`rescan-general: ${connection.gmailAccountEmail} deleted ${pluraliseWithCount(deletedThreads, "thread")} / ${pluraliseWithCount(deletedMessages, "message")}, imported ${importedCount}`);
    res.json({request: {messageType}, response: {deletedThreads, deletedMessages, importedCount, pollError, connection: sanitiseConnection(refreshed)}});
  } catch (error) {
    errorDebugLog("Error rescanning general mailbox:", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

router.put("/mailbox-connections/:id/sync-mode", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    if (!requireInboxConfigurationAdministrator(req, res)) {
      return;
    }
    const syncMode = req.body?.syncMode;
    if (![InboxSyncMode.POLL, InboxSyncMode.WATCH].includes(syncMode)) {
      res.status(400).json({request: {messageType}, error: "Choose poll or watch for the inbox sync mode"});
      return;
    }
    const connection = await inboxMailboxConnectionModel.findOne({_id: req.params.id, tenantSlug: defaultTenantSlug()}).lean() as InboxMailboxConnection | null;
    if (!connection) {
      res.status(404).json({request: {messageType}, error: "Gmail mailbox connection not found"});
      return;
    }
    const now = dateTimeNow().toMillis();
    const changedBy = (req.user as Partial<MemberCookie>).memberId ?? "api";
    if (syncMode === InboxSyncMode.WATCH) {
      if (!connection.oauthRefreshTokenEncrypted) {
        res.status(400).json({request: {messageType}, error: "Connect this Gmail mailbox before switching it to push (watch) mode"});
        return;
      }
      const pubsubTopicName = req.body?.pubsubTopicName;
      if (!isString(pubsubTopicName) || pubsubTopicName.trim().length === 0) {
        res.status(400).json({request: {messageType}, error: "A Google Cloud Pub/Sub topic name is required for push (watch) mode, e.g. projects/<project>/topics/<topic>"});
        return;
      }
      await ensurePushVerificationToken();
      const registration = await registerGmailWatch(connection, pubsubTopicName.trim());
      const updated = await inboxMailboxConnectionModel.findOneAndUpdate(
        {_id: req.params.id, tenantSlug: defaultTenantSlug()},
        {$set: {
          syncMode: InboxSyncMode.WATCH,
          pubsubTopicName: pubsubTopicName.trim(),
          watchExpiresAt: registration.expiration,
          lastHistoryId: registration.historyId ?? connection.lastHistoryId,
          updatedAt: now,
          updatedBy: changedBy
        }},
        {new: true}
      );
      res.json({request: {messageType}, response: sanitiseConnection(updated.toObject() as InboxMailboxConnection)});
      return;
    }
    if (connection.syncMode === InboxSyncMode.WATCH) {
      try {
        await stopGmailWatch(connection);
      } catch (stopError) {
        errorDebugLog("Failed to stop Gmail watch (continuing to poll mode):", (stopError as Error).message);
      }
    }
    const updated = await inboxMailboxConnectionModel.findOneAndUpdate(
      {_id: req.params.id, tenantSlug: defaultTenantSlug()},
      {$set: {syncMode: InboxSyncMode.POLL, pubsubTopicName: null, watchExpiresAt: null, updatedAt: now, updatedBy: changedBy}},
      {new: true}
    );
    res.json({request: {messageType}, response: sanitiseConnection(updated.toObject() as InboxMailboxConnection)});
  } catch (error) {
    errorDebugLog("Error updating inbox sync mode:", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

router.get("/pubsub/push-config", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    if (!requireInboxConfigurationAdministrator(req, res)) {
      return;
    }
    const configuredSystem = await systemConfig.systemConfig();
    const configured = Boolean(configuredSystem?.googleInbox?.redirectUri);
    if (configured) {
      await ensurePushVerificationToken();
    }
    const response: InboxPushConfigResponse = {
      pushUrl: await pushReceiverUrl(),
      configured,
      configuredTopicName: configuredSystem?.googleInbox?.pubsubTopicName ?? null
    };
    res.json({request: {messageType}, response});
  } catch (error) {
    errorDebugLog("Error resolving inbox push config:", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

router.post("/pubsub/push", async (req: Request, res: Response) => {
  try {
    const expectedToken = await pushVerificationToken();
    if (!expectedToken || req.query.token !== expectedToken) {
      res.status(401).json({request: {messageType}, error: "Invalid push verification token"});
      return;
    }
    const emailAddress = decodePushNotification(req.body)?.emailAddress;
    res.status(204).end();
    if (!emailAddress) {
      debugLog("inbox push: notification without an emailAddress, ignoring");
      return;
    }
    const connection = await inboxMailboxConnectionModel.findOne({
      tenantSlug: defaultTenantSlug(),
      gmailAccountEmail: emailAddress,
      enabled: true,
      syncMode: InboxSyncMode.WATCH
    }).lean() as InboxMailboxConnection | null;
    if (!connection?.oauthRefreshTokenEncrypted) {
      debugLog("inbox push: no push-enabled connection for", emailAddress);
      return;
    }
    syncConnectionCoalesced(connection);
  } catch (error) {
    errorDebugLog("Error handling inbox push notification:", (error as Error).message);
    if (!res.headersSent) {
      res.status(204).end();
    }
  }
});

router.get("/push/vapid-public-key", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    const key = await vapidPublicKey();
    const response: InboxPushVapidPublicKeyResponse = {vapidPublicKey: key};
    res.json({request: {messageType}, response});
  } catch (error) {
    errorDebugLog("Error returning VAPID public key:", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

router.post("/push/subscriptions", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    const memberId = (req.user as Partial<MemberCookie>).memberId;
    if (!memberId) {
      res.status(401).json({request: {messageType}, error: "Sign in before subscribing to inbox push notifications"});
      return;
    }
    const subscriptionRequest = req.body as InboxPushSubscribeRequest;
    if (!isString(subscriptionRequest?.endpoint) || !isString(subscriptionRequest?.keys?.p256dh) || !isString(subscriptionRequest?.keys?.auth)) {
      res.status(400).json({request: {messageType}, error: "Push subscription payload is missing endpoint or keys"});
      return;
    }
    await registerPushSubscription(memberId, subscriptionRequest.endpoint, subscriptionRequest.keys.p256dh, subscriptionRequest.keys.auth, subscriptionRequest.userAgent ?? null);
    res.json({request: {messageType}, response: {subscribed: true}});
  } catch (error) {
    errorDebugLog("Error registering inbox push subscription:", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

router.delete("/push/subscriptions", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    const memberId = (req.user as Partial<MemberCookie>).memberId;
    if (!memberId) {
      res.status(401).json({request: {messageType}, error: "Sign in before changing inbox push subscriptions"});
      return;
    }
    const endpoint = req.body?.endpoint;
    if (!isString(endpoint)) {
      res.status(400).json({request: {messageType}, error: "Pass the push subscription endpoint to remove"});
      return;
    }
    await unregisterPushSubscription(memberId, endpoint);
    res.json({request: {messageType}, response: {subscribed: false}});
  } catch (error) {
    errorDebugLog("Error removing inbox push subscription:", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

function decodePushNotification(body: any): { emailAddress?: string; historyId?: string } | null {
  const data = body?.message?.data;
  if (!isString(data)) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(data, "base64").toString("utf8"));
  } catch (parseError) {
    errorDebugLog("inbox push: could not decode notification payload:", (parseError as Error).message);
    return null;
  }
}

router.get("/aliases", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    const isConfigAdministrator = inboxConfigurationAdministrator(req);
    const [allowedRoleTypes, aliases] = await Promise.all([permittedInboxRoleTypes(req), derivedAliases()]);
    const visibleAliases = aliases.filter(alias => allowedRoleTypes.includes(alias.roleType));
    const connections = await inboxMailboxConnectionModel.find({tenantSlug: defaultTenantSlug()}).lean() as InboxMailboxConnection[];
    const views = visibleAliases.map(alias => {
      const connection = connections.find(candidate => connectionId(candidate) === alias.mailboxConnectionId) ?? null;
      const visibleConnection = connection && !isConfigAdministrator ? {...connection, gmailAccountEmail: null} : connection;
      return sanitiseAlias(alias, visibleConnection);
    });
    res.json({request: {messageType}, response: await withAssignedMemberNames(views)});
  } catch (error) {
    errorDebugLog("Error listing inbox aliases:", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

router.get("/junk-access", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    res.json({request: {messageType}, response: {canReadJunk: await permittedToReadJunk(req)}});
  } catch (error) {
    errorDebugLog("Error checking inbox junk access:", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

router.put("/aliases/:roleType/notifications", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    if (!requireInboxConfigurationAdministrator(req, res)) {
      return;
    }
    const enabled = req.body?.enabled;
    if (!isBoolean(enabled)) {
      res.status(400).json({request: {messageType}, error: "enabled must be true or false"});
      return;
    }
    const committeeConfigDocument = await config.queryKey(ConfigKey.COMMITTEE);
    const committeeConfiguration: CommitteeConfig = committeeConfigDocument?.value;
    const roles: CommitteeMember[] = committeeConfiguration?.roles ?? [];
    const role = roles.find(candidate => candidate.type === req.params.roleType);
    if (!role) {
      res.status(404).json({request: {messageType}, error: `No committee role found for ${req.params.roleType}`});
      return;
    }
    role.inboxMessageNotifications = enabled;
    await config.createOrUpdateKey(ConfigKey.COMMITTEE, committeeConfiguration);
    const alias = await derivedAliasForRoleType(req.params.roleType);
    if (!alias) {
      res.status(404).json({request: {messageType}, error: `No role mailbox found for ${req.params.roleType}`});
      return;
    }
    const connection = await connectionForAlias(alias);
    const [view] = await withAssignedMemberNames([sanitiseAlias(alias, connection)]);
    res.json({request: {messageType}, response: view});
  } catch (error) {
    errorDebugLog("Error updating inbox role notifications:", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

router.put("/aliases/:roleType/notification-email", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    if (!requireInboxConfigurationAdministrator(req, res)) {
      return;
    }
    const email = req.body?.email;
    if (email !== null && email !== undefined && !isString(email)) {
      res.status(400).json({request: {messageType}, error: "email must be a string or null"});
      return;
    }
    const committeeConfigDocument = await config.queryKey(ConfigKey.COMMITTEE);
    const committeeConfiguration: CommitteeConfig = committeeConfigDocument?.value;
    const roles: CommitteeMember[] = committeeConfiguration?.roles ?? [];
    const role = roles.find(candidate => candidate.type === req.params.roleType);
    if (!role) {
      res.status(404).json({request: {messageType}, error: `No committee role found for ${req.params.roleType}`});
      return;
    }
    role.inboxNotificationEmail = isString(email) && email.trim().length > 0 ? email.trim() : undefined;
    await config.createOrUpdateKey(ConfigKey.COMMITTEE, committeeConfiguration);
    const alias = await derivedAliasForRoleType(req.params.roleType);
    if (!alias) {
      res.status(404).json({request: {messageType}, error: `No role mailbox found for ${req.params.roleType}`});
      return;
    }
    const connection = await connectionForAlias(alias);
    const [view] = await withAssignedMemberNames([sanitiseAlias(alias, connection)]);
    res.json({request: {messageType}, response: view});
  } catch (error) {
    errorDebugLog("Error updating inbox role notification email:", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

router.put("/aliases/notifications", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    if (!requireInboxConfigurationAdministrator(req, res)) {
      return;
    }
    const changes = req.body?.changes;
    if (!isArray(changes)) {
      res.status(400).json({request: {messageType}, error: "changes must be an array"});
      return;
    }
    const committeeConfigDocument = await config.queryKey(ConfigKey.COMMITTEE);
    const committeeConfiguration: CommitteeConfig = committeeConfigDocument?.value;
    const roles: CommitteeMember[] = committeeConfiguration?.roles ?? [];
    (changes as InboxRoleNotificationSetting[]).forEach(change => {
      const role = roles.find(candidate => candidate.type === change.roleType);
      if (role) {
        role.inboxMessageNotifications = change.inboxMessageNotifications === true;
        const email = change.inboxNotificationEmail;
        role.inboxNotificationEmail = change.inboxMessageNotifications && isString(email) && email.trim().length > 0 ? email.trim() : undefined;
      }
    });
    await config.createOrUpdateKey(ConfigKey.COMMITTEE, committeeConfiguration);
    res.json({request: {messageType}, response: {updated: changes.length}});
  } catch (error) {
    errorDebugLog("Error updating inbox role notifications:", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

router.get("/unread-counts", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    const [allowedRoleTypes, assignedRoleTypes] = await Promise.all([
      permittedInboxRoleTypes(req),
      assignedInboxRoleTypesForMember(req.user as Partial<MemberCookie>)
    ]);
    const scopeRoleTypes = req.query.scope === InboxViewScope.ASSIGNED_ROLES
      ? assignedRoleTypes.filter(assignedRoleType => allowedRoleTypes.includes(assignedRoleType))
      : allowedRoleTypes;
    if (scopeRoleTypes.length === 0) {
      const empty: InboxUnreadCountsResponse = {total: 0, byRole: []};
      res.json({request: {messageType}, response: empty});
      return;
    }
    const unreadFilter = unreadConversationFilter(scopeRoleTypes, requestingMemberId(req));
    const [byRole, total] = await Promise.all([conversationCountsByRole(unreadFilter), conversationCount(unreadFilter)]);
    const response: InboxUnreadCountsResponse = {total, byRole};
    res.json({request: {messageType}, response});
  } catch (error) {
    errorDebugLog("Error fetching inbox unread counts:", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

router.get("/threads", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? Math.min(parseInt(req.query.limit as string, 10) || 50, 200) : 50;
    if (req.query.folder === InboxThreadFolder.JUNK) {
      if (!(await permittedToReadJunk(req))) {
        res.status(403).json({request: {messageType}, error: "You do not have access to junk mail"});
        return;
      }
      const junkFilter = {tenantSlug: defaultTenantSlug(), folder: InboxThreadFolder.JUNK};
      const junkThreads = await inboxThreadModel.find(junkFilter).sort({lastSeenAt: -1}).limit(limit).lean();
      const junkResponse: InboxThreadListResponse = {
        threads: junkThreads as InboxThread[],
        unreadCount: 0,
        totalCount: await conversationCount(junkFilter)
      };
      res.json({request: {messageType}, response: junkResponse});
      return;
    }
    const [allowedRoleTypes, assignedRoleTypes] = await Promise.all([
      permittedInboxRoleTypes(req),
      assignedInboxRoleTypesForMember(req.user as Partial<MemberCookie>)
    ]);
    const roleType = req.query.roleType;
    if (isString(roleType) && !allowedRoleTypes.includes(roleType)) {
      res.status(403).json({request: {messageType}, error: "You do not have access to this role mailbox"});
      return;
    }
    const scopeRoleTypes = req.query.scope === InboxViewScope.ASSIGNED_ROLES
      ? assignedRoleTypes.filter(assignedRoleType => allowedRoleTypes.includes(assignedRoleType))
      : allowedRoleTypes;
    const memberId = requestingMemberId(req);
    const scopeFilter: Record<string, unknown> = {
      tenantSlug: defaultTenantSlug(),
      roleType: isString(roleType) ? roleType : {$in: scopeRoleTypes},
      folder: {$ne: InboxThreadFolder.JUNK}
    };
    const filter = req.query.unreadOnly === "true"
      ? {...scopeFilter, ...unreadConditionForMember(memberId)}
      : scopeFilter;
    const [threads, unreadCount, totalCount] = await Promise.all([
      inboxThreadModel.find(filter).sort({lastSeenAt: -1}).limit(limit).lean(),
      conversationCount({...scopeFilter, ...unreadConditionForMember(memberId)}),
      conversationCount(scopeFilter)
    ]);
    const threadsForMember = (threads as InboxThread[]).map(thread => ({...thread, unread: threadUnreadForMember(thread, memberId)}));
    const response: InboxThreadListResponse = {threads: threadsForMember, unreadCount, totalCount};
    res.json({request: {messageType}, response});
  } catch (error) {
    errorDebugLog("Error listing inbox threads:", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

router.get("/threads/:id", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    const thread = await accessibleThread(req, res, req.params.id);
    if (!thread) {
      return;
    }
    const storedMessages = await inboxMessageModel.find({threadId: req.params.id}).sort({receivedAt: 1, sentAt: 1}).lean();
    const connection = await resolveThreadConnection(thread, storedMessages as InboxMessage[]);
    if (!connection) {
      res.status(404).json({request: {messageType}, error: `No Gmail mailbox connection found for role ${thread.roleType}`});
      return;
    }
    const messages = await Promise.all(storedMessages.map(async message => {
      const storedMessage = message as InboxMessage;
      return hydrateMessage(await connectionForMessage(storedMessage, connection), storedMessage);
    }));
    const threadForMember = {...thread, unread: threadUnreadForMember(thread, requestingMemberId(req))};
    const response: InboxThreadMessagesResponse = {thread: threadForMember, messages};
    res.json({request: {messageType}, response});
  } catch (error) {
    errorDebugLog("Error fetching thread:", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

async function updateThreadReadState(req: Request, res: Response, unread: boolean): Promise<void> {
  const thread = await accessibleThread(req, res, req.params.id);
  if (!thread) {
    return;
  }
  const storedMessages = await inboxMessageModel.find({threadId: req.params.id}).lean() as InboxMessage[];
  const connection = await resolveThreadConnection(thread, storedMessages);
  if (!connection) {
    res.status(404).json({request: {messageType}, error: `No Gmail mailbox connection found for thread ${req.params.id}`});
    return;
  }
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
    ? (unread ? {$pull: {readByMemberIds: memberId}} : {$addToSet: {readByMemberIds: memberId}})
    : {$set: {unread}};
  await inboxThreadModel.updateOne({_id: req.params.id}, readStateUpdate);
  const unreadCountForRole = await unreadConversationCountForRole(thread.roleType, memberId);
  broadcast(MessageType.INBOX_THREAD_UPDATED, {threadId: req.params.id, messageId: "", roleType: thread.roleType, unreadCountForRole} as InboxNewMessageEvent);
  res.json({request: {messageType}, response: {marked: true}});
  Array.from(idsByConnection.entries()).reduce<Promise<void>>(async (acc, [cid, ids]) => {
    await acc;
    const targetConnection = cid === defaultConnectionId
      ? connection
      : (await inboxMailboxConnectionModel.findOne({_id: cid, tenantSlug: defaultTenantSlug()}).lean() as InboxMailboxConnection | null) ?? connection;
    try {
      await (unread ? markMessagesUnread(targetConnection, ids) : markMessagesRead(targetConnection, ids));
    } catch (markError) {
      errorDebugLog(`background mark-${unread ? "unread" : "read"} failed:`, (markError as Error).message);
    }
  }, Promise.resolve());
}

router.post("/threads/:id/mark-read", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    await updateThreadReadState(req, res, false);
  } catch (error) {
    errorDebugLog("Error marking thread read:", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

router.post("/threads/:id/mark-unread", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    await updateThreadReadState(req, res, true);
  } catch (error) {
    errorDebugLog("Error marking thread unread:", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

router.post("/threads/:id/compose-reply", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    const composeRequest = req.body as InboxReplyComposeRequest;
    const thread = await accessibleThread(req, res, req.params.id);
    if (!thread) {
      return;
    }
    const alias = await aliasForThread(thread);
    if (!alias) {
      res.status(404).json({request: {messageType}, error: `No alias config found for role ${thread.roleType}`});
      return;
    }
    const connection = await connectionForAlias(alias);
    if (!connection) {
      res.status(404).json({request: {messageType}, error: `No Gmail mailbox connection found for role ${thread.roleType}`});
      return;
    }
    const selected = await inboxMessageModel.findOne({
      threadId: req.params.id,
      ...(composeRequest?.messageId ? {messageId: composeRequest.messageId} : {})
    }).sort({receivedAt: -1, sentAt: -1}).lean();
    if (!selected) {
      res.status(404).json({request: {messageType}, error: "No message found on this thread"});
      return;
    }
    const storedMessage = selected as InboxMessage;
    const sourceConnection = await connectionForMessage(storedMessage, connection);
    const hydratedMessage = await hydrateMessage(sourceConnection, storedMessage);
    const aliasId = (alias.id ?? (alias as unknown as {_id: {toString(): string}})._id?.toString() ?? "").toString();
    const committeeConfigDocument = await config.queryKey(ConfigKey.COMMITTEE);
    const rolesByType = new Map<string, CommitteeMember>(((committeeConfigDocument?.value as CommitteeConfig)?.roles ?? []).map(role => [role.type, role]));
    const currentMemberId = (req.user as Partial<MemberCookie>).memberId;
    const otherRoleCc: InboxAddress[] = (await derivedAliasesForConnection(connection))
      .filter(connectionAlias => connectionAlias.roleType !== thread.roleType)
      .filter(connectionAlias => !(currentMemberId && rolesByType.get(connectionAlias.roleType)?.memberId === currentMemberId))
      .filter(connectionAlias => connectionAlias.roleEmail.toLowerCase() !== (connection.gmailAccountEmail ?? "").toLowerCase())
      .filter(connectionAlias => rolesByType.has(connectionAlias.roleType))
      .map(connectionAlias => ({name: rolesByType.get(connectionAlias.roleType)?.description ?? null, email: connectionAlias.roleEmail}));
    const replyTo = thread.externalAddress ?? (hydratedMessage.direction === InboxMessageDirection.OUTBOUND ? hydratedMessage.to?.[0] : hydratedMessage.from) ?? hydratedMessage.from;
    const reply = buildComposeResponse(hydratedMessage, replyTo, req.params.id, aliasId, connectionId(sourceConnection), thread.roleType, otherRoleCc, composeRequest?.forward === true);
    debugLog(`compose-reply: thread ${req.params.id} externalAddress=${JSON.stringify(thread.externalAddress)} reply.to=${JSON.stringify(reply.to)} message.from=${JSON.stringify(hydratedMessage.from)} messageId=${composeRequest?.messageId ?? "latest"}`);
    res.json({request: {messageType}, response: reply});
  } catch (error) {
    errorDebugLog("Error composing reply:", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

router.delete("/threads/:id", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    const thread = await accessibleThread(req, res, req.params.id);
    if (!thread) {
      return;
    }
    const storedMessages = await inboxMessageModel.find({threadId: req.params.id}).lean() as InboxMessage[];
    if (thread.folder === InboxThreadFolder.JUNK) {
      const connection = await resolveThreadConnection(thread, storedMessages);
      if (connection) {
        await Promise.all(gmailMessageIds(storedMessages).map(externalId =>
          trashMessage(connection, externalId).catch(trashError => debugLog(`trash failed for ${externalId}: ${(trashError as Error).message}`))));
      }
    }
    await inboxMessageModel.deleteMany({threadId: req.params.id});
    const result = await inboxThreadModel.deleteOne({_id: req.params.id, tenantSlug: defaultTenantSlug()});
    res.json({request: {messageType}, response: {deletedCount: result.deletedCount}});
  } catch (error) {
    errorDebugLog("Error deleting inbox thread:", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

router.post("/threads/:id/move-to-inbox", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    if (!requireInboxConfigurationAdministrator(req, res)) {
      return;
    }
    const thread = await accessibleThread(req, res, req.params.id);
    if (!thread) {
      return;
    }
    if (thread.folder !== InboxThreadFolder.JUNK) {
      res.json({request: {messageType}, response: {moved: false, roleType: thread.roleType}});
      return;
    }
    const storedMessages = await inboxMessageModel.find({threadId: req.params.id}).lean() as InboxMessage[];
    const connection = await resolveThreadConnection(thread, storedMessages);
    if (!connection) {
      res.status(404).json({request: {messageType}, error: `No Gmail mailbox connection found for thread ${req.params.id}`});
      return;
    }
    await Promise.all(gmailMessageIds(storedMessages).map(externalId =>
      removeSpamLabel(connection, externalId).catch(spamError => debugLog(`un-spam failed for ${externalId}: ${(spamError as Error).message}`))));
    const roleType = await resolveInboxRoleTypeForThread(connection, storedMessages, thread.roleType);
    await inboxThreadModel.updateOne({_id: req.params.id, tenantSlug: defaultTenantSlug()}, {$set: {folder: InboxThreadFolder.INBOX, roleType, unread: true, readByMemberIds: []}});
    res.json({request: {messageType}, response: {moved: true, roleType}});
  } catch (error) {
    errorDebugLog("Error moving inbox thread to inbox:", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

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

router.post("/mailbox-connections/:id/sync", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    if (!requireInboxConfigurationAdministrator(req, res)) {
      return;
    }
    const connection = await inboxMailboxConnectionModel.findOne({_id: req.params.id, tenantSlug: defaultTenantSlug()}).lean() as InboxMailboxConnection | null;
    if (!connection?.oauthRefreshTokenEncrypted) {
      res.status(400).json({request: {messageType}, error: "This Gmail mailbox has not been connected; complete OAuth consent first"});
      return;
    }
    const result = await pollConnection(connection);
    if (result.error) {
      res.status(502).json({request: {messageType}, error: result.error});
      return;
    }
    res.json({request: {messageType}, response: {importedCount: result.importedCount}});
  } catch (error) {
    errorDebugLog("Error syncing mailbox connection:", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

function buildComposeResponse(selectedMessage: InboxMessage, replyTo: InboxAddress, threadId: string, aliasId: string, mailboxConnectionId: string, senderRoleType: string, cc: InboxAddress[], forward = false): InboxReplyComposeResponse {
  const {inReplyTo, references, subject} = buildReplyHeaders(selectedMessage, forward);
  return {
    to: replyTo,
    cc: forward ? [] : cc,
    subject,
    inReplyTo,
    references,
    quotedHtml: forward ? buildQuotedForwardHtml(selectedMessage) : buildQuotedReplyHtml(selectedMessage),
    senderRoleType,
    threadId,
    aliasId,
    mailboxConnectionId,
    inboxMessageId: selectedMessage.messageId,
    ...(forward ? {forward: true, attachments: selectedMessage.attachments ?? []} : {})
  };
}

export const inboxRoutes = router;
