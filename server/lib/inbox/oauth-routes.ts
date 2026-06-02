import express, { Request, Response } from "express";
import mongoose from "mongoose";
import debug from "debug";
import { createErrorDebugLog } from "../shared/error-debug-log";
import crypto from "node:crypto";
import * as authConfig from "../auth/auth-config";
import { envConfig } from "../env-config/env-config";
import { errorResponse } from "../shared/error-response";
import { buildOauthConsentUrl, exchangeOauthCodeForAccessToken, exchangeOauthCodeForRefreshToken, resolveGoogleInboxOauth } from "./gmail-inbox-reader";
import { GOOGLE_CLOUD_SCOPES, GoogleInboxOauthStateKind, GoogleInboxSetupStatePayload, OauthAccessType, VerifiedGoogleInboxOauthState } from "./gmail-inbox.model";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { GoogleInboxConfig, SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { systemConfig } from "../config/system-config";
import * as config from "../mongo/controllers/config";
import { pushReceiverUrl } from "./inbox-push";
import { inboxMailboxConnection as inboxMailboxConnectionModel } from "../mongo/models/inbox-mailbox-connection";
import { InboxAliasConnectionStatus } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { dateTimeNow } from "../shared/dates";
import { isString } from "es-toolkit/compat";
import { encryptInboxRefreshToken } from "./inbox-oauth-token-crypto";
import { requireInboxConfigurationAdministrator } from "./inbox-access";

const messageType = "inbox:oauth";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = true;
const errorDebugLog = createErrorDebugLog(messageType);

const STATE_TTL_MS = 10 * 60 * 1000;
const STATE_KIND_MAILBOX = "m";
const STATE_KIND_SETUP = "s";
const inboxSettingsPath = "/admin/system-settings?tab=external-systems&sub-tab=mail";

const router = express.Router();

function stateSecret(): string {
  return envConfig.auth().secret;
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
      const result = await completeGoogleCloudSetup(code, verified.payload);
      const summary = encodeURIComponent(`Project ${result.projectId}, topic ${result.topicFullName}`);
      res.redirect(`${inboxSettingsPath}&setupCompleted=${summary}`);
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
        updatedAt: dateTimeNow().toMillis(),
        updatedBy: "google-oauth-callback"
      }
    });
    debugLog(`stored encrypted refresh token for Gmail inbox mailbox ${verified.mailboxConnectionId} (${emailAddress})`);
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
    const projectId = (req.body?.projectId ?? "").toString().trim();
    const topicName = (req.body?.topicName ?? "").toString().trim();
    const subscriptionName = ((req.body?.subscriptionName ?? "") as string).toString().trim() || undefined;
    if (!projectId) {
      res.status(400).json({request: {messageType}, error: "projectId is required"});
      return;
    }
    if (!topicName) {
      res.status(400).json({request: {messageType}, error: "topicName is required"});
      return;
    }
    const oauth = await resolveGoogleInboxOauth();
    if (!oauth.configured) {
      res.status(400).json({request: {messageType}, error: "Configure the Google OAuth client (ID, Secret, Redirect URI) before running the Google Cloud setup."});
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

async function completeGoogleCloudSetup(code: string, payload: GoogleInboxSetupStatePayload) {
  const {accessToken} = await exchangeOauthCodeForAccessToken(code);
  const receiverUrl = await pushReceiverUrl();
  if (!receiverUrl) {
    throw new Error("Cannot derive the NGX push receiver URL — ensure the Google Inbox OAuth redirect URI is configured");
  }
  const {runGoogleCloudProvisioning} = await import("./inbox-google-setup");
  const result = await runGoogleCloudProvisioning(accessToken, {
    projectId: payload.projectId,
    topicName: payload.topicName,
    subscriptionName: payload.subscriptionName,
    pushReceiverUrl: receiverUrl
  });
  const current: SystemConfig = await systemConfig();
  if (current) {
    const googleInbox: GoogleInboxConfig = {
      clientId: current.googleInbox?.clientId ?? "",
      clientSecret: current.googleInbox?.clientSecret ?? "",
      redirectUri: current.googleInbox?.redirectUri ?? "",
      pushVerificationToken: current.googleInbox?.pushVerificationToken,
      pubsubProjectId: payload.projectId,
      pubsubTopicName: result.topicFullName,
      pubsubSubscriptionName: result.subscriptionFullName
    };
    await config.createOrUpdateKey(ConfigKey.SYSTEM, {...current, googleInbox});
  }
  debugLog(`Google Cloud setup complete: project ${result.projectId}, topic ${result.topicFullName}, subscription ${result.subscriptionFullName}`);
  return result;
}

export const inboxOauthRoutes = router;
