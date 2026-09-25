import { describe, expect, it } from "vitest";
import { Member } from "../models/member.model";
import { memberChipQualifier, recipientChipQualifier } from "./member-chip-qualifier";

function member(overrides: Partial<Member>): Member {
  return {id: "1", email: "a@example.org", ...overrides} as Member;
}

describe("memberChipQualifier", () => {
  const now = 1_000_000;

  it("marks missing Head Office consent", () => {
    expect(memberChipQualifier(member({emailMarketingConsent: false}), now)).toEqual("without Head Office consent");
  });

  it("marks expired members", () => {
    expect(memberChipQualifier(member({membershipExpiryDate: now - 1}), now)).toEqual("expired members");
  });

  it("marks members with consent", () => {
    expect(memberChipQualifier(member({emailMarketingConsent: true}), now)).toEqual("with Head Office consent");
  });
});

describe("recipientChipQualifier", () => {
  const now = 1_000_000;

  it("qualifies a matching member", () => {
    expect(recipientChipQualifier("a@example.org", [member({emailMarketingConsent: true})], now)).toEqual("with Head Office consent");
  });

  it("qualifies an unknown address as external", () => {
    expect(recipientChipQualifier("guest@example.org", [member({})], now)).toEqual("external");
  });
});
