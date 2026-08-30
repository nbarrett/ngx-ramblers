import { describe, expect, it } from "vitest";
import {
  additionalEmailsFromMailboxList,
  applyCommitteeRoleDefaultSender,
  CommitteeMailboxKind,
  CommitteeMember,
  committeeMailboxKind,
  committeeRoleMatchingEmail,
  RoleType,
  roleEmailAddresses
} from "../models/committee.model";
import { ComposerSenderKind } from "../models/email-composer.model";
import { composerSenderIdentities } from "./email-composer";
import {
  committeeAssignedEmailsForMemberId,
  committeeAssignedMailboxGroupsForMemberId,
  committeeMembersSettingsQueryParams,
  committeeMemberTrackKey,
  committeeOutboundEmailQueryParams,
  committeeRoleEmailDiffersFromPersonal,
  committeeRoleForMemberId,
  committeeRoleList,
  memberHoldsCommitteeRole,
  memberRecordId,
  outboundEmailForMember,
  outboundEmailForRecipient,
  uniqueCommitteeMembersByType
} from "./committee-members";

function member(type: string, fullName: string, memberId?: string) {
  return {type, fullName, email: `${type}@example.com`, description: type, roleType: RoleType.COMMITTEE_MEMBER, memberId};
}

describe("uniqueCommitteeMembersByType", () => {

  it("keeps the first role when two members share a type", () => {
    const unique = uniqueCommitteeMembersByType([
      member("support", "Tom"),
      member("chair", "Liz"),
      member("support", "Nick", "nick-id")
    ]);
    expect(unique.map(role => role.fullName)).toEqual(["Tom", "Liz"]);
  });
});

describe("committeeMembersSettingsQueryParams", () => {

  it("opens the role outbound email tab when a single role type is given", () => {
    expect(committeeMembersSettingsQueryParams("ngx-project-lead")).toEqual(committeeOutboundEmailQueryParams("ngx-project-lead"));
  });

  it("opens the committee members tab when no single role applies", () => {
    expect(committeeMembersSettingsQueryParams(null)).toEqual({tab: "committee-members"});
  });
});

describe("committeeRoleList", () => {

  it("joins role descriptions with commas", () => {
    expect(committeeRoleList([
      {roleType: "ngx-project-lead", roleDescription: "NGX Project Lead", fullName: "Nick", addresses: []},
      {roleType: "treasurer", roleDescription: "Treasurer", fullName: "Sam", addresses: []}
    ])).toEqual("NGX Project Lead, Treasurer");
  });
});

describe("additionalEmailsFromMailboxList", () => {

  it("stores every address except the default sender so the list survives a reload", () => {
    expect(additionalEmailsFromMailboxList([
      "member.one@ngx-ramblers.org.uk",
      "system-administrator@ngx-ramblers.org.uk",
      "ngx-project-lead@ngx-ramblers.org.uk"
    ], "member.one@ngx-ramblers.org.uk")).toEqual([
      "system-administrator@ngx-ramblers.org.uk",
      "ngx-project-lead@ngx-ramblers.org.uk"
    ]);
    expect(additionalEmailsFromMailboxList([
      "member.one@ngx-ramblers.org.uk",
      "system-administrator@ngx-ramblers.org.uk",
      "ngx-project-lead@ngx-ramblers.org.uk"
    ], "member.one@ngx-ramblers.org.uk", ["system-administrator@ngx-ramblers.org.uk"])).toEqual([
      "ngx-project-lead@ngx-ramblers.org.uk"
    ]);
  });

});

describe("composerSenderIdentities", () => {

  it("lists contact email then each committee address assigned to the member", () => {
    const chairman = member("chairman", "Liz Chair", "liz-id");
    const identities = composerSenderIdentities({
      contactEmail: "liz@gmail.com",
      contactName: "Liz Chair",
      roles: [chairman],
      memberId: "liz-id"
    });
    expect(identities[0]).toEqual({
      kind: ComposerSenderKind.CONTACT,
      email: "liz@gmail.com",
      name: "Liz Chair",
      label: "Contact email <liz@gmail.com>",
      roleType: null
    });
    expect(identities.some(identity => identity.email === "chairman@example.com" && identity.kind === ComposerSenderKind.COMMITTEE_ROLE)).toEqual(true);
  });

  it("does not duplicate the contact email when it is already a committee address", () => {
    const chairman = member("chairman", "Liz Chair", "liz-id");
    const identities = composerSenderIdentities({
      contactEmail: "chairman@example.com",
      contactName: "Liz Chair",
      roles: [chairman],
      memberId: "liz-id"
    });
    expect(identities.filter(identity => identity.email.toLowerCase() === "chairman@example.com")).toHaveLength(1);
  });
});

describe("committeeMemberTrackKey", () => {

  it("distinguishes two members who share a role type", () => {
    const tom = member("support", "Tom", "tom-id");
    const nick = member("support", "Nick", "nick-id");
    expect(committeeMemberTrackKey(tom)).not.toEqual(committeeMemberTrackKey(nick));
  });
});

