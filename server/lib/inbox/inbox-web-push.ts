import debug from "debug";
import webpush from "web-push";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { InboxPushConfig, SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { envConfig } from "../env-config/env-config";
import { systemConfig } from "../config/system-config";
import * as config from "../mongo/controllers/config";
import { inboxPushSubscription as inboxPushSubscriptionModel } from "../mongo/models/inbox-push-subscription";
import { InboxPushSubscription } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { dateTimeNow } from "../shared/dates";
import { defaultTenantSlug } from "./inbox-aliases";

const debugLog = debug(envConfig.logNamespace("inbox-web-push"));
debugLog.enabled = true;
const errorDebugLog = debug("ERROR:" + envConfig.logNamespace("inbox-web-push"));
errorDebugLog.enabled = true;

const DEFAULT_VAPID_SUBJECT = "mailto:noreply@ngx-ramblers.org.uk";

export async function ensureVapidConfig(): Promise<InboxPushConfig> {
  const current: SystemConfig = await systemConfig();
  if (!current) {
    throw new Error("System configuration is not initialised; cannot generate VAPID keys");
  }
  if (current.inboxPush?.vapidPublicKey && current.inboxPush?.vapidPrivateKey) {
    return current.inboxPush;
  }
  const generated = webpush.generateVAPIDKeys();
  const inboxPush: InboxPushConfig = {
    vapidPublicKey: generated.publicKey,
    vapidPrivateKey: generated.privateKey,
    vapidSubject: current.inboxPush?.vapidSubject ?? DEFAULT_VAPID_SUBJECT
  };
  await config.createOrUpdateKey(ConfigKey.SYSTEM, {...current, inboxPush});
  debugLog("generated and persisted VAPID keys for inbox push");
  return inboxPush;
}

export async function vapidPublicKey(): Promise<string> {
  return (await ensureVapidConfig()).vapidPublicKey;
}

async function applyVapidDetails(inboxPush: InboxPushConfig): Promise<void> {
  webpush.setVapidDetails(inboxPush.vapidSubject || DEFAULT_VAPID_SUBJECT, inboxPush.vapidPublicKey, inboxPush.vapidPrivateKey);
}

export async function registerPushSubscription(memberId: string, endpoint: string, p256dh: string, auth: string, userAgent: string | null): Promise<void> {
  const now = dateTimeNow().toMillis();
  await inboxPushSubscriptionModel.findOneAndUpdate(
    {endpoint},
    {
      $set: {
        tenantSlug: defaultTenantSlug(),
        memberId,
        endpoint,
        p256dh,
        auth,
        userAgent: userAgent ?? null,
        lastSeenAt: now
      },
      $setOnInsert: {createdAt: now}
    },
    {upsert: true, new: true}
  );
  debugLog(`registered inbox push subscription for member ${memberId} (${endpoint.slice(0, 48)}...)`);
}

export async function unregisterPushSubscription(memberId: string, endpoint: string): Promise<void> {
  await inboxPushSubscriptionModel.deleteOne({memberId, endpoint});
  debugLog(`unregistered inbox push subscription for member ${memberId} (${endpoint.slice(0, 48)}...)`);
}

export interface InboxPushPayload {
  title: string;
  body: string;
  threadId: string;
  roleType: string;
}

export async function sendInboxPushToMember(memberId: string, payload: InboxPushPayload): Promise<number> {
  const inboxPush = await ensureVapidConfig();
  await applyVapidDetails(inboxPush);
  const subscriptions = await inboxPushSubscriptionModel.find({memberId, tenantSlug: defaultTenantSlug()}).lean() as InboxPushSubscription[];
  if (subscriptions.length === 0) {
    return 0;
  }
  const body = JSON.stringify(payload);
  const now = dateTimeNow().toMillis();
  const successCount = await subscriptions.reduce<Promise<number>>(async (acc, subscription) => {
    const accumulator = await acc;
    try {
      await webpush.sendNotification({endpoint: subscription.endpoint, keys: {p256dh: subscription.p256dh, auth: subscription.auth}}, body);
      await inboxPushSubscriptionModel.updateOne({_id: (subscription as unknown as {_id: unknown})._id}, {$set: {lastSeenAt: now}});
      return accumulator + 1;
    } catch (error) {
      const status = (error as {statusCode?: number}).statusCode;
      if (status === 404 || status === 410) {
        await inboxPushSubscriptionModel.deleteOne({_id: (subscription as unknown as {_id: unknown})._id});
        debugLog(`pruned expired inbox push subscription for member ${memberId}`);
      } else {
        errorDebugLog(`inbox push send failed for member ${memberId}: ${(error as Error).message}`);
      }
      return accumulator;
    }
  }, Promise.resolve(0));
  return successCount;
}
