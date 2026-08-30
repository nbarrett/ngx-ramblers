import expect from "expect";
import { describe, it } from "mocha";
import { RedirectPlaceholderPlan } from "./cloudflare.model";
import { redirectPlaceholderPlan } from "./redirect-placeholder";

describe("redirectPlaceholderPlan", () => {

  it("should replace a leftover DNS-only CNAME so the Cloudflare redirect can fire", () => {
    const plan = redirectPlaceholderPlan([
      { type: "CNAME", proxied: false }
    ]);
    expect(plan).toEqual(RedirectPlaceholderPlan.REPLACE_DNS_ONLY_CNAME);
  });

  it("should leave a proxied CNAME alone", () => {
    const plan = redirectPlaceholderPlan([
      { type: "CNAME", proxied: true }
    ]);
    expect(plan).toEqual(RedirectPlaceholderPlan.LEAVE_PROXIED_CNAME);
  });

  it("should create a placeholder when there is no address record", () => {
    const plan = redirectPlaceholderPlan([]);
    expect(plan).toEqual(RedirectPlaceholderPlan.CREATE_PLACEHOLDER);
  });

  it("should proxy an existing DNS-only A record", () => {
    const plan = redirectPlaceholderPlan([
      { type: "A", proxied: false }
    ]);
    expect(plan).toEqual(RedirectPlaceholderPlan.PROXY_EXISTING_A);
  });

  it("should leave a proxied A record alone", () => {
    const plan = redirectPlaceholderPlan([
      { type: "A", proxied: true }
    ]);
    expect(plan).toEqual(RedirectPlaceholderPlan.LEAVE_PROXIED_A);
  });
});
