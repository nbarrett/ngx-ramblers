import debug from "debug";
import { Request, Response } from "express";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { inboxSettingsForProvider } from "../../../projects/ngx-ramblers/src/app/models/cloudflare-email-routing.model";
import {
  InboxMailboxConnection,
  InboxProviderSwitchChange,
  InboxProviderSwitchResult,
  InboxProviderSwitchStep,
  InboxProviderSwitchStepResult,
  InboxReaderProvider,
  InboxSyncMode
} from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { envConfig } from "../env-config/env-config";
import { createErrorDebugLog } from "../shared/error-debug-log";
import { errorResponse } from "../shared/error-response";
import { dateTimeNow } from "../shared/dates";
import { createOrUpdateKey } from "../mongo/controllers/config";
import { systemConfig } from "../config/system-config";
import { inboxMailboxConnection as inboxMailboxConnectionModel } from "../mongo/models/inbox-mailbox-connection";
import { ensureCloudflareIngressConnection } from "../cloudflare/cloudflare-ingress-connection";
import { configuredCloudflareForCurrentSite } from "../cloudflare/cloudflare-config";
import { ensureDirectInboxCatchAll } from "../cloudflare/direct-inbox-catch-all";
import { stopGmailWatch } from "./gmail-inbox-reader";
import { activateConnectionAfterReconnect } from "./inbox-poller";
import { requireInboxConfigurationAdministrator, requestMember } from "./inbox-access";
import { clearDerivedAliasCache, connectionIdentifier, defaultTenantSlug } from "./inbox-aliases";

const messageType = "inbox-provider-switch";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = true;
const errorDebugLog = createErrorDebugLog(messageType);

function switchableProvider(provider: InboxReaderProvider): boolean {
  return provider === InboxReaderProvider.GMAIL_API || provider === InboxReaderProvider.CLOUDFLARE_INGRESS;
}

async function gmailConnections(tenantSlug: string): Promise<InboxMailboxConnection[]> {
  return inboxMailboxConnectionModel.find({
    tenantSlug,
    provider: InboxReaderProvider.GMAIL_API
  }).lean() as Promise<InboxMailboxConnection[]>;
}

async function inboxProviderSwitchStatus(): Promise<InboxProviderSwitchResult> {
  const tenantSlug = defaultTenantSlug();
  const current = await systemConfig();
  const gmail = await gmailConnections(tenantSlug);
  const cloudflare = await inboxMailboxConnectionModel.findOne({
    tenantSlug,
    provider: InboxReaderProvider.CLOUDFLARE_INGRESS
  }).lean();
  return {
    provider: current?.inbox?.provider ?? InboxReaderProvider.NONE,
    gmailPollingEnabled: gmail.some(connection => connection.enabled !== false && Boolean(connection.oauthRefreshTokenEncrypted)),
    gmailConnectionsWithToken: gmail.filter(connection => Boolean(connection.oauthRefreshTokenEncrypted)).length,
    cloudflareConnectionReady: Boolean(cloudflare),
    steps: []
  };
}

async function stopWatches(connections: InboxMailboxConnection[]): Promise<void> {
  const watched = connections.filter(connection => connection.syncMode === InboxSyncMode.WATCH);
  await Promise.all(watched.map(connection => stopGmailWatch(connection).catch(error => {
    errorDebugLog("stop Gmail watch failed for %s: %s", connection.id, (error as Error).message);
  })));
}

