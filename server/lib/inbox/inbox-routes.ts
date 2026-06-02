import express, { Request, Response } from "express";
import debug from "debug";
import { createErrorDebugLog } from "../shared/error-debug-log";
import { isBoolean, isString } from "es-toolkit/compat";
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
  InboxPushConfigResponse,
  InboxPushSubscribeRequest,
  InboxPushVapidPublicKeyResponse,
  InboxReaderProvider,
  InboxReplyComposeRequest,
  InboxReplyComposeResponse,
  InboxSyncMode,
  InboxThread,
  InboxThreadListResponse,
  InboxUnreadCountByRole,
  InboxUnreadCountsResponse,
  InboxThreadMessagesResponse,
  InboxViewScope,
  inboxGeneralRoleTypeFor
} from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { MemberCookie } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { fetchFullMessage, markMessageRead, markMessagesRead, registerGmailWatch, stopGmailWatch } from "./gmail-inbox-reader";
import { broadcast } from "../websockets/websocket-broadcaster";
import { MessageType } from "../../../projects/ngx-ramblers/src/app/models/websocket.model";
import { buildQuotedReplyHtml, buildReplyHeaders } from "./inbox-message-import";
import { assignedInboxRoleTypesForMember, inboxConfigurationAdministrator, permittedInboxRoleTypes, requireInboxConfigurationAdministrator, requireInboxRoleAccess } from "./inbox-access";
import { derivedAliasForRoleType, derivedAliases, derivedAliasesForConnection } from "./inbox-aliases";
import { pollConnection } from "./inbox-poller";
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

function sanitiseConnection(record: InboxMailboxConnection): InboxMailboxConnectionView {
  const {oauthRefreshTokenEncrypted, ...safe} = record;
  return {...safe, id: connectionId(record), hasRefreshToken: Boolean(oauthRefreshTokenEncrypted)};
}

function connectionId(connection: InboxMailboxConnection): string {
  return (connection.id ?? (connection as unknown as {_id: {toString(): string}})._id?.toString() ?? "").toString();
}

function sanitiseAlias(record: InboxAliasConfig, connection: InboxMailboxConnection | null): InboxAliasConfigView {
  return {...record, mailboxConnection: connection ? sanitiseConnection(connection) : null};
}

