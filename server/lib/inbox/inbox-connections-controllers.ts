import { Request, Response } from "express";
import { pluraliseWithCount } from "../shared/string-utils";
import debug from "debug";
import { createErrorDebugLog } from "../shared/error-debug-log";
import { isBoolean, isString } from "es-toolkit/compat";
import { envConfig } from "../env-config/env-config";
import { errorResponse } from "../shared/error-response";
import { inboxMailboxConnection as inboxMailboxConnectionModel } from "../mongo/models/inbox-mailbox-connection";
import { InboxAccessMode, InboxAliasConnectionStatus, InboxMailboxConnection, InboxMailboxConnectionView, InboxReaderProvider, InboxSyncMode } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { MemberCookie } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { registerGmailWatch, stopGmailWatch } from "./gmail-inbox-reader";
import { requireInboxConfigurationAdministrator, requestMember } from "./inbox-access";
import { defaultTenantSlug, connectionIdentifier as connectionId } from "./inbox-aliases";
import { checkConnectionHealth, pollConnection } from "./inbox-poller";
import { ensurePushVerificationToken } from "./inbox-push";
import { dateTimeNow } from "../shared/dates";
const messageType = "inbox";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = true;
const errorDebugLog = createErrorDebugLog(messageType);
export async function listMailboxConnections(req: Request, res: Response): Promise<void> {
  try {
    if (requireInboxConfigurationAdministrator(req, res)) {
      const connections = await inboxMailboxConnectionModel.find({ tenantSlug: defaultTenantSlug() }).sort({ createdAt: 1 }).lean() as InboxMailboxConnection[];
      res.json({ request: { messageType }, response: connections.map(sanitiseConnection) });
    }
  }
  catch (error) {
    errorDebugLog("Error fetching Gmail inbox mailbox connections:", (error as Error).message);
    res.status(500).json({ request: { messageType }, error: errorResponse(error) });
  }
}
export async function createMailboxConnection(req: Request, res: Response): Promise<void> {
  try {
    if (requireInboxConfigurationAdministrator(req, res)) {
      const now = dateTimeNow().toMillis();
      const currentMember = requestMember(req);
      const changedBy = currentMember.memberId ?? "api";
      const existingUnconnected = await inboxMailboxConnectionModel.findOne({
        tenantSlug: defaultTenantSlug(),
        oauthRefreshTokenEncrypted: null
      }).lean() as InboxMailboxConnection | null;
      if (existingUnconnected) {
        res.json({ request: { messageType }, response: sanitiseConnection(existingUnconnected) });
      }
      else {
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
        res.json({ request: { messageType }, response: sanitiseConnection(connection.toObject() as InboxMailboxConnection) });
      }
    }
  }
  catch (error) {
    errorDebugLog("Error creating Gmail inbox mailbox connection:", (error as Error).message);
    res.status(500).json({ request: { messageType }, error: errorResponse(error) });
  }
}
export async function deleteMailboxConnection(req: Request, res: Response): Promise<void> {
  try {
    if (requireInboxConfigurationAdministrator(req, res)) {
      const result = await inboxMailboxConnectionModel.deleteOne({ _id: req.params.id, tenantSlug: defaultTenantSlug() });
      res.json({ request: { messageType }, response: { deletedCount: result.deletedCount } });
    }
  }
  catch (error) {
    errorDebugLog("Error deleting Gmail inbox mailbox connection:", (error as Error).message);
    res.status(500).json({ request: { messageType }, error: errorResponse(error) });
  }
}
export async function updateMailboxAccessMode(req: Request, res: Response): Promise<void> {
  try {
    if (requireInboxConfigurationAdministrator(req, res)) {
      const accessMode = req.body?.accessMode;
      if (!isString(accessMode) || ![InboxAccessMode.ASSIGNED_ROLES, InboxAccessMode.ALL_COMMITTEE_ROLES].includes(accessMode as InboxAccessMode)) {
        res.status(400).json({ request: { messageType }, error: "Choose assigned-roles or all-committee-roles for inbox access" });
      }
      else {
        const now = dateTimeNow().toMillis();
        const changedBy = (requestMember(req)).memberId ?? "api";
        const connection = await inboxMailboxConnectionModel.findOneAndUpdate({ _id: req.params.id, tenantSlug: defaultTenantSlug() }, { $set: { accessMode, updatedAt: now, updatedBy: changedBy } }, { new: true });
        if (!connection) {
          res.status(404).json({ request: { messageType }, error: "Gmail mailbox connection not found" });
        }
        else {
          res.json({ request: { messageType }, response: sanitiseConnection(connection.toObject() as InboxMailboxConnection) });
        }
      }
    }
  }
  catch (error) {
    errorDebugLog("Error updating shared inbox access mode:", (error as Error).message);
    res.status(500).json({ request: { messageType }, error: errorResponse(error) });
  }
}
export async function updateMailboxImportAll(req: Request, res: Response): Promise<void> {
  try {
    if (requireInboxConfigurationAdministrator(req, res)) {
      const importAllMessages = req.body?.importAllMessages;
      if (!isBoolean(importAllMessages)) {
        res.status(400).json({ request: { messageType }, error: "Pass importAllMessages as a boolean" });
      }
      else {
        const connection = await inboxMailboxConnectionModel.findOne({ _id: req.params.id, tenantSlug: defaultTenantSlug() }).lean() as InboxMailboxConnection | null;
        if (!connection) {
          res.status(404).json({ request: { messageType }, error: "Gmail mailbox connection not found" });
        }
        else {
          if (importAllMessages && !connection.gmailAccountEmail) {
            res.status(400).json({ request: { messageType }, error: "Connect this Gmail mailbox before enabling 'import all messages'" });
          }
          else {
            const now = dateTimeNow().toMillis();
            const changedBy = (requestMember(req)).memberId ?? "api";
            const update: Record<string, unknown> = { importAllMessages, updatedAt: now, updatedBy: changedBy };
            if (importAllMessages) {
              update.lastHistoryId = null;
            }
            const updated = await inboxMailboxConnectionModel.findOneAndUpdate({ _id: req.params.id, tenantSlug: defaultTenantSlug() }, { $set: update }, { new: true });
            const updatedConnection = updated.toObject() as InboxMailboxConnection;
            if (importAllMessages) {
              try {
                const pollResult = await pollConnection(updatedConnection);
                debugLog(`import-all: immediate poll of ${updatedConnection.gmailAccountEmail} imported ${pluraliseWithCount(pollResult.importedCount, "message")}${pollResult.error ? ` (error: ${pollResult.error})` : ""}`);
                res.json({ request: { messageType }, response: { connection: sanitiseConnection(updatedConnection), importedCount: pollResult.importedCount, pollError: pollResult.error } });
                return;
              }
              catch (pollError) {
                errorDebugLog("import-all: immediate poll failed:", (pollError as Error).message);
              }
            }
            res.json({ request: { messageType }, response: { connection: sanitiseConnection(updatedConnection), importedCount: 0, pollError: null } });
          }
        }
      }
    }
  }
  catch (error) {
    errorDebugLog("Error updating import-all flag:", (error as Error).message);
    res.status(500).json({ request: { messageType }, error: errorResponse(error) });
  }
}
export async function rescanGeneralMailbox(req: Request, res: Response): Promise<void> {
  try {
    if (requireInboxConfigurationAdministrator(req, res)) {
      const connection = await inboxMailboxConnectionModel.findOne({ _id: req.params.id, tenantSlug: defaultTenantSlug() }).lean() as InboxMailboxConnection | null;
      if (!connection) {
        res.status(404).json({ request: { messageType }, error: "Gmail mailbox connection not found" });
      }
      else {
        const health = await checkConnectionHealth(connection);
        if (!health.healthy) {
          res.json({ request: { messageType }, response: { deletedThreads: 0, deletedMessages: 0, importedCount: 0, pollError: health.error, connection: sanitiseConnection(connection) } });
        }
        else {
          await inboxMailboxConnectionModel.updateOne({ _id: req.params.id, tenantSlug: defaultTenantSlug() }, { $set: { lastHistoryId: null, importAllMessages: true, updatedAt: dateTimeNow().toMillis(), updatedBy: (requestMember(req)).memberId ?? "api" } });
          const refreshed = await inboxMailboxConnectionModel.findOne({ _id: req.params.id, tenantSlug: defaultTenantSlug() }).lean() as InboxMailboxConnection;
          let importedCount = 0;
          let pollError: string | null = null;
          try {
            const pollResult = await pollConnection(refreshed);
            importedCount = pollResult.importedCount;
            pollError = pollResult.error;
          }
          catch (pollFailure) {
            pollError = (pollFailure as Error).message;
            errorDebugLog("rescan-general: immediate poll failed:", pollError);
          }
          debugLog(`rescan-general: ${connection.gmailAccountEmail} imported ${pluraliseWithCount(importedCount, "missing message")} without clearing existing threads`);
          res.json({ request: { messageType }, response: { deletedThreads: 0, deletedMessages: 0, importedCount, pollError, connection: sanitiseConnection(refreshed) } });
        }
      }
    }
  }
  catch (error) {
    errorDebugLog("Error rescanning general mailbox:", (error as Error).message);
    res.status(500).json({ request: { messageType }, error: errorResponse(error) });
  }
}
export async function updateMailboxSyncMode(req: Request, res: Response): Promise<void> {
  try {
    if (requireInboxConfigurationAdministrator(req, res)) {
      const syncMode = req.body?.syncMode;
      if (![InboxSyncMode.POLL, InboxSyncMode.WATCH].includes(syncMode)) {
        res.status(400).json({ request: { messageType }, error: "Choose poll or watch for the inbox sync mode" });
      }
      else {
        const connection = await inboxMailboxConnectionModel.findOne({ _id: req.params.id, tenantSlug: defaultTenantSlug() }).lean() as InboxMailboxConnection | null;
        if (!connection) {
          res.status(404).json({ request: { messageType }, error: "Gmail mailbox connection not found" });
        }
        else {
          const now = dateTimeNow().toMillis();
          const changedBy = (requestMember(req)).memberId ?? "api";
          if (syncMode === InboxSyncMode.WATCH) {
            if (!connection.oauthRefreshTokenEncrypted) {
              res.status(400).json({ request: { messageType }, error: "Connect this Gmail mailbox before switching it to push (watch) mode" });
            }
            else {
              const pubsubTopicName = req.body?.pubsubTopicName;
              if (!isString(pubsubTopicName) || pubsubTopicName.trim().length === 0) {
                res.status(400).json({ request: { messageType }, error: "A Google Cloud Pub/Sub topic name is required for push (watch) mode, e.g. projects/<project>/topics/<topic>" });
              }
              else {
                await ensurePushVerificationToken();
                const registration = await registerGmailWatch(connection, pubsubTopicName.trim());
                const updated = await inboxMailboxConnectionModel.findOneAndUpdate({ _id: req.params.id, tenantSlug: defaultTenantSlug() }, { $set: {
                    syncMode: InboxSyncMode.WATCH,
                    pubsubTopicName: pubsubTopicName.trim(),
                    watchExpiresAt: registration.expiration,
                    lastHistoryId: registration.historyId ?? connection.lastHistoryId,
                    updatedAt: now,
                    updatedBy: changedBy
                  } }, { new: true });
                res.json({ request: { messageType }, response: sanitiseConnection(updated.toObject() as InboxMailboxConnection) });
                return;
              }
            }
          }
          if (connection.syncMode === InboxSyncMode.WATCH) {
            try {
              await stopGmailWatch(connection);
            }
            catch (stopError) {
              errorDebugLog("Failed to stop Gmail watch (continuing to poll mode):", (stopError as Error).message);
            }
          }
          const updated = await inboxMailboxConnectionModel.findOneAndUpdate({ _id: req.params.id, tenantSlug: defaultTenantSlug() }, { $set: { syncMode: InboxSyncMode.POLL, pubsubTopicName: null, watchExpiresAt: null, updatedAt: now, updatedBy: changedBy } }, { new: true });
          res.json({ request: { messageType }, response: sanitiseConnection(updated.toObject() as InboxMailboxConnection) });
        }
      }
    }
  }
  catch (error) {
    errorDebugLog("Error updating inbox sync mode:", (error as Error).message);
    res.status(500).json({ request: { messageType }, error: errorResponse(error) });
  }
}
export async function syncMailboxConnection(req: Request, res: Response): Promise<void> {
  try {
    if (requireInboxConfigurationAdministrator(req, res)) {
      const connection = await inboxMailboxConnectionModel.findOne({ _id: req.params.id, tenantSlug: defaultTenantSlug() }).lean() as InboxMailboxConnection | null;
      if (!connection?.oauthRefreshTokenEncrypted) {
        res.status(400).json({ request: { messageType }, error: "This Gmail mailbox has not been connected; complete OAuth consent first" });
      }
      else {
        const result = await pollConnection(connection);
        if (result.error) {
          res.status(502).json({ request: { messageType }, error: result.error });
        }
        else {
          res.json({ request: { messageType }, response: { importedCount: result.importedCount } });
        }
      }
    }
  }
  catch (error) {
    errorDebugLog("Error syncing mailbox connection:", (error as Error).message);
    res.status(500).json({ request: { messageType }, error: errorResponse(error) });
  }
}
export function sanitiseConnection(record: InboxMailboxConnection): InboxMailboxConnectionView {
  const { oauthRefreshTokenEncrypted, ...safe } = record;
  return { ...safe, id: connectionId(record), hasRefreshToken: Boolean(oauthRefreshTokenEncrypted) };
}
