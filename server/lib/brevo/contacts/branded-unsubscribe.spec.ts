import expect from "expect";
import { describe, it } from "mocha";
import { activeSubscribedCount, consentWritebackShouldFire } from "./branded-unsubscribe";

describe("branded-unsubscribe", () => {

  describe("activeSubscribedCount", () => {

    it("should count only entries flagged subscribed: true", () => {
      const subs = [
        { id: 1, subscribed: true },
        { id: 2, subscribed: false },
        { id: 3, subscribed: true },
      ];
      expect(activeSubscribedCount(subs)).toEqual(2);
    });

    it("should return zero for an empty list", () => {
      expect(activeSubscribedCount([])).toEqual(0);
    });

    it("should return zero when every entry is unsubscribed", () => {
      const subs = [
        { id: 1, subscribed: false },
        { id: 2, subscribed: false },
      ];
      expect(activeSubscribedCount(subs)).toEqual(0);
    });

    it("should ignore null entries defensively", () => {
      const subs = [
        { id: 1, subscribed: true },
        null as any,
        { id: 2, subscribed: true },
      ];
      expect(activeSubscribedCount(subs)).toEqual(2);
    });
  });

  describe("consentWritebackShouldFire", () => {

    it("should fire when the count transitions from non-zero to zero", () => {
      expect(consentWritebackShouldFire(1, 0)).toEqual(true);
      expect(consentWritebackShouldFire(3, 0)).toEqual(true);
    });

    it("should not fire when the member still has at least one active subscription", () => {
      expect(consentWritebackShouldFire(3, 2)).toEqual(false);
      expect(consentWritebackShouldFire(2, 1)).toEqual(false);
    });

    it("should not fire when the member already had no subscriptions before the click", () => {
      expect(consentWritebackShouldFire(0, 0)).toEqual(false);
    });

    it("should not fire on a no-op click that left the count unchanged", () => {
      expect(consentWritebackShouldFire(2, 2)).toEqual(false);
    });
  });
});