async function accessibleThread(req: Request, res: Response, threadId: string): Promise<InboxThread | null> {
  const thread = await inboxThreadModel.findOne({_id: threadId, tenantSlug: defaultTenantSlug()}).lean();
  if (!thread) {
    res.status(404).json({request: {messageType}, error: `Thread ${threadId} not found`});
    return null;
  }
  const accessible = await requireInboxRoleAccess(req, res, thread.roleType);
  return accessible ? thread as InboxThread : null;
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
  if (storedMessage.externalSource !== InboxReaderProvider.GMAIL_API || !storedMessage.externalId) {
    return storedMessage;
  }
  const fetchedMessage = await fetchFullMessage(connection, storedMessage.externalId);
  return {
    ...storedMessage,
    bodyHtml: fetchedMessage.bodyHtml,
    bodyText: fetchedMessage.bodyText,
    attachments: fetchedMessage.attachments
  };
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
        debugLog(`import-all: immediate poll of ${updatedConnection.gmailAccountEmail} imported ${pollResult.importedCount} message(s)${pollResult.error ? ` (error: ${pollResult.error})` : ""}`);
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
    debugLog(`rescan-general: ${connection.gmailAccountEmail} deleted ${deletedThreads} thread(s) / ${deletedMessages} message(s), imported ${importedCount}`);
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
    const response: InboxPushConfigResponse = {pushUrl: await pushReceiverUrl(), configured};
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
    pollConnection(connection)
      .then(result => debugLog(`inbox push: synced ${emailAddress}, imported ${result.importedCount}`))
      .catch(pushSyncError => errorDebugLog("inbox push sync failed:", (pushSyncError as Error).message));
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
    const allowedRoleTypes = await permittedInboxRoleTypes(req);
    const aliases = await derivedAliases();
    const visibleAliases = isConfigAdministrator
      ? aliases
      : aliases.filter(alias => allowedRoleTypes.includes(alias.roleType));
    const connections = await inboxMailboxConnectionModel.find({tenantSlug: defaultTenantSlug()}).lean() as InboxMailboxConnection[];
    res.json({request: {messageType}, response: visibleAliases.map(alias => {
      const connection = connections.find(candidate => connectionId(candidate) === alias.mailboxConnectionId) ?? null;
      const visibleConnection = connection && !isConfigAdministrator ? {...connection, gmailAccountEmail: null} : connection;
      return sanitiseAlias(alias, visibleConnection);
    })});
  } catch (error) {
    errorDebugLog("Error listing inbox aliases:", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

router.get("/unread-counts", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    const allowedRoleTypes = await permittedInboxRoleTypes(req);
    if (allowedRoleTypes.length === 0) {
      const empty: InboxUnreadCountsResponse = {total: 0, byRole: []};
      res.json({request: {messageType}, response: empty});
      return;
    }
    const counts = await inboxThreadModel.aggregate([
      {$match: {tenantSlug: defaultTenantSlug(), roleType: {$in: allowedRoleTypes}, unread: true}},
      {$group: {_id: "$roleType", unreadCount: {$sum: 1}}}
    ]);
    const byRole: InboxUnreadCountByRole[] = counts.map(row => ({roleType: row._id, unreadCount: row.unreadCount}));
    const total = byRole.reduce((sum, row) => sum + row.unreadCount, 0);
    const response: InboxUnreadCountsResponse = {total, byRole};
    res.json({request: {messageType}, response});
  } catch (error) {
    errorDebugLog("Error fetching inbox unread counts:", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

router.get("/threads", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    const allowedRoleTypes = await permittedInboxRoleTypes(req);
    const assignedRoleTypes = await assignedInboxRoleTypesForMember(req.user as Partial<MemberCookie>);
    const roleType = req.query.roleType;
    if (isString(roleType) && !allowedRoleTypes.includes(roleType)) {
      res.status(403).json({request: {messageType}, error: "You do not have access to this role mailbox"});
      return;
    }
    const scopeRoleTypes = req.query.scope === InboxViewScope.ASSIGNED_ROLES
      ? assignedRoleTypes.filter(assignedRoleType => allowedRoleTypes.includes(assignedRoleType))
      : allowedRoleTypes;
    const filter: Record<string, unknown> = {
      tenantSlug: defaultTenantSlug(),
      roleType: isString(roleType) ? roleType : {$in: scopeRoleTypes}
    };
    if (req.query.unreadOnly === "true") {
      filter.unread = true;
    }
    const limit = req.query.limit ? Math.min(parseInt(req.query.limit as string, 10) || 50, 200) : 50;
    const threads = await inboxThreadModel.find(filter).sort({lastSeenAt: -1}).limit(limit).lean();
    const unreadCount = await inboxThreadModel.countDocuments({...filter, unread: true});
    const response: InboxThreadListResponse = {threads: threads as InboxThread[], unreadCount};
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
    const storedMessages = await inboxMessageModel.find({threadId: req.params.id}).sort({receivedAt: 1, sentAt: 1}).lean();
    const messages = await Promise.all(storedMessages.map(async message => {
      const storedMessage = message as InboxMessage;
      return hydrateMessage(await connectionForMessage(storedMessage, connection), storedMessage);
    }));
    const response: InboxThreadMessagesResponse = {thread, messages};
    res.json({request: {messageType}, response});
  } catch (error) {
    errorDebugLog("Error fetching thread:", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

router.post("/threads/:id/mark-read", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
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
    const inboundMessages = await inboxMessageModel.find({
      threadId: req.params.id,
      direction: InboxMessageDirection.INBOUND,
      externalSource: InboxReaderProvider.GMAIL_API,
      externalId: {$ne: null}
    }).lean() as InboxMessage[];
    const defaultConnectionId = connectionId(connection);
    const idsByConnection = inboundMessages.reduce<Map<string, string[]>>((map, storedMessage) => {
      const cid = storedMessage.mailboxConnectionId ?? defaultConnectionId;
      const existing = map.get(cid) ?? [];
      existing.push(storedMessage.externalId!);
      map.set(cid, existing);
      return map;
    }, new Map());
    await inboxThreadModel.updateOne({_id: req.params.id}, {$set: {unread: false}});
    const unreadCountForRole = await inboxThreadModel.countDocuments({
      tenantSlug: defaultTenantSlug(),
      roleType: thread.roleType,
      unread: true
    });
    const threadUpdatedEvent: InboxNewMessageEvent = {
      threadId: req.params.id,
      messageId: "",
      roleType: thread.roleType,
      unreadCountForRole
    };
    broadcast(MessageType.INBOX_THREAD_UPDATED, threadUpdatedEvent);
    res.json({request: {messageType}, response: {marked: true}});
    Array.from(idsByConnection.entries()).reduce<Promise<void>>(async (acc, [cid, ids]) => {
      await acc;
      const targetConnection = cid === defaultConnectionId
        ? connection
        : (await inboxMailboxConnectionModel.findOne({_id: cid, tenantSlug: defaultTenantSlug()}).lean() as InboxMailboxConnection | null) ?? connection;
      try {
        await markMessagesRead(targetConnection, ids);
      } catch (markError) {
        errorDebugLog("background mark-read failed:", (markError as Error).message);
      }
    }, Promise.resolve());
  } catch (error) {
    errorDebugLog("Error marking thread read:", (error as Error).message);
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
      direction: InboxMessageDirection.INBOUND,
      ...(composeRequest?.messageId ? {messageId: composeRequest.messageId} : {})
    }).sort({receivedAt: -1}).lean();
    if (!selected) {
      res.status(404).json({request: {messageType}, error: "No inbound message found on this thread"});
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
    const reply = buildComposeResponse(hydratedMessage, req.params.id, aliasId, connectionId(sourceConnection), thread.roleType, otherRoleCc);
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
    await inboxMessageModel.deleteMany({threadId: req.params.id});
    const result = await inboxThreadModel.deleteOne({_id: req.params.id, tenantSlug: defaultTenantSlug()});
    res.json({request: {messageType}, response: {deletedCount: result.deletedCount}});
  } catch (error) {
    errorDebugLog("Error deleting inbox thread:", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

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

function buildComposeResponse(inboundMessage: InboxMessage, threadId: string, aliasId: string, mailboxConnectionId: string, senderRoleType: string, cc: InboxAddress[]): InboxReplyComposeResponse {
  const {inReplyTo, references, subject} = buildReplyHeaders(inboundMessage);
  return {
    to: inboundMessage.from,
    cc,
    subject,
    inReplyTo,
    references,
    quotedHtml: buildQuotedReplyHtml(inboundMessage),
    senderRoleType,
    threadId,
    aliasId,
    mailboxConnectionId,
    inboxMessageId: inboundMessage.messageId
  };
}

export const inboxRoutes = router;
