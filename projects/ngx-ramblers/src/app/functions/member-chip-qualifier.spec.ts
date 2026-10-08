import { describe, expect, it } from "vitest";
import { Member } from "../models/member.model";
import { MemberSelection } from "../models/mail.model";
import { committeeChipQualifier, combinedMemberChipQualifier, memberAudienceQualifier, memberChipQualifier, recipientChipQualifier } from "./member-chip-qualifier";

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

  it("keeps committee on a member's personal address when they hold a role", () => {
    expect(recipientChipQualifier(
      "alex.reed@example.com",
      [member({id: "alex", email: "alex.reed@example.com", committee: true, emailMarketingConsent: true})],
      now,
      ["chair@group.example.org.uk"],
      ["alex"]
    )).toEqual("committee · with Head Office consent");
  });

  it("adds Head Office consent next to committee when the holder is known", () => {
    expect(committeeChipQualifier(member({emailMarketingConsent: false}), now))
      .toEqual("committee · without Head Office consent");
  });
});

describe("memberAudienceQualifier", () => {
  const now = 1_000_000;
  const displayDate = () => "2 September 2026";

  it("tags missing-from-bulk-load with the last bulk load date", () => {
    expect(memberAudienceQualifier(
      member({membershipNumber: "123"}),
      MemberSelection.MISSING_FROM_BULK_LOAD_MEMBERS,
      now,
      displayDate,
      800_000
    )).toEqual("last bulk load 2 September 2026");
  });

  it("keeps Head Office consent next to the last bulk load date", () => {
    expect(combinedMemberChipQualifier(
      member({emailMarketingConsent: true, membershipNumber: "123"}),
      now,
      displayDate,
      MemberSelection.MISSING_FROM_BULK_LOAD_MEMBERS,
      800_000
    )).toEqual("with Head Office consent, last bulk load 2 September 2026");
  });

  it("keeps Head Office consent next to the created date", () => {
    expect(combinedMemberChipQualifier(
      member({emailMarketingConsent: true, createdDate: 800_000}),
      now,
      displayDate,
      MemberSelection.RECENTLY_ADDED,
      null
    )).toEqual("with Head Office consent, created 2 September 2026");
  });
});
