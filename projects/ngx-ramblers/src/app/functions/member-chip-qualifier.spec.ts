import { describe, expect, it } from "vitest";
import { Member } from "../models/member.model";
import { committeeChipQualifier, memberChipQualifier, recipientChipQualifier } from "./member-chip-qualifier";

function member(overrides: Partial<Member>): Member {
  return {id: "1", email: "a@example.org", ...overrides} as Member;
}

describe("memberChipQualifier", () => {
  const now = 1_000_000;

  it("marks missing Head Office consent", () => {
    expect(memberChipQualifier(member({emailMarketingConsent: false}), now)).toEqual("without Head Office consent");
  });

  it("does not mark expiry unless that audience filter is in use", () => {
    expect(memberChipQualifier(member({membershipExpiryDate: now - 1}), now)).toEqual("with Head Office consent");
  });

  it("marks expired members when the expired audience is selected", () => {
    expect(memberChipQualifier(member({membershipExpiryDate: now - 1}), now, true)).toEqual("expired members");
  });

  it("prefers Head Office consent over expiry", () => {
    expect(memberChipQualifier(member({emailMarketingConsent: false, membershipExpiryDate: now - 1}), now, true))
      .toEqual("without Head Office consent");
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

  it("qualifies a committee role address as committee", () => {
    expect(recipientChipQualifier("membership@group.org", [member({})], now, ["membership@group.org"])).toEqual("committee");
  });

  it("adds Head Office consent next to committee when the holder is known", () => {
    expect(committeeChipQualifier(member({emailMarketingConsent: false}), now))
      .toEqual("committee · without Head Office consent");
  });
});