describe("outboundEmailForMember", () => {

  const chairman = member("chairman", "Liz Chair", "liz-id");
  const walks = member("walks", "Sam Walks", "sam-id");
  const vacant = {...member("secretary", "Nobody"), memberId: "empty-id", email: ""};

  it("uses the role address when the member holds a role with an email", () => {
    expect(outboundEmailForMember({id: "liz-id", email: "liz@gmail.com"}, [chairman, walks])).toEqual("chairman@example.com");
  });

  it("reads the mongo id rather than member.memberId on the member record", () => {
    expect(memberRecordId({id: "liz-id", memberId: undefined})).toEqual("liz-id");
    expect(committeeRoleForMemberId([chairman], "liz-id")?.type).toEqual("chairman");
  });

  it("falls back to the personal address when they hold no role", () => {
    expect(outboundEmailForMember({id: "walker-id", email: "walker@gmail.com"}, [chairman])).toEqual("walker@gmail.com");
  });

  it("falls back to the personal address when the role has no email", () => {
    expect(outboundEmailForMember({id: "empty-id", email: "secretary@gmail.com"}, [vacant])).toEqual("secretary@gmail.com");
  });

  it("uses the first role that has an email when the member holds more than one", () => {
    const second = member("treasurer", "Liz Chair", "liz-id");
    expect(outboundEmailForMember({id: "liz-id", email: "liz@gmail.com"}, [chairman, second])).toEqual("chairman@example.com");
  });

  it("is true only when the role address is different from the personal address", () => {
    expect(committeeRoleEmailDiffersFromPersonal({id: "liz-id", email: "liz@gmail.com"}, [chairman])).toEqual(true);
    expect(committeeRoleEmailDiffersFromPersonal({id: "liz-id", email: "chairman@example.com"}, [chairman])).toEqual(false);
    expect(committeeRoleEmailDiffersFromPersonal({id: "walker-id", email: "walker@gmail.com"}, [chairman])).toEqual(false);
  });

  it("lists every committee address assigned to a member, including extras on the role", () => {
    const chair = {...chairman, description: "Chairman", additionalEmails: ["chair-extra@example.com"]};
    const emails = committeeAssignedEmailsForMemberId([chair, walks], "liz-id").map(entry => entry.email);
    expect(emails).toContain("chairman@example.com");
    expect(emails).toContain("chair-extra@example.com");
    expect(committeeAssignedEmailsForMemberId([chair, walks], "walker-id")).toEqual([]);
  });

  it("groups assigned addresses under the role and labels how each one is used", () => {
    const chair = {
      ...chairman,
      description: "Chairman",
      additionalEmails: ["chair-extra@example.com"]
    };
    const groups = committeeAssignedMailboxGroupsForMemberId([chair, walks], "liz-id");
    expect(groups).toHaveLength(1);
    expect(groups[0].roleDescription).toEqual("Chairman");
    expect(groups[0].addresses).toEqual([
      {email: "chairman@example.com", kind: CommitteeMailboxKind.DEFAULT_SENDER, generated: true},
      {email: "liz.chair@example.com", kind: CommitteeMailboxKind.MEMBER_NAME, generated: true},
      {email: "chair-extra@example.com", kind: CommitteeMailboxKind.EXTRA, generated: false}
    ]);
    expect(committeeMailboxKind(chair, "chairman@example.com")).toEqual(CommitteeMailboxKind.DEFAULT_SENDER);
    expect(committeeMailboxKind(chair, "liz.chair@example.com")).toEqual(CommitteeMailboxKind.MEMBER_NAME);
    expect(committeeMailboxKind(chair, "chair-extra@example.com")).toEqual(CommitteeMailboxKind.EXTRA);
  });

  it("switches the default sender to an extra address on the role", () => {
    const chair = {
      ...chairman,
      description: "Chairman",
      additionalEmails: ["chair-extra@example.com"]
    };
    const updated = applyCommitteeRoleDefaultSender(chair, "chair-extra@example.com");
    expect(updated.email).toEqual("chair-extra@example.com");
    expect(committeeMailboxKind(updated, "chair-extra@example.com")).toEqual(CommitteeMailboxKind.DEFAULT_SENDER);
    expect(committeeMailboxKind(updated, "chairman@example.com")).toEqual(CommitteeMailboxKind.ROLE_NAME);
  });

  it("keeps a previous extra default when switching back to a generated address", () => {
    const chair = {
      ...chairman,
      description: "Chairman",
      additionalEmails: ["chair-extra@example.com"]
    };
    const extraDefault = applyCommitteeRoleDefaultSender(chair, "chair-extra@example.com");
    const restored = applyCommitteeRoleDefaultSender(extraDefault, chair.email);
    expect(restored.email).toEqual(chair.email);
    expect(restored.additionalEmails).toContain("chair-extra@example.com");
    const emails = committeeAssignedMailboxGroupsForMemberId([restored], "liz-id")[0].addresses.map(item => item.email);
    expect(emails).toContain("chairman@example.com");
    expect(emails).toContain("liz.chair@example.com");
    expect(emails).toContain("chair-extra@example.com");
  });

  it("does not drop extras when the default sender moves between extra addresses", () => {
    const chair = {
      ...chairman,
      description: "Chairman",
      additionalEmails: ["chair-extra@example.com", "chair-other@example.com"]
    };
    const first = applyCommitteeRoleDefaultSender(chair, "chair-extra@example.com");
    const second = applyCommitteeRoleDefaultSender(first, "chair-other@example.com");
    const emails = roleEmailAddresses(second);
    expect(second.email).toEqual("chair-other@example.com");
    expect(emails).toContain("chair-extra@example.com");
    expect(emails).toContain("chair-other@example.com");
    expect(emails).toContain("chairman@example.com");
    expect(second.additionalEmails).toContain("chair-extra@example.com");
  });

  it("treats a member as a committee holder only when they are assigned to a role", () => {
    expect(memberHoldsCommitteeRole({id: "liz-id"}, [chairman, walks])).toEqual(true);
    expect(memberHoldsCommitteeRole({id: "walker-id"}, [chairman, walks])).toEqual(false);
  });

  it("rewrites a booking attendee matched by member id or by personal email", () => {
    expect(outboundEmailForRecipient({
      memberId: "liz-id",
      email: "liz@gmail.com",
      roles: [chairman],
      members: [{id: "liz-id", email: "liz@gmail.com"}]
    })).toEqual("chairman@example.com");
    expect(outboundEmailForRecipient({
      memberId: null,
      email: "liz@gmail.com",
      roles: [chairman],
      members: [{id: "liz-id", email: "liz@gmail.com"}]
    })).toEqual("chairman@example.com");
    expect(outboundEmailForRecipient({
      memberId: null,
      email: "guest@gmail.com",
      roles: [chairman],
      members: [{id: "liz-id", email: "liz@gmail.com"}]
    })).toEqual("guest@gmail.com");
  });
});

