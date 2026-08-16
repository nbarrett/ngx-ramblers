import { describe, expect, it } from "vitest";
import { RoleType } from "../models/committee.model";
import { committeeMemberTrackKey, uniqueCommitteeMembersByType } from "./committee-members";

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

describe("committeeMemberTrackKey", () => {

  it("distinguishes two members who share a role type", () => {
    const tom = member("support", "Tom", "tom-id");
    const nick = member("support", "Nick", "nick-id");
    expect(committeeMemberTrackKey(tom)).not.toEqual(committeeMemberTrackKey(nick));
  });
});
