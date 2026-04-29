import {
  DestinationAddress,
  DestinationVerificationStatus,
  EmailRoutingActionType,
  EmailRoutingMatcherField,
  EmailRoutingMatcherType,
  EmailRoutingRule
} from "../../../../models/cloudflare-email-routing.model";
import { CommitteeMember } from "../../../../models/committee.model";
import {
  destinationVerificationStatusFor,
  multiRecipientVerificationDetails,
  resolveRouting,
  RoutingResolution,
  roleEmailFor
} from "./email-routing-view-resolver";

function literalRule(matcher: string, action: { type: EmailRoutingActionType; value: string[] }): EmailRoutingRule {
  return {
    id: `rule-${matcher}-${action.type}`,
    name: `rule for ${matcher}`,
    enabled: true,
    matchers: [{type: EmailRoutingMatcherType.LITERAL, field: EmailRoutingMatcherField.TO, value: matcher}],
    actions: [action]
  };
}

function forwardRule(matcher: string, target: string): EmailRoutingRule {
  return literalRule(matcher, {type: EmailRoutingActionType.FORWARD, value: [target]});
}

function workerRule(matcher: string, scriptName: string): EmailRoutingRule {
  return literalRule(matcher, {type: EmailRoutingActionType.WORKER, value: [scriptName]});
}

function catchAllForwardRule(target: string, enabled = true): EmailRoutingRule {
  return {
    id: "catch-all",
    name: "catch all",
    enabled,
    matchers: [{type: EmailRoutingMatcherType.ALL}],
    actions: [{type: EmailRoutingActionType.FORWARD, value: [target]}]
  };
}

function destination(email: string, verified: boolean): DestinationAddress {
  return {
    id: `dest-${email}`,
    email,
    verified: verified ? "2026-01-01T00:00:00Z" : "",
    created: "2026-01-01T00:00:00Z",
    modified: "2026-01-01T00:00:00Z",
    tag: ""
  };
}

describe("roleEmailFor", () => {
  it("returns null for null member", () => {
    expect(roleEmailFor(null, "ekwg.co.uk")).toBeNull();
  });

  it("returns the stored email when it ends with @baseDomain", () => {
    const member = {type: "walks-co-ordinator", email: "walks@ekwg.co.uk"} as CommitteeMember;
    expect(roleEmailFor(member, "ekwg.co.uk")).toBe("walks@ekwg.co.uk");
  });

  it("derives from type@baseDomain when stored email does not match the domain", () => {
    const member = {type: "walks-co-ordinator", email: "walks@old-domain.co.uk"} as CommitteeMember;
    expect(roleEmailFor(member, "ekwg.co.uk")).toBe("walks-co-ordinator@ekwg.co.uk");
  });

  it("derives from type@baseDomain when stored email is empty", () => {
    const member = {type: "chairman", email: ""} as CommitteeMember;
    expect(roleEmailFor(member, "ekwg.co.uk")).toBe("chairman@ekwg.co.uk");
  });

  it("returns null when neither stored email nor type are usable", () => {
    const member = {type: "", email: ""} as CommitteeMember;
    expect(roleEmailFor(member, "ekwg.co.uk")).toBeNull();
  });
});