async function applyCloudflareSwitch(tenantSlug: string, memberId: string): Promise<InboxProviderSwitchStepResult[]> {
  const existingCloudflare = await inboxMailboxConnectionModel.findOne({
    tenantSlug,
    provider: InboxReaderProvider.CLOUDFLARE_INGRESS
  }).lean();
  await ensureCloudflareIngressConnection();
  const enabledGmail = (await gmailConnections(tenantSlug)).filter(connection => connection.enabled !== false);
  const gmailStep: InboxProviderSwitchStepResult = enabledGmail.length === 0
    ? {
      step: InboxProviderSwitchStep.GMAIL_POLLING,
      change: InboxProviderSwitchChange.ALREADY,
      detail: "Gmail polling is already stopped"
    }
    : await (async () => {
      const now = dateTimeNow().toMillis();
      await inboxMailboxConnectionModel.updateMany(
        {tenantSlug, provider: InboxReaderProvider.GMAIL_API, enabled: {$ne: false}},
        {$set: {enabled: false, updatedAt: now, updatedBy: memberId}}
      );
      await stopWatches(enabledGmail);
      return {
        step: InboxProviderSwitchStep.GMAIL_POLLING,
        change: InboxProviderSwitchChange.CHANGED,
        detail: `Stopped Gmail polling on ${enabledGmail.length} connection${enabledGmail.length === 1 ? "" : "s"}`
      };
    })();
  const catchAll = await ensureDirectInboxCatchAll(await configuredCloudflareForCurrentSite());
  return [
    {
      step: InboxProviderSwitchStep.CLOUDFLARE_CONNECTION,
      change: existingCloudflare ? InboxProviderSwitchChange.ALREADY : InboxProviderSwitchChange.CHANGED,
      detail: existingCloudflare ? "Direct to inbox connection is already in place" : "Created the Direct to inbox connection"
    },
    {
      step: InboxProviderSwitchStep.CATCH_ALL,
      change: catchAll.changed ? InboxProviderSwitchChange.CHANGED : InboxProviderSwitchChange.ALREADY,
      detail: catchAll.detail
    },
    gmailStep
  ];
}

async function applyGmailSwitch(tenantSlug: string, memberId: string): Promise<InboxProviderSwitchStepResult[]> {
  const gmail = await gmailConnections(tenantSlug);
  const withToken = gmail.filter(connection => Boolean(connection.oauthRefreshTokenEncrypted));
  const toEnable = withToken.filter(connection => connection.enabled === false);
  const gmailStep: InboxProviderSwitchStepResult = toEnable.length === 0
    ? {
      step: InboxProviderSwitchStep.GMAIL_POLLING,
      change: InboxProviderSwitchChange.ALREADY,
      detail: withToken.length === 0
        ? "No connected Gmail account to resume; connect one on this page if you want NGX to poll Gmail"
        : "Gmail polling is already running"
    }
    : await (async () => {
      const now = dateTimeNow().toMillis();
      await inboxMailboxConnectionModel.updateMany(
        {_id: {$in: toEnable.map(connection => connectionIdentifier(connection))}, tenantSlug},
        {$set: {enabled: true, updatedAt: now, updatedBy: memberId}}
      );
      return {
        step: InboxProviderSwitchStep.GMAIL_POLLING,
        change: InboxProviderSwitchChange.CHANGED,
        detail: `Resumed Gmail polling on ${toEnable.length} connection${toEnable.length === 1 ? "" : "s"}`
      };
    })();
  const watched = withToken.filter(connection => connection.syncMode === InboxSyncMode.WATCH);
  await Promise.all(watched.map(connection => activateConnectionAfterReconnect(connectionIdentifier(connection), true)));
  return [gmailStep];
}

