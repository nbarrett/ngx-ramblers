import expect from "expect";
import { describe, it } from "mocha";
import { bounceTypeForBrevoEvent, salesforceBounceRetryable } from "./salesforce-bounce";

describe("bounceTypeForBrevoEvent", () => {
  it("maps hard and soft Brevo bounces to the published values", () => {
    expect(bounceTypeForBrevoEvent("hard_bounce")).toEqual("Hard");
    expect(bounceTypeForBrevoEvent("soft_bounce")).toEqual("Soft");
  });

  it("does not report unrelated Brevo events", () => {
    expect(bounceTypeForBrevoEvent("blocked")).toBeNull();
  });
});

describe("salesforceBounceRetryable", () => {
  it("retries network, rate-limit and server failures", () => {
    expect(salesforceBounceRetryable({ status: 0, latencyMs: 1 })).toBe(true);
    expect(salesforceBounceRetryable({ status: 429, latencyMs: 1 })).toBe(true);
    expect(salesforceBounceRetryable({ status: 503, latencyMs: 1 })).toBe(true);
  });

  it("does not retry a permanent request failure", () => {
    expect(salesforceBounceRetryable({ status: 400, latencyMs: 1 })).toBe(false);
  });
});
