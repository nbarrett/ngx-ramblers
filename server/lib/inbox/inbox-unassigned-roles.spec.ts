import expect from "expect";
import { describe, it } from "mocha";
import { CommitteeMember, RoleType } from "../../../projects/ngx-ramblers/src/app/models/committee.model";
import { DeletedMember } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { roleMemberIds, unassignedCommitteeRolesFrom } from "./inbox-unassigned-roles";

const CURRENT_MEMBER = "6a776803b99d4ecfb82e348d";
const DELETED_PRIMARY = "69f88d44c9621e022d1ad897";
const DELETED_RECIPIENT = "6a4e376ac500f750048c4452";
const ANOTHER_CURRENT = "6a4e376ac500f750048c4499";

function role(overrides: Partial<CommitteeMember>): CommitteeMember {
  return {
    description: "Support",
    email: "support@example.org",
    fullName: "Someone",
    type: "support",
    roleType: RoleType.COMMITTEE_MEMBER,
    ...overrides
  };
}

function deleted(memberId: string, firstName: string, lastName: string): DeletedMember {
  return {
    deletedAt: 1756900000000,
    deletedBy: CURRENT_MEMBER,
    memberId,
    membershipNumber: "12345",
    firstName,
    lastName
  } as DeletedMember;
}

const existingMemberIds = new Set([CURRENT_MEMBER, ANOTHER_CURRENT]);
const deletedMembersById = new Map<string, DeletedMember>([
  [DELETED_PRIMARY, deleted(DELETED_PRIMARY, "Nick", "Barrett")]
]);

describe("roleMemberIds", () => {
  it("collects the primary member and every inbox recipient member once", () => {
    const ids = roleMemberIds([
      role({memberId: CURRENT_MEMBER, inboxRecipients: [{memberId: DELETED_RECIPIENT, email: null, notify: true}, {memberId: CURRENT_MEMBER, email: null, notify: false}]}),
      role({type: "treasury", memberId: DELETED_PRIMARY})
    ]);
    expect([...ids].sort()).toEqual([CURRENT_MEMBER, DELETED_RECIPIENT, DELETED_PRIMARY].sort());
  });

  it("ignores roles with no member and recipients without a member id", () => {
    const ids = roleMemberIds([
      role({memberId: null, inboxRecipients: [{memberId: null, email: "someone@example.org", notify: true}]}),
      role({type: "vacant", vacant: true})
    ]);
    expect(ids).toEqual([]);
  });

  it("ignores placeholder member ids such as (none) that are not real member ids", () => {
    const ids = roleMemberIds([
      role({type: "contact-us", memberId: "(none)", inboxRecipients: [{memberId: "", email: null, notify: false}]})
    ]);
    expect(ids).toEqual([]);
  });
});

describe("unassignedCommitteeRolesFrom", () => {
  it("does not report a role whose member id is a placeholder rather than a deleted member", () => {
    const result = unassignedCommitteeRolesFrom([role({type: "contact-us", memberId: "(none)"})], existingMemberIds, deletedMembersById);
    expect(result).toEqual([]);
  });

  it("reports a role whose primary member no longer exists, with the deleted member's details", () => {
    const result = unassignedCommitteeRolesFrom([role({type: "support-nick-barrett", memberId: DELETED_PRIMARY})], existingMemberIds, deletedMembersById);
    expect(result.length).toEqual(1);
    expect(result[0].role.type).toEqual("support-nick-barrett");
    expect(result[0].missingMembers).toEqual([{
      memberId: DELETED_PRIMARY,
      primary: true,
      deletedAt: 1756900000000,
      deletedBy: CURRENT_MEMBER,
      fullName: "Nick Barrett"
    }]);
  });

  it("reports a missing member id that has no deleted-member record with null details", () => {
    const result = unassignedCommitteeRolesFrom([role({memberId: DELETED_RECIPIENT})], existingMemberIds, deletedMembersById);
    expect(result[0].missingMembers).toEqual([{
      memberId: DELETED_RECIPIENT,
      primary: true,
      deletedAt: null,
      deletedBy: null,
      fullName: null
    }]);
  });

  it("reports a missing inbox recipient even when the primary member still exists", () => {
    const result = unassignedCommitteeRolesFrom([
      role({memberId: CURRENT_MEMBER, inboxRecipients: [{memberId: DELETED_RECIPIENT, email: null, notify: true}]})
    ], existingMemberIds, deletedMembersById);
    expect(result.length).toEqual(1);
    expect(result[0].missingMembers.map(missing => [missing.memberId, missing.primary])).toEqual([[DELETED_RECIPIENT, false]]);
  });

  it("does not report roles whose members all exist, vacant roles, or roles with no member", () => {
    const result = unassignedCommitteeRolesFrom([
      role({memberId: CURRENT_MEMBER, inboxRecipients: [{memberId: ANOTHER_CURRENT, email: null, notify: true}]}),
      role({type: "vacant", vacant: true, memberId: null}),
      role({type: "unlinked"})
    ], existingMemberIds, deletedMembersById);
    expect(result).toEqual([]);
  });

  it("lists the same missing member only once per role", () => {
    const result = unassignedCommitteeRolesFrom([
      role({memberId: DELETED_PRIMARY, inboxRecipients: [{memberId: DELETED_PRIMARY, email: null, notify: true}, {memberId: DELETED_PRIMARY, email: null, notify: false}]})
    ], existingMemberIds, deletedMembersById);
    expect(result[0].missingMembers.map(missing => missing.memberId)).toEqual([DELETED_PRIMARY]);
  });
});
