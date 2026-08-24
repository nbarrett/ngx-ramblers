import expect from "expect";
import { describe, it } from "mocha";
import { InboxAliasConfig } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { aliasesByRoleEmail, configuredRoleTypeSet, isOrphanedRoleType, proposedTargetFromInbound, remapCandidatesFrom } from "./inbox-orphaned-threads";

function alias(roleType: string, roleEmail: string, enabled = true): InboxAliasConfig {
  return {
    id: roleType,
    tenantSlug: "default",
    roleType,
    roleEmail,
    additionalEmails: [],
    mailboxConnectionId: "conn-1",
    enabled,
    inboxMessageNotifications: false,
    inboxNotificationEmail: null,
    memberId: null,
    recipients: [],
    recipientsFromRoleType: null
  };
}

const aliases: InboxAliasConfig[] = [
  alias("treasury", "treasury@example.org"),
  alias("walks-co-ordinator", "walks@example.org"),
  alias("_general_abc", "office@example.org"),
  alias("disabled-role", "disabled@example.org", false)
];

describe("configuredRoleTypeSet", () => {
  it("collects every alias role type", () => {
    const set = configuredRoleTypeSet(aliases);
    expect(set.has("treasury")).toBe(true);
    expect(set.has("_general_abc")).toBe(true);
    expect(set.has("support-representative")).toBe(false);
  });
});

describe("isOrphanedRoleType", () => {
  it("treats a role type absent from the configured set as orphaned", () => {
    const set = configuredRoleTypeSet(aliases);
    expect(isOrphanedRoleType("support-representative", set)).toBe(true);
    expect(isOrphanedRoleType("treasury", set)).toBe(false);
  });
});

describe("proposedTargetFromInbound", () => {
  const byEmail = aliasesByRoleEmail(aliases);

  it("proposes the mailbox the inbound message was addressed to", () => {
    const proposal = proposedTargetFromInbound([{to: [{name: null, email: "Treasury@example.org"}]}], byEmail);
    expect(proposal?.roleType).toEqual("treasury");
  });

  it("proposes the general mailbox when the message was addressed to the office catch-all", () => {
    const proposal = proposedTargetFromInbound([{to: [{name: null, email: "office@example.org"}]}], byEmail);
    expect(proposal?.roleType).toEqual("_general_abc");
  });

  it("returns null when no inbound recipient matches a configured mailbox", () => {
    const proposal = proposedTargetFromInbound([{to: [{name: null, email: "stranger@example.org"}]}], byEmail);
    expect(proposal).toBeNull();
  });

  it("returns null when there are no inbound messages to learn from", () => {
    expect(proposedTargetFromInbound([], byEmail)).toBeNull();
  });

  it("prefers the first matching recipient across messages", () => {
    const proposal = proposedTargetFromInbound([
      {to: [{name: null, email: "stranger@example.org"}]},
      {to: [{name: null, email: "walks@example.org"}]}
    ], byEmail);
    expect(proposal?.roleType).toEqual("walks-co-ordinator");
  });
});

describe("remapCandidatesFrom", () => {
  it("offers only enabled mailboxes as remap targets", () => {
    const candidates = remapCandidatesFrom(aliases);
    expect(candidates.map(candidate => candidate.roleType)).toEqual(["treasury", "walks-co-ordinator", "_general_abc"]);
  });
});
