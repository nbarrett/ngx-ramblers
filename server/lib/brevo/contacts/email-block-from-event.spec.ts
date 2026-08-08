import expect from "expect";
import { describe, it } from "mocha";
import { BlockedContactReasonCode } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import {
  isFirstTransitionToEmailBlock,
  mailSubscriptionsChanged,
  reasonCodeForBrevoBlockEvent,
  unsubscribeAllMailSubscriptions
} from "./email-block-from-event";

describe("email-block-from-event", () => {
  describe("reasonCodeForBrevoBlockEvent", () => {
    it("maps spam and complaint to contact flagged as spam", () => {
      expect(reasonCodeForBrevoBlockEvent("spam")).toEqual(BlockedContactReasonCode.CONTACT_FLAGGED_AS_SPAM);
      expect(reasonCodeForBrevoBlockEvent("complaint")).toEqual(BlockedContactReasonCode.CONTACT_FLAGGED_AS_SPAM);
    });

    it("maps unsubscribed to unsubscribed via email link", () => {
      expect(reasonCodeForBrevoBlockEvent("unsubscribed")).toEqual(BlockedContactReasonCode.UNSUBSCRIBED_VIA_EMAIL);
    });

    it("maps hard bounce and admin blocked", () => {
      expect(reasonCodeForBrevoBlockEvent("hard_bounce")).toEqual(BlockedContactReasonCode.HARD_BOUNCE);
      expect(reasonCodeForBrevoBlockEvent("blocked")).toEqual(BlockedContactReasonCode.ADMIN_BLOCKED);
    });
  });

  describe("unsubscribeAllMailSubscriptions", () => {
    it("clears every subscribed list even when Brevo list ids are empty", () => {
      const blockedAt = 1_700_000_000_000;
      const next = unsubscribeAllMailSubscriptions(
        [
          {id: 3, subscribed: true},
          {id: 4, subscribed: false, unsubscribedAt: 1},
          {id: 5, subscribed: true}
        ],
        blockedAt
      );
      expect(next).toEqual([
        {id: 3, subscribed: false, unsubscribedAt: blockedAt},
        {id: 4, subscribed: false, unsubscribedAt: 1},
        {id: 5, subscribed: false, unsubscribedAt: blockedAt}
      ]);
    });

    it("returns an empty array when there are no subscriptions", () => {
      expect(unsubscribeAllMailSubscriptions(undefined, 1)).toEqual([]);
      expect(unsubscribeAllMailSubscriptions([], 1)).toEqual([]);
    });
  });

  describe("mailSubscriptionsChanged", () => {
    it("detects when subscriptions were flipped off", () => {
      const prior = [{id: 3, subscribed: true}];
      const next = unsubscribeAllMailSubscriptions(prior, 99);
      expect(mailSubscriptionsChanged(prior, next)).toEqual(true);
      expect(mailSubscriptionsChanged(next, next)).toEqual(false);
    });
  });

  describe("isFirstTransitionToEmailBlock", () => {
    it("is true only when no prior emailBlock exists", () => {
      expect(isFirstTransitionToEmailBlock(undefined)).toEqual(true);
      expect(isFirstTransitionToEmailBlock(null)).toEqual(true);
      expect(isFirstTransitionToEmailBlock({reasonCode: "hardBounce"})).toEqual(false);
    });
  });
});
