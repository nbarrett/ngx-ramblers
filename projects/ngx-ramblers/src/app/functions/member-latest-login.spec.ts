import { describe, expect, it } from "vitest";
import { Member } from "../models/member.model";
import {
  emptyLastLoginIndex,
  lastLoginIndex,
  lastLoginTimeFor,
  latestLoginsFromAudits,
  memberHasLoggedIn,
  memberProfileConfirmed
} from "./member-latest-login";

function member(overrides: Partial<Member> = {}): Member {
  return {id: "aaaaaaaaaaaaaaaaaaaaaaaa", firstName: "Alex", lastName: "Reed", userName: "alex.reed", ...overrides} as Member;
}

describe("latestLoginsFromAudits", () => {
  it("keeps the latest login per member id", () => {
    const logins = latestLoginsFromAudits([
      {userName: "alex.reed", loginTime: 100, member: {memberId: "aaaaaaaaaaaaaaaaaaaaaaaa"}},
      {userName: "alex.reed", loginTime: 300, member: {memberId: "aaaaaaaaaaaaaaaaaaaaaaaa"}},
      {userName: "alex.reed", loginTime: 200, member: {memberId: "aaaaaaaaaaaaaaaaaaaaaaaa"}}
    ]);
    expect(logins).toEqual([{
      memberId: "aaaaaaaaaaaaaaaaaaaaaaaa",
      userName: "alex.reed",
      loginTime: 300
    }]);
  });

  it("groups by user name when there is no member id", () => {
    const logins = latestLoginsFromAudits([
      {userName: "Alex.Reed", loginTime: 50},
      {userName: "alex.reed", loginTime: 90}
    ]);
    expect(logins).toEqual([{memberId: null, userName: "alex.reed", loginTime: 90}]);
  });

  it("drops rows with no login time or identity", () => {
    expect(latestLoginsFromAudits([
      {userName: "alex.reed"},
      {loginTime: 10},
      {userName: "  ", loginTime: 20, member: {}}
    ])).toEqual([]);
  });
});

describe("lastLoginTimeFor", () => {
  const index = lastLoginIndex([
    {memberId: "aaaaaaaaaaaaaaaaaaaaaaaa", userName: "alex.reed", loginTime: 400},
    {memberId: null, userName: "sam.lee", loginTime: 150}
  ]);

  it("matches on member id or user name", () => {
    expect(lastLoginTimeFor(member(), index)).toEqual(400);
    expect(lastLoginTimeFor(member({id: "bbbbbbbbbbbbbbbbbbbbbbbb", userName: "Sam.Lee"}), index)).toEqual(150);
  });

  it("is empty when they have never logged in", () => {
    expect(lastLoginTimeFor(member({id: "cccccccccccccccccccccccc", userName: "pat.cole"}), index)).toEqual(null);
    expect(memberHasLoggedIn(member({id: "cccccccccccccccccccccccc", userName: "pat.cole"}), emptyLastLoginIndex())).toEqual(false);
  });
});

describe("memberProfileConfirmed", () => {
  it("follows the confirmed flag", () => {
    expect(memberProfileConfirmed(member({profileSettingsConfirmed: true}))).toEqual(true);
    expect(memberProfileConfirmed(member({profileSettingsConfirmed: false}))).toEqual(false);
    expect(memberProfileConfirmed(member())).toEqual(false);
  });
});