describe("resolveRouting", () => {
  it("returns NONE for empty roleEmail", () => {
    const result = resolveRouting({roleEmail: null, rules: [], catchAllRule: null});
    expect(result.resolution).toBe(RoutingResolution.NONE);
    expect(result.matchingRule).toBeNull();
    expect(result.effectiveDestination).toBeNull();
  });

  it("returns NONE when no rules match and no catch-all is configured", () => {
    const result = resolveRouting({
      roleEmail: "chairman@ekwg.co.uk",
      rules: [forwardRule("treasurer@ekwg.co.uk", "treas@gmail.com")],
      catchAllRule: null
    });
    expect(result.resolution).toBe(RoutingResolution.NONE);
  });

  it("returns CATCH_ALL when no literal rule matches but a catch-all is enabled", () => {
    const result = resolveRouting({
      roleEmail: "chairman@ekwg.co.uk",
      rules: [],
      catchAllRule: catchAllForwardRule("nick@gmail.com")
    });
    expect(result.resolution).toBe(RoutingResolution.CATCH_ALL);
    expect(result.effectiveDestination).toBe("nick@gmail.com");
  });

  it("ignores catch-all when it is disabled", () => {
    const result = resolveRouting({
      roleEmail: "chairman@ekwg.co.uk",
      rules: [],
      catchAllRule: catchAllForwardRule("nick@gmail.com", false)
    });
    expect(result.resolution).toBe(RoutingResolution.NONE);
  });

  it("returns DIRECT when a literal rule matches the role email exactly", () => {
    const rule = forwardRule("walks@ekwg.co.uk", "kerry@yahoo.co.uk");
    const result = resolveRouting({
      roleEmail: "walks@ekwg.co.uk",
      rules: [rule],
      catchAllRule: catchAllForwardRule("nick@gmail.com")
    });
    expect(result.resolution).toBe(RoutingResolution.DIRECT);
    expect(result.matchingRule).toBe(rule);
    expect(result.effectiveDestination).toBe("kerry@yahoo.co.uk");
  });

  it("matches case-insensitively (matcher-side casing)", () => {
    const rule = forwardRule("WALKS@EKWG.CO.UK", "kerry@yahoo.co.uk");
    const result = resolveRouting({
      roleEmail: "walks@ekwg.co.uk",
      rules: [rule],
      catchAllRule: null
    });
    expect(result.resolution).toBe(RoutingResolution.DIRECT);
  });

  it("matches case-insensitively (roleEmail-side casing)", () => {
    const rule = forwardRule("walks@ekwg.co.uk", "kerry@yahoo.co.uk");
    const result = resolveRouting({
      roleEmail: "Walks@EKWG.co.uk",
      rules: [rule],
      catchAllRule: null
    });
    expect(result.resolution).toBe(RoutingResolution.DIRECT);
  });

  it("does not conflate sibling rules that forward to the same destination", () => {
    const ngxMembership = forwardRule("membership@ngx-ramblers.org.uk", "nick@gmail.com");
    const boltonMembership = forwardRule("membership@bolton.ngx-ramblers.org.uk", "nick@gmail.com");
    const result = resolveRouting({
      roleEmail: "membership@ngx-ramblers.org.uk",
      rules: [boltonMembership, ngxMembership],
      catchAllRule: null
    });
    expect(result.matchingRule).toBe(ngxMembership);
  });

  it("returns NONE for an unmatched roleEmail even when other rules forward to the same destination", () => {
    const result = resolveRouting({
      roleEmail: "chairman@ngx-ramblers.org.uk",
      rules: [forwardRule("membership@bolton.ngx-ramblers.org.uk", "nick@gmail.com")],
      catchAllRule: null
    });
    expect(result.resolution).toBe(RoutingResolution.NONE);
  });

  it("returns WORKER and the worker script name when the matching rule has a worker action", () => {
    const rule = workerRule("enquiries@ekwg.co.uk", "email-fwd-ekwg-co-uk-enquiries");
    const result = resolveRouting({
      roleEmail: "enquiries@ekwg.co.uk",
      rules: [rule],
      catchAllRule: null
    });
    expect(result.resolution).toBe(RoutingResolution.WORKER);
    expect(result.workerScriptName).toBe("email-fwd-ekwg-co-uk-enquiries");
    expect(result.effectiveDestination).toBeNull();
  });

  it("ignores rules whose matcher type is not LITERAL", () => {
    const allMatcher: EmailRoutingRule = {
      id: "rule-all",
      name: "all to gmail",
      enabled: true,
      matchers: [{type: EmailRoutingMatcherType.ALL}],
      actions: [{type: EmailRoutingActionType.FORWARD, value: ["nick@gmail.com"]}]
    };
    const result = resolveRouting({
      roleEmail: "walks@ekwg.co.uk",
      rules: [allMatcher],
      catchAllRule: null
    });
    expect(result.resolution).toBe(RoutingResolution.NONE);
  });
});

describe("destinationVerificationStatusFor", () => {
  it("returns null for empty email", () => {
    expect(destinationVerificationStatusFor("", [])).toBeNull();
    expect(destinationVerificationStatusFor(null, [])).toBeNull();
  });

  it("returns NOT_REGISTERED when the email is not in the destinations list", () => {
    expect(destinationVerificationStatusFor("nick@gmail.com", []))
      .toBe(DestinationVerificationStatus.NOT_REGISTERED);
  });

  it("returns VERIFIED when the destination is present and verified", () => {
    expect(destinationVerificationStatusFor("nick@gmail.com", [destination("nick@gmail.com", true)]))
      .toBe(DestinationVerificationStatus.VERIFIED);
  });

  it("returns PENDING when the destination is present but not verified", () => {
    expect(destinationVerificationStatusFor("nick@gmail.com", [destination("nick@gmail.com", false)]))
      .toBe(DestinationVerificationStatus.PENDING);
  });

  it("matches case-insensitively", () => {
    expect(destinationVerificationStatusFor("Nick@Gmail.com", [destination("nick@gmail.com", true)]))
      .toBe(DestinationVerificationStatus.VERIFIED);
  });
});

describe("multiRecipientVerificationDetails", () => {
  it("returns an entry per email with the matched status", () => {
    const result = multiRecipientVerificationDetails(
      ["a@gmail.com", "b@gmail.com", "c@gmail.com"],
      [destination("a@gmail.com", true), destination("b@gmail.com", false)]
    );
    expect(result.length).toBe(3);
    expect(result[0].email).toBe("a@gmail.com");
    expect(result[0].status).toBe(DestinationVerificationStatus.VERIFIED);
    expect(result[0].destinationAddress?.email).toBe("a@gmail.com");
    expect(result[1].email).toBe("b@gmail.com");
    expect(result[1].status).toBe(DestinationVerificationStatus.PENDING);
    expect(result[1].destinationAddress?.email).toBe("b@gmail.com");
    expect(result[2].email).toBe("c@gmail.com");
    expect(result[2].status).toBe(DestinationVerificationStatus.NOT_REGISTERED);
    expect(result[2].destinationAddress).toBeUndefined();
  });
});

