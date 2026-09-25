import { describe, expect, it } from "vitest";
import { Member } from "../models/member.model";
import { limitedMemberMatches, memberMatchesSearch, mongoMemberSearchCriteria } from "./member-search";

function member(overrides: Partial<Member>): Member {
  return {id: "1", firstName: "Alice", lastName: "Evans", email: "alice@example.org", ...overrides} as Member;
}

describe("memberMatchesSearch", () => {
  it("matches name fragments", () => {
    expect(memberMatchesSearch(member({}), "eva")).toEqual(true);
  });

  it("rejects unrelated terms", () => {
    expect(memberMatchesSearch(member({}), "zzz")).toEqual(false);
  });
});

describe("limitedMemberMatches", () => {
  const members = [
    member({id: "1", firstName: "Alice"}),
    member({id: "2", firstName: "Bob", lastName: "Smith", email: "bob@example.org"}),
    member({id: "3", firstName: "Carol", lastName: "Jones", email: "carol@example.org"})
  ];

  it("keeps selected members and caps the rest", () => {
    const result = limitedMemberMatches(members, "o", ["1"], item => memberMatchesSearch(item, "o"), 1);
    expect(result.map(item => item.id)).toEqual(["1", "2"]);
  });
});

describe("mongoMemberSearchCriteria", () => {
  it("returns extras only when the term is empty", () => {
    expect(mongoMemberSearchCriteria("", {groupMember: true})).toEqual({groupMember: true});
  });

  it("adds a case-insensitive name and email matcher", () => {
    const criteria = mongoMemberSearchCriteria("Alice", {groupMember: true});
    expect(criteria["groupMember"]).toEqual(true);
    expect((criteria["$or"] as unknown[]).length).toEqual(6);
  });
});
