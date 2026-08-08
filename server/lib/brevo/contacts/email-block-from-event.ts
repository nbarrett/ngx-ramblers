import { BlockedContactReasonCode } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

export interface MailSubscriptionSlice {
  id: number;
  subscribed: boolean;
  unsubscribedAt?: number;
}

export function reasonCodeForBrevoBlockEvent(event: string): BlockedContactReasonCode {
  switch (event) {
    case "unsubscribed":
      return BlockedContactReasonCode.UNSUBSCRIBED_VIA_EMAIL;
    case "blocked":
      return BlockedContactReasonCode.ADMIN_BLOCKED;
    case "hard_bounce":
      return BlockedContactReasonCode.HARD_BOUNCE;
    case "spam":
    case "complaint":
      return BlockedContactReasonCode.CONTACT_FLAGGED_AS_SPAM;
    default:
      return BlockedContactReasonCode.ADMIN_BLOCKED;
  }
}

export function unsubscribeAllMailSubscriptions(
  subscriptions: MailSubscriptionSlice[] | undefined,
  blockedAt: number
): MailSubscriptionSlice[] {
  return (subscriptions ?? []).map(subscription =>
    subscription.subscribed
      ? {...subscription, subscribed: false, unsubscribedAt: blockedAt}
      : subscription
  );
}

export function mailSubscriptionsChanged(
  prior: MailSubscriptionSlice[] | undefined,
  next: MailSubscriptionSlice[] | undefined
): boolean {
  return JSON.stringify(prior ?? []) !== JSON.stringify(next ?? []);
}

export function isFirstTransitionToEmailBlock(existingEmailBlock: unknown): boolean {
  return !existingEmailBlock;
}
