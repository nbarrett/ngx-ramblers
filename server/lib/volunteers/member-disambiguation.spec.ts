import expect from "expect";
import { describe, it } from "mocha";
import { memberDisambiguatedLabel, memberNameCounts, MemberDisambiguationParts } from "../../../projects/ngx-ramblers/src/app/functions/member-names";

describe("member disambiguation labels", () => {
  it("leaves a name without an alias plain", () => {
    const jenny: MemberDisambiguationParts = {firstName: "Jenny", lastName: "Brown", email: "jenny@example.org"};
    expect(memberDisambiguatedLabel(jenny)).toEqual("Jenny Brown");
  });

  it("appends a curated alias where one is set", () => {
    const jenny: MemberDisambiguationParts = {firstName: "Jenny", lastName: "Brown", nameAlias: "Sevenoaks", email: "a@example.org"};
    expect(memberDisambiguatedLabel(jenny)).toEqual("Jenny Brown (Sevenoaks)");
  });

  it("ignores a meaningless numeric alias", () => {
    const amanda: MemberDisambiguationParts = {firstName: "Amanda", lastName: "Barlow", nameAlias: "2", email: "clerk@sundridge-pc.gov.uk"};
    expect(memberDisambiguatedLabel(amanda)).toEqual("Amanda Barlow");
  });
});

describe("member name counts", () => {
  it("counts members who share a full name", () => {
    const amandaA: MemberDisambiguationParts = {firstName: "Amanda", lastName: "Barlow", email: "a@example.org"};
    const amandaB: MemberDisambiguationParts = {firstName: "Amanda", lastName: "Barlow", email: "b@example.org"};
    const pat: MemberDisambiguationParts = {firstName: "Pat", lastName: "Jones", email: "pat@example.org"};
    const counts = memberNameCounts([amandaA, amandaB, pat]);
    expect(counts.get("amanda barlow")).toEqual(2);
    expect(counts.get("pat jones")).toEqual(1);
  });
});
