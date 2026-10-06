import {
  AddressRuleKind,
  addressRuleKind,
  EmailRoutingActionType,
  EmailRoutingMatcherField,
  EmailRoutingMatcherType,
  EmailRoutingRule,
  emailRoutingRuleAddress,
  emailRoutingRuleIdentifier,
  isLiteralDomainAddressRule,
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

describe("literal domain address rules", () => {
  const workerRule: EmailRoutingRule = {
    tag: "rule-tag-1",
    name: "Inbox chair@group.example.org.uk",
    enabled: true,
    matchers: [{
      type: EmailRoutingMatcherType.LITERAL,
      field: EmailRoutingMatcherField.TO,
      value: "chair@group.example.org.uk"
    }],
    actions: [{type: EmailRoutingActionType.WORKER, value: [SHARED_INBOX_ROUTER_WORKER_NAME]}]
  };

  it("uses tag when id is missing", () => {
    expect(emailRoutingRuleIdentifier(workerRule)).toBe("rule-tag-1");
  });

  it("reads the literal To address", () => {
    expect(emailRoutingRuleAddress(workerRule)).toBe("chair@group.example.org.uk");
  });

  it("matches a worker address rule on the site domain", () => {
    expect(isLiteralDomainAddressRule(workerRule, "group.example.org.uk")).toBe(true);
  });

  it("does not treat the catch-all as an address rule", () => {
    expect(isLiteralDomainAddressRule({
      name: "Catch-all",
      enabled: true,
      matchers: [{type: EmailRoutingMatcherType.ALL}],
      actions: [{type: EmailRoutingActionType.WORKER, value: [SHARED_INBOX_ROUTER_WORKER_NAME]}]
    }, "group.example.org.uk")).toBe(false);
  });

  it("matches when the matcher has no field", () => {
    expect(isLiteralDomainAddressRule({
      ...workerRule,
      matchers: [{type: EmailRoutingMatcherType.LITERAL, value: "chair@group.example.org.uk"}]
    }, "group.example.org.uk")).toBe(true);
  });

  it("treats www and the apex as the same domain", () => {
    expect(isLiteralDomainAddressRule(workerRule, "www.group.example.org.uk")).toBe(true);
  });

  it("classifies an inbox-router rule separately from a mailbox forward", () => {
    expect(addressRuleKind(workerRule)).toBe(AddressRuleKind.INBOX_ROUTER);
    expect(addressRuleKind({
      ...workerRule,
      actions: [{type: EmailRoutingActionType.FORWARD, value: ["alex.reed@example.com"]}]
    })).toBe(AddressRuleKind.MAILBOX_FORWARD);
  });
});