async function applyProviderConnections(provider: InboxReaderProvider, tenantSlug: string, memberId: string, previous: Awaited<ReturnType<typeof systemConfig>>, alreadyProvider: boolean, changedConnections: InboxMailboxConnection[]): Promise<InboxProviderSwitchStepResult[]> {
  try {
    return provider === InboxReaderProvider.CLOUDFLARE_INGRESS
      ? await applyCloudflareSwitch(tenantSlug, memberId)
      : await applyGmailSwitch(tenantSlug, memberId);
  } catch (error) {
    const failures = [error];
    if (changedConnections.length > 0) {
      try {
        await inboxMailboxConnectionModel.updateMany(
          {_id: {$in: changedConnections.map(connectionIdentifier)}, tenantSlug, provider: InboxReaderProvider.GMAIL_API},
          {$set: {enabled: provider === InboxReaderProvider.CLOUDFLARE_INGRESS, updatedAt: dateTimeNow().toMillis(), updatedBy: memberId}}
        );
      } catch (restoreError) {
        errorDebugLog("Could not restore Gmail connection state after a failed provider switch", restoreError);
        failures.push(restoreError);
      }
    }
    if (!alreadyProvider) {
      try {
        await createOrUpdateKey(ConfigKey.SYSTEM, previous);
      } catch (restoreError) {
        errorDebugLog("Could not restore inbox provider after a failed provider switch", restoreError);
        failures.push(restoreError);
      }
    }
    clearDerivedAliasCache();
    if (failures.length > 1) {
      throw new AggregateError(failures, "Inbox switch failed and recovery was incomplete; check the provider and Gmail connections before retrying");
    } else {
      throw error;
    }
  }
}

export async function applyInboxProviderSwitch(provider: InboxReaderProvider, memberId: string): Promise<InboxProviderSwitchResult> {
  if (!switchableProvider(provider)) {
    throw new Error("Inbox provider switch only supports Gmail-connected inbox and Direct to inbox");
  } else {
    const tenantSlug = defaultTenantSlug();
    const current = await systemConfig();
    const gmail = await gmailConnections(tenantSlug);
    const changedConnections = gmail.filter(connection => provider === InboxReaderProvider.CLOUDFLARE_INGRESS
      ? connection.enabled !== false
      : connection.enabled === false && Boolean(connection.oauthRefreshTokenEncrypted));
    const alreadyProvider = current?.inbox?.provider === provider;
    const providerStep: InboxProviderSwitchStepResult = alreadyProvider
      ? {
        step: InboxProviderSwitchStep.PROVIDER,
        change: InboxProviderSwitchChange.ALREADY,
        detail: provider === InboxReaderProvider.CLOUDFLARE_INGRESS
          ? "Inbox is already set to Direct to inbox"
          : "Inbox is already set to Gmail-connected"
      }
      : await (async () => {
        const nextInbox = inboxSettingsForProvider(current?.inbox ?? null, provider);
        await createOrUpdateKey(ConfigKey.SYSTEM, {...current, inbox: nextInbox});
        return {
          step: InboxProviderSwitchStep.PROVIDER,
          change: InboxProviderSwitchChange.CHANGED,
          detail: provider === InboxReaderProvider.CLOUDFLARE_INGRESS
            ? "Inbox now stores Direct to inbox mail"
            : "Inbox now reads mail from the connected Gmail account"
        };
      })();
    const connectionSteps = await applyProviderConnections(provider, tenantSlug, memberId, current, alreadyProvider, changedConnections);
    clearDerivedAliasCache();
    const status = await inboxProviderSwitchStatus();
    debugLog("inbox provider switch to %s: %o", provider, [providerStep, ...connectionSteps]);
    return {...status, steps: [providerStep, ...connectionSteps]};
  }
}

export async function planInboxProviderSwitch(req: Request, res: Response): Promise<void> {
  try {
    if (requireInboxConfigurationAdministrator(req, res)) {
      res.json({request: {messageType}, response: await inboxProviderSwitchStatus()});
    }
  } catch (error) {
    errorDebugLog("Error planning inbox provider switch:", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
}

export async function applyInboxProviderSwitchRequest(req: Request, res: Response): Promise<void> {
  try {
    if (requireInboxConfigurationAdministrator(req, res)) {
      const provider = req.body?.provider as InboxReaderProvider;
      if (!switchableProvider(provider)) {
        res.status(400).json({request: {messageType}, error: "provider must be gmail-api or cloudflare-ingress"});
      } else {
        const memberId = requestMember(req).memberId ?? "api";
        const response = await applyInboxProviderSwitch(provider, memberId);
        res.json({request: {messageType}, response});
      }
    }
  } catch (error) {
    errorDebugLog("Error applying inbox provider switch:", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
}
