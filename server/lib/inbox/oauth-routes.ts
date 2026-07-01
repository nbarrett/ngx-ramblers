import express, { Request, Response } from "express";
import mongoose from "mongoose";
import debug from "debug";
import { createErrorDebugLog } from "../shared/error-debug-log";
import crypto from "node:crypto";
import * as authConfig from "../auth/auth-config";
import { envConfig } from "../env-config/env-config";
import { errorResponse } from "../shared/error-response";
import { buildOauthConsentUrl, exchangeOauthCodeForAccessToken, exchangeOauthCodeForRefreshToken, resolveGoogleInboxOauth } from "./gmail-inbox-reader";
import { GOOGLE_CLOUD_SCOPES, GoogleInboxOauthStateKind, GoogleInboxSetupStatePayload, OauthAccessType, ProvisioningStepStatus, VerifiedGoogleInboxOauthState } from "./gmail-inbox.model";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { GoogleInboxConfig, SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { systemConfig } from "../config/system-config";
import * as config from "../mongo/controllers/config";
import { pushReceiverUrl } from "./inbox-push";
import { inboxMailboxConnection as inboxMailboxConnectionModel } from "../mongo/models/inbox-mailbox-connection";
import { InboxAliasConnectionStatus } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { dateTimeNow } from "../shared/dates";
import { AdminPath } from "../../../projects/ngx-ramblers/src/app/models/admin-route-paths.model";
import { isString } from "es-toolkit/compat";
import { encryptInboxRefreshToken } from "./inbox-oauth-token-crypto";
import { requireInboxConfigurationAdministrator } from "./inbox-access";
import { activateConnectionAfterReconnect } from "./inbox-poller";
import { beginGoogleCloudSetupStatus, completeGoogleCloudSetupStatus, currentGoogleCloudSetupStatus, failGoogleCloudSetupStatus, runGoogleCloudProvisioning } from "./inbox-google-setup";

const messageType = "inbox:oauth";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = true;
const errorDebugLog = createErrorDebugLog(messageType);

const STATE_TTL_MS = 10 * 60 * 1000;
const STATE_KIND_MAILBOX = "m";
const STATE_KIND_SETUP = "s";
const inboxSettingsPath = "/" + AdminPath.MAIL_SETTINGS + "?tab=inbox";

const router = express.Router();

function stateSecret(): string {
  return envConfig.auth().secret;
}

function projectNumberFromClientId(clientId: string): string | null {
  const match = (clientId ?? "").match(/^(\d+)-/);
  return match ? match[1] : null;
}

function signStateInternal(kindBody: string): string {
  const issuedAt = dateTimeNow().toMillis();
  const payload = `${kindBody}.${issuedAt}`;
  const signature = crypto.createHmac("sha256", stateSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}.${signature}`, "utf8").toString("base64url");
}

function signState(mailboxConnectionId: string): string {
  return signStateInternal(`${STATE_KIND_MAILBOX}:${mailboxConnectionId}`);
}

function signSetupState(payload: GoogleInboxSetupStatePayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return signStateInternal(`${STATE_KIND_SETUP}:${encoded}`);
}

function verifyState(state: string): VerifiedGoogleInboxOauthState | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 3) {
      return null;
    }
    const [kindBody, issuedAtRaw, signature] = parts;
    const expected = crypto.createHmac("sha256", stateSecret()).update(`${kindBody}.${issuedAtRaw}`).digest("hex");
    if (expected !== signature) {
      return null;
    }
    const issuedAt = parseInt(issuedAtRaw, 10);
    if (Number.isNaN(issuedAt) || dateTimeNow().toMillis() - issuedAt > STATE_TTL_MS) {
      return null;
    }
    const colonIndex = kindBody.indexOf(":");
    if (colonIndex < 0) {
      return null;
    }
    const kind = kindBody.substring(0, colonIndex);
    const body = kindBody.substring(colonIndex + 1);
    if (kind === STATE_KIND_MAILBOX) {
      return {kind: GoogleInboxOauthStateKind.MAILBOX, mailboxConnectionId: body, issuedAt};
    }
    if (kind === STATE_KIND_SETUP) {
      const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as GoogleInboxSetupStatePayload;
      return {kind: GoogleInboxOauthStateKind.SETUP, payload, issuedAt};
    }
    return null;
  } catch (error) {
    errorDebugLog("Invalid state token:", (error as Error).message);
    return null;
  }
}

router.get("/start", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    if (!requireInboxConfigurationAdministrator(req, res)) {
      return;
    }
    const mailboxConnectionId = req.query.mailboxConnectionId;
    if (!isString(mailboxConnectionId) || mailboxConnectionId.length === 0 || !mongoose.isValidObjectId(mailboxConnectionId)) {
      res.status(400).json({request: {messageType}, error: "A valid mailboxConnectionId query parameter is required"});
      return;
    }
    const connection = await inboxMailboxConnectionModel.findOne({
      _id: mailboxConnectionId,
      tenantSlug: envConfig.value("APP_NAME" as never) ?? "default"
    });
    if (!connection) {
      res.status(404).json({request: {messageType}, error: `No Gmail inbox mailbox connection with id ${mailboxConnectionId}`});
      return;
    }
    const oauth = await resolveGoogleInboxOauth();
    if (!oauth.configured) {
      res.status(400).json({request: {messageType}, error: "Google Inbox OAuth client is not configured. Set the Client ID, Client Secret and Redirect URI in System Settings > External Systems > Gmail Inbox API before connecting a mailbox."});
      return;
    }
    const state = signState(mailboxConnectionId);
    const consentUrl = await buildOauthConsentUrl(state);
    debugLog(`generated consent URL for Gmail inbox mailbox ${mailboxConnectionId}`);
    res.json({request: {messageType}, response: {consentUrl}});
  } catch (error) {
    errorDebugLog("Error generating consent URL:", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

router.get("/callback", async (req: Request, res: Response) => {
  try {
    const code = req.query.code;
    const state = req.query.state;
    const errorParam = req.query.error;
    if (isString(errorParam) && errorParam.length > 0) {
      res.redirect(`${inboxSettingsPath}&oauthError=${encodeURIComponent(errorParam)}`);
      return;
    }
    if (!isString(code) || !isString(state)) {
      res.status(400).send("Missing code or state in OAuth callback");
      return;
    }
    const verified = verifyState(state);
    if (!verified) {
      res.status(400).send("OAuth state token is invalid or expired");
      return;
    }
    if (verified.kind === GoogleInboxOauthStateKind.SETUP && verified.payload) {
      const {accessToken} = await exchangeOauthCodeForAccessToken(code);
      await beginGoogleCloudSetupStatus(verified.payload.projectId, verified.payload.topicName);
      void runGoogleCloudSetupJob(accessToken, verified.payload);
      res.redirect(`${inboxSettingsPath}&setupStarted=1`);
      return;
    }
    if (!verified.mailboxConnectionId) {
      res.status(400).send("OAuth state token is missing a mailbox connection");
      return;
    }
    const {refreshToken, emailAddress} = await exchangeOauthCodeForRefreshToken(code);
    await inboxMailboxConnectionModel.updateOne({_id: verified.mailboxConnectionId}, {
      $set: {
        gmailAccountEmail: emailAddress,
        oauthRefreshTokenEncrypted: encryptInboxRefreshToken(refreshToken),
        connectionStatus: InboxAliasConnectionStatus.CONNECTED,
        lastErrorMessage: null,
        lastHistoryId: null,
        updatedAt: dateTimeNow().toMillis(),
        updatedBy: "google-oauth-callback"
      }
    });
    debugLog(`stored encrypted refresh token for Gmail inbox mailbox ${verified.mailboxConnectionId} (${emailAddress})`);
    void activateConnectionAfterReconnect(verified.mailboxConnectionId)
      .catch(activateError => errorDebugLog("Failed to activate inbox connection after reconnect:", (activateError as Error).message));
    res.redirect(`${inboxSettingsPath}&connected=${encodeURIComponent(emailAddress)}`);
  } catch (error) {
    errorDebugLog("Error completing OAuth callback:", (error as Error).message);
    res.redirect(`${inboxSettingsPath}&oauthError=${encodeURIComponent((error as Error).message)}`);
  }
});

router.post("/setup/start", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    if (!requireInboxConfigurationAdministrator(req, res)) {
      return;
    }
    const topicName = (req.body?.topicName ?? "").toString().trim() || "ngx-inbox-events";
    const subscriptionName = ((req.body?.subscriptionName ?? "") as string).toString().trim() || undefined;
    const oauth = await resolveGoogleInboxOauth();
    if (!oauth.configured) {
      res.status(400).json({request: {messageType}, error: "Configure the Google OAuth client (ID, Secret, Redirect URI) before running the Google Cloud setup."});
      return;
    }
    const projectId = (req.body?.projectId ?? "").toString().trim() || projectNumberFromClientId(oauth.clientId) || "";
    if (!projectId) {
      res.status(400).json({request: {messageType}, error: "Could not determine the Google Cloud project from the OAuth Client ID. Set the Client ID first, or supply a project ID."});
      return;
    }
    const state = signSetupState({projectId, topicName, subscriptionName});
    const consentUrl = await buildOauthConsentUrl(state, {scopes: GOOGLE_CLOUD_SCOPES, accessType: OauthAccessType.ONLINE, includeGrantedScopes: true});
    debugLog(`generated Google Cloud setup consent URL for project ${projectId}, topic ${topicName}`);
    res.json({request: {messageType}, response: {consentUrl}});
  } catch (error) {
    errorDebugLog("Error generating Google Cloud setup consent URL:", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

async function runGoogleCloudSetupJob(accessToken: string, payload: GoogleInboxSetupStatePayload): Promise<void> {
  try {
    const receiverUrl = await pushReceiverUrl();
    if (!receiverUrl) {
      await failGoogleCloudSetupStatus("Cannot derive the NGX push receiver URL — ensure the Google Inbox OAuth redirect URI is configured");
      return;
    }
    const result = await runGoogleCloudProvisioning(accessToken, {
      projectId: payload.projectId,
      topicName: payload.topicName,
      subscriptionName: payload.subscriptionName,
      pushReceiverUrl: receiverUrl
    });
    const anyStepFailed = result.steps.some(step => step.status === ProvisioningStepStatus.FAILED);
    const current: SystemConfig = await systemConfig();
    if (current && !anyStepFailed) {
      const googleInbox: GoogleInboxConfig = {
        clientId: current.googleInbox?.clientId ?? "",
        clientSecret: current.googleInbox?.clientSecret ?? "",
        redirectUri: current.googleInbox?.redirectUri ?? "",
        pushVerificationToken: current.googleInbox?.pushVerificationToken,
        pubsubProjectId: result.projectId,
        pubsubTopicName: result.topicFullName,
        pubsubSubscriptionName: result.subscriptionFullName
      };
      await config.createOrUpdateKey(ConfigKey.SYSTEM, {...current, googleInbox});
    }
    await completeGoogleCloudSetupStatus(result);
    debugLog(`Google Cloud setup complete: project ${result.projectId}, topic ${result.topicFullName}, subscription ${result.subscriptionFullName}`);
  } catch (error) {
    errorDebugLog("Google Cloud setup job failed:", (error as Error).message);
    await failGoogleCloudSetupStatus((error as Error).message).catch(statusError => errorDebugLog("Could not persist setup failure:", (statusError as Error).message));
  }
}

router.get("/setup/status", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    if (!requireInboxConfigurationAdministrator(req, res)) {
      return;
    }
    const status = await currentGoogleCloudSetupStatus();
    res.json({request: {messageType}, response: status});
  } catch (error) {
    errorDebugLog("Error reading Google Cloud setup status:", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

export const inboxOauthRoutes = router;