describe("committeeRoleMatchingEmail", () => {

  function role(overrides: Partial<CommitteeMember>): CommitteeMember {
    return {
      description: "NGX Project Lead",
      email: "member.one@ngx-ramblers.org.uk",
      fullName: "Nick Barrett",
      type: "ngx-project-lead",
      roleType: RoleType.COMMITTEE_MEMBER,
      nameAndDescription: "NGX Project Lead (Nick Barrett)",
      ...overrides
    };
  }

  const projectLead = role({
    additionalEmails: [
      "ngx-project-lead@ngx-ramblers.org.uk",
      "nix@ngx-ramblers.org.uk",
      "asd@ngx-ramblers.org.uk",
      "dddd@ngx-ramblers.org.uk"
    ]
  });
  const membership = role({
    description: "Membership Co-ordinator",
    email: "membership@ngx-ramblers.org.uk",
    fullName: "NGX Membership",
    type: "membership-co-ordinator",
    additionalEmails: []
  });
  const roles = [projectLead, membership];

  it("maps the stored default sender", () => {
    expect(committeeRoleMatchingEmail(roles, "member.one@ngx-ramblers.org.uk")?.type).toEqual("ngx-project-lead");
  });

  it("maps the generated role-type address", () => {
    expect(committeeRoleMatchingEmail(roles, "ngx-project-lead@ngx-ramblers.org.uk")?.type).toEqual("ngx-project-lead");
  });

  it("labels the default sender, role-name address and extras on the project lead role", () => {
    expect(committeeMailboxKind(projectLead, "member.one@ngx-ramblers.org.uk")).toEqual(CommitteeMailboxKind.DEFAULT_SENDER);
    expect(committeeMailboxKind(projectLead, "ngx-project-lead@ngx-ramblers.org.uk")).toEqual(CommitteeMailboxKind.ROLE_NAME);
    expect(committeeMailboxKind(projectLead, "nix@ngx-ramblers.org.uk")).toEqual(CommitteeMailboxKind.EXTRA);
  });

  it("maps extra mailbox addresses stored on the role", () => {
    expect(committeeRoleMatchingEmail(roles, "nix@ngx-ramblers.org.uk")?.type).toEqual("ngx-project-lead");
    expect(committeeRoleMatchingEmail(roles, "asd@ngx-ramblers.org.uk")?.type).toEqual("ngx-project-lead");
    expect(committeeRoleMatchingEmail(roles, "dddd@ngx-ramblers.org.uk")?.type).toEqual("ngx-project-lead");
  });

  it("maps the generated full-name address even when it is not the default sender", () => {
    const walks = role({
      description: "Walks Co-ordinator",
      email: "walks@ngx-ramblers.org.uk",
      fullName: "Jane Doe",
      type: "walks-co-ordinator",
      additionalEmails: []
    });
    expect(committeeRoleMatchingEmail([walks], "jane.doe@ngx-ramblers.org.uk")?.type).toEqual("walks-co-ordinator");
  });

  it("does not map an address that belongs to no role", () => {
    expect(committeeRoleMatchingEmail(roles, "nobody@ngx-ramblers.org.uk")).toEqual(null);
  });
});
