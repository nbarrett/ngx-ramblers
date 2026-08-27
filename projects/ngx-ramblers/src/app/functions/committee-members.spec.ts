import { describe, expect, it } from "vitest";
import { additionalEmailsFromMailboxList, CommitteeMember, committeeRoleMatchingEmail, RoleType } from "../models/committee.model";
import {
  committeeMemberTrackKey,
  committeeRoleEmailDiffersFromPersonal,
  committeeRoleForMemberId,
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

describe("additionalEmailsFromMailboxList", () => {

  it("stores every address except the default sender so the list survives a reload", () => {
    expect(additionalEmailsFromMailboxList([
      "nick.barrett@ngx-ramblers.org.uk",
      "system-administrator@ngx-ramblers.org.uk",
      "ngx-project-lead@ngx-ramblers.org.uk"
    ], "nick.barrett@ngx-ramblers.org.uk")).toEqual([
      "system-administrator@ngx-ramblers.org.uk",
      "ngx-project-lead@ngx-ramblers.org.uk"
    ]);
    expect(additionalEmailsFromMailboxList([
      "nick.barrett@ngx-ramblers.org.uk",
      "system-administrator@ngx-ramblers.org.uk",
      "ngx-project-lead@ngx-ramblers.org.uk"
    ], "nick.barrett@ngx-ramblers.org.uk", ["system-administrator@ngx-ramblers.org.uk"])).toEqual([
      "ngx-project-lead@ngx-ramblers.org.uk"
    ]);
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
    expect(memberRecordId({id: "liz-id", memberId: undefined, email: "liz@gmail.com"})).toEqual("liz-id");
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
      email: "nick.barrett@ngx-ramblers.org.uk",
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
    expect(committeeRoleMatchingEmail(roles, "nick.barrett@ngx-ramblers.org.uk")?.type).toEqual("ngx-project-lead");
  });

  it("maps the generated role-type address", () => {
    expect(committeeRoleMatchingEmail(roles, "ngx-project-lead@ngx-ramblers.org.uk")?.type).toEqual("ngx-project-lead");
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
