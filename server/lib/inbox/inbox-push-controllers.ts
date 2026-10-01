import { InboxPubsubNotification } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { Request, Response } from "express";
import debug from "debug";
import { createErrorDebugLog } from "../shared/error-debug-log";
import { isString } from "es-toolkit/compat";
import { envConfig } from "../env-config/env-config";
import { errorResponse } from "../shared/error-response";
import { inboxMailboxConnection as inboxMailboxConnectionModel } from "../mongo/models/inbox-mailbox-connection";
import { InboxMailboxConnection, InboxPushConfigResponse, InboxPushSubscribeRequest, InboxPushVapidPublicKeyResponse, InboxSyncMode } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { MemberCookie } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { requireInboxConfigurationAdministrator, requestMember } from "./inbox-access";
import { defaultTenantSlug } from "./inbox-aliases";
import { syncConnectionCoalesced } from "./inbox-poller";
import { ensurePushVerificationToken, pushReceiverUrl, pushVerificationToken } from "./inbox-push";
import { registerPushSubscription, unregisterPushSubscription, vapidPublicKey } from "./inbox-web-push";
import * as systemConfig from "../config/system-config";
const messageType = "inbox";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = true;
const errorDebugLog = createErrorDebugLog(messageType);
export async function readPubsubPushConfig(req: Request, res: Response): Promise<void> {
  try {
    if (requireInboxConfigurationAdministrator(req, res)) {
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
      res.json({ request: { messageType }, response });
    }
  }
  catch (error) {
    errorDebugLog("Error resolving inbox push config:", (error as Error).message);
    res.status(500).json({ request: { messageType }, error: errorResponse(error) });
  }
}
export async function receivePubsubPush(req: Request, res: Response): Promise<void> {
  try {
    const expectedToken = await pushVerificationToken();
    if (!expectedToken || req.query.token !== expectedToken) {
      res.status(401).json({ request: { messageType }, error: "Invalid push verification token" });
    }
    else {
      const emailAddress = decodePushNotification(req.body)?.emailAddress;
      res.status(204).end();
      if (!emailAddress) {
        debugLog("inbox push: notification without an emailAddress, ignoring");
      }
      else {
        const connection = await inboxMailboxConnectionModel.findOne({
          tenantSlug: defaultTenantSlug(),
          gmailAccountEmail: emailAddress,
          enabled: true,
          syncMode: InboxSyncMode.WATCH
        }).lean() as InboxMailboxConnection | null;
        if (!connection?.oauthRefreshTokenEncrypted) {
          debugLog("inbox push: no push-enabled connection for", emailAddress);
        }
        else {
          syncConnectionCoalesced(connection);
        }
      }
    }
  }
  catch (error) {
    errorDebugLog("Error handling inbox push notification:", (error as Error).message);
    if (!res.headersSent) {
      res.status(204).end();
    }
  }
}
export async function readPushPublicKey(req: Request, res: Response): Promise<void> {
  try {
    const key = await vapidPublicKey();
    const response: InboxPushVapidPublicKeyResponse = { vapidPublicKey: key };
    res.json({ request: { messageType }, response });
  }
  catch (error) {
    errorDebugLog("Error returning VAPID public key:", (error as Error).message);
    res.status(500).json({ request: { messageType }, error: errorResponse(error) });
  }
}
export async function subscribeInboxPush(req: Request, res: Response): Promise<void> {
  try {
    const memberId = requestMember(req).memberId;
    if (!memberId) {
      res.status(401).json({ request: { messageType }, error: "Sign in before subscribing to inbox push notifications" });
    }
    else {
      const subscriptionRequest = req.body as InboxPushSubscribeRequest;
      if (!isString(subscriptionRequest?.endpoint) || !isString(subscriptionRequest?.keys?.p256dh) || !isString(subscriptionRequest?.keys?.auth)) {
        res.status(400).json({ request: { messageType }, error: "Push subscription payload is missing endpoint or keys" });
      }
      else {
        await registerPushSubscription(memberId, subscriptionRequest.endpoint, subscriptionRequest.keys.p256dh, subscriptionRequest.keys.auth, subscriptionRequest.userAgent ?? null);
        res.json({ request: { messageType }, response: { subscribed: true } });
      }
    }
  }
  catch (error) {
    errorDebugLog("Error registering inbox push subscription:", (error as Error).message);
    res.status(500).json({ request: { messageType }, error: errorResponse(error) });
  }
}
export async function unsubscribeInboxPush(req: Request, res: Response): Promise<void> {
  try {
    const memberId = requestMember(req).memberId;
    if (!memberId) {
      res.status(401).json({ request: { messageType }, error: "Sign in before changing inbox push subscriptions" });
    }
    else {
      const endpoint = req.body?.endpoint;
      if (!isString(endpoint)) {
        res.status(400).json({ request: { messageType }, error: "Pass the push subscription endpoint to remove" });
      }
      else {
        await unregisterPushSubscription(memberId, endpoint);
        res.json({ request: { messageType }, response: { subscribed: false } });
      }
    }
  }
  catch (error) {
    errorDebugLog("Error removing inbox push subscription:", (error as Error).message);
    res.status(500).json({ request: { messageType }, error: errorResponse(error) });
  }
}
function decodePushNotification(body: any): InboxPubsubNotification | null {
  const data = body?.message?.data;
  if (!isString(data)) {
    return null;
  }
  else {
    try {
      return JSON.parse(Buffer.from(data, "base64").toString("utf8"));
    }
    catch (parseError) {
      errorDebugLog("inbox push: could not decode notification payload:", (parseError as Error).message);
      return null;
    }
  }
}
