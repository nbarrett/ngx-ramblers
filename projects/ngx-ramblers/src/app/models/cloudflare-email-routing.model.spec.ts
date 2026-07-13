import {
  EmailRoutingActionType,
  EmailRoutingMatcherType,
  EmailRoutingRule,
  sharedInboxRouterRuleActive,
  SHARED_INBOX_ROUTER_WORKER_NAME
} from "./cloudflare-email-routing.model";

describe("sharedInboxRouterRuleActive", () => {
  const rule: EmailRoutingRule = {
    name: "Catch-all",
    enabled: true,
    matchers: [{type: EmailRoutingMatcherType.ALL}],
    actions: [{type: EmailRoutingActionType.WORKER, value: [SHARED_INBOX_ROUTER_WORKER_NAME]}]
  };

  it("recognises an active shared inbox router catch-all", () => {
    expect(sharedInboxRouterRuleActive(rule)).toBe(true);
  });

  it("rejects a disabled shared inbox router catch-all", () => {
    expect(sharedInboxRouterRuleActive({...rule, enabled: false})).toBe(false);
  });

  it("rejects a different catch-all worker", () => {
    expect(sharedInboxRouterRuleActive({
      ...rule,
      actions: [{type: EmailRoutingActionType.WORKER, value: ["other-worker"]}]
    })).toBe(false);
  });
});
