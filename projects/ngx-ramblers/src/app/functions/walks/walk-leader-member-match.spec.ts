import { ContactDetails } from "../../models/group-event.model";
import { Member } from "../../models/member.model";
import { WalkLeaderMatchConfidence, WalkLeaderMatchType } from "../../models/walk-leader-match.model";
import { leaderMatchResult, matchedMemberForWalkLeader, priorMatchesFromWalks, shouldAutoLinkLeaderMatch } from "./walk-leader-member-match";

function member(overrides?: Partial<Member>): Member {
  return {
    id: "member-1",
    firstName: "Alex",
    lastName: "Example",
    displayName: "Alex Example",
    ...overrides
  };
}

function contactDetails(overrides?: Partial<ContactDetails>): ContactDetails {
  return {
    contactId: "contact-1",
    memberId: null,
    displayName: "Alex Example",
    email: null,
    phone: null,
    ...overrides
  };
}

describe("matchedMemberForWalkLeader", () => {
  it("matches by unique email", () => {
    const members = [
      member({ id: "member-1", email: "alex@example.com", mobileNumber: "07111 111111" }),
      member({ id: "member-2", email: "jamie@example.com", displayName: "Jamie Example" })
    ];

    const matched = matchedMemberForWalkLeader(members, contactDetails({ email: " Alex@Example.com " }));

    expect(matched?.id).toEqual("member-1");
  });

  it("matches by unique phone and name when email does not match", () => {
    const members = [
      member({ id: "member-1", email: "wrong@example.com", mobileNumber: "07111 111111" }),
      member({ id: "member-2", displayName: "Jamie Example", mobileNumber: "07222 222222" })
    ];

    const matched = matchedMemberForWalkLeader(members, contactDetails({
      displayName: "Alex Example",
      email: "unknown@example.com",
      phone: "07111-111111"
    }));

    expect(matched?.id).toEqual("member-1");
  });

  it("does not match on phone alone when name is present but different", () => {
    const members = [
      member({ id: "member-1", displayName: "Alex Example", mobileNumber: "07111 111111" })
    ];

    const matched = matchedMemberForWalkLeader(members, contactDetails({
      displayName: "Different Person",
      phone: "07111 111111"
    }));

    expect(matched).toBeNull();
  });

  it("matches by unique name only when email and phone are missing", () => {
    const members = [
      member({ id: "member-1", displayName: "Alex Example" }),
      member({ id: "member-2", displayName: "Jamie Example" })
    ];

    const matched = matchedMemberForWalkLeader(members, contactDetails({ displayName: "alex example" }));

    expect(matched?.id).toEqual("member-1");
  });

  it("matches by contactId alias against member contactId", () => {
    const members = [
      member({ id: "member-1", contactId: "hf-52-al-m", displayName: "Alastair M" }),
      member({ id: "member-2", contactId: "hf-52-oli-p", displayName: "Oliver P" })
    ];

    const matched = matchedMemberForWalkLeader(members, contactDetails({
      contactId: "Al M",
      displayName: "Al M",
      email: null,
      phone: null
    }));

    expect(matched?.id).toEqual("member-1");
  });

  it("returns null for ambiguous name matches", () => {
    const members = [
      member({ id: "member-1", displayName: "Alex Example" }),
      member({ id: "member-2", displayName: "Alex Example" })
    ];

    const matched = matchedMemberForWalkLeader(members, contactDetails({ displayName: "Alex Example" }));

    expect(matched).toBeNull();
  });
});

describe("leaderMatchResult", () => {
  it("uses memberId as authoritative high-confidence match", () => {
    const members = [
      member({
        id: "67438a262d9517015ca530ff",
        firstName: "Adam",
        lastName: "Garrod",
        displayName: "Adam G",
        email: "garrodadam@gmail.com",
        mobileNumber: "07593 141464"
      }),
      member({
        id: "member-2",
        firstName: "Other",
        lastName: "Person",
        displayName: "Other Person",
        email: "other@example.com"
      })
    ];

    const result = leaderMatchResult(members, contactDetails({
      memberId: "67438a262d9517015ca530ff",
      displayName: "Adam G",
      email: "garrodadam@gmail.com",
      phone: "07593 141464"
    }));

    expect(result.member?.id).toEqual("67438a262d9517015ca530ff");
    expect(result.matchType).toEqual(WalkLeaderMatchType.MEMBER_ID);
    expect(result.confidence).toEqual(WalkLeaderMatchConfidence.HIGH);
    expect(shouldAutoLinkLeaderMatch(result)).toBeTrue();
  });

  it("uses strong prior mapping as high confidence", () => {
    const members = [
      member({ id: "member-1", displayName: "Alex Example", email: "alex@example.com" })
    ];
    const result = leaderMatchResult(members, contactDetails({
      contactId: "wm-123",
      displayName: "Someone Else",
      email: null,
      phone: null
    }), [{ contactId: "wm-123", memberId: "member-1", count: 2 }]);

    expect(result.member?.id).toEqual("member-1");
    expect(result.confidence).toEqual(WalkLeaderMatchConfidence.HIGH);
    expect(shouldAutoLinkLeaderMatch(result)).toBeTrue();
  });

  it("treats conflicting prior mapping as low confidence", () => {
    const members = [
      member({ id: "member-1", displayName: "Alex Example" }),
      member({ id: "member-2", displayName: "Jamie Example" })
    ];
    const result = leaderMatchResult(members, contactDetails({
      contactId: "wm-123",
      displayName: "Alex Example"
    }), [
      { contactId: "wm-123", memberId: "member-1", count: 2 },
      { contactId: "wm-123", memberId: "member-2", count: 1 }
    ]);

    expect(result.member).toBeNull();
    expect(result.confidence).toEqual(WalkLeaderMatchConfidence.LOW);
    expect(shouldAutoLinkLeaderMatch(result)).toBeFalse();
  });

  it("uses prior mapping when contactId is display-style and prior key is canonical slug", () => {
    const members = [
      member({ id: "member-1", displayName: "Alastair M" })
    ];
    const result = leaderMatchResult(members, contactDetails({
      contactId: "Al M",
      displayName: "Al M",
      email: null,
      phone: null
    }), [{ contactId: "hf-52-al-m", memberId: "member-1", count: 2 }]);

    expect(result.member?.id).toEqual("member-1");
    expect(result.matchType).toEqual(WalkLeaderMatchType.PRIOR_STRONG);
    expect(result.confidence).toEqual(WalkLeaderMatchConfidence.HIGH);
    expect(shouldAutoLinkLeaderMatch(result)).toBeTrue();
  });

  it("matches unique name initial pattern with medium confidence", () => {
    const members = [
      member({ id: "member-1", firstName: "Oliver", lastName: "Parkes", displayName: "Oliver Parkes" }),
      member({ id: "member-2", firstName: "Jamie", lastName: "Smith", displayName: "Jamie Smith" })
    ];
    const result = leaderMatchResult(members, contactDetails({
      displayName: "Oli P",
      email: null,
      phone: null
    }));

    expect(result.member?.id).toEqual("member-1");
    expect(result.matchType).toEqual(WalkLeaderMatchType.NAME_INITIAL_PATTERN);
    expect(result.confidence).toEqual(WalkLeaderMatchConfidence.MEDIUM);
    expect(shouldAutoLinkLeaderMatch(result)).toBeTrue();
  });

  it("matches short name initials with low confidence for manual review", () => {
    const members = [
      member({ id: "member-1", firstName: "Alastair", lastName: "Miles", displayName: "Alastair Miles" }),
      member({ id: "member-2", firstName: "Jamie", lastName: "Smith", displayName: "Jamie Smith" })
    ];
    const result = leaderMatchResult(members, contactDetails({
      displayName: "Al M",
      email: null,
      phone: null
    }));

    expect(result.member?.id).toEqual("member-1");
    expect(result.matchType).toEqual(WalkLeaderMatchType.NAME_INITIAL_PATTERN);
    expect(result.confidence).toEqual(WalkLeaderMatchConfidence.LOW);
    expect(shouldAutoLinkLeaderMatch(result)).toBeFalse();
  });

  it("treats first-name plus surname-initial as medium confidence for abbreviated contact names", () => {
    const members = [
      member({ id: "member-1", firstName: "Adam", lastName: "Garrod", displayName: "Adam G" }),
      member({ id: "member-2", firstName: "Amy", lastName: "Grant", displayName: "Amy G" })
    ];
    const result = leaderMatchResult(members, contactDetails({
      memberId: null,
      displayName: "Adam G",
      email: null,
      phone: null
    }));

    expect(result.member?.id).toEqual("member-1");
    expect(result.matchType).toEqual(WalkLeaderMatchType.NAME_INITIAL_PATTERN);
    expect(result.confidence).toEqual(WalkLeaderMatchConfidence.MEDIUM);
    expect(shouldAutoLinkLeaderMatch(result)).toBeTrue();
  });

  it("matches name initials when contact email is a non-email url and member email local-part aligns", () => {
    const members = [
      member({
        id: "member-1",
        firstName: "Member",
        lastName: "One",
        displayName: "Member One",
        email: "oliver.parkes@hotmail.co.uk"
      }),
      member({
        id: "member-2",
        firstName: "Jamie",
        lastName: "Smith",
        displayName: "Jamie Smith",
        email: "jamie.smith@example.com"
      })
    ];

    const result = leaderMatchResult(members, contactDetails({
      displayName: "Oli P",
      email: "https://www.ramblers.org.uk/go-walking/group-walks/tring-taproom-trek-9-miles145km-leisurely-booking-required#contact",
      phone: null
    }));

    expect(result.member?.id).toEqual("member-1");
    expect(result.matchType).toEqual(WalkLeaderMatchType.NAME_INITIAL_PATTERN);
    expect(result.confidence).toEqual(WalkLeaderMatchConfidence.MEDIUM);
    expect(shouldAutoLinkLeaderMatch(result)).toBeTrue();
  });

  it("downgrades unique email match to low confidence when contact name is inconsistent", () => {
    const members = [
      member({
        id: "member-1",
        firstName: "Alastair",
        lastName: "Miles",
        displayName: "Alastair Miles",
        email: "alastair.miles@example.com"
      })
    ];

    const result = leaderMatchResult(members, contactDetails({
      displayName: "Chris Z",
      email: "alastair.miles@example.com",
      phone: null
    }));

    expect(result.member?.id).toEqual("member-1");
    expect(result.matchType).toEqual(WalkLeaderMatchType.EMAIL);
    expect(result.confidence).toEqual(WalkLeaderMatchConfidence.LOW);
    expect(shouldAutoLinkLeaderMatch(result)).toBeFalse();
  });
});

describe("priorMatchesFromWalks", () => {
  it("aggregates contact-member counts from walks", () => {
    const walks: any[] = [
      { fields: { contactDetails: { contactId: "wm-1", memberId: "member-1" } } },
      { fields: { contactDetails: { contactId: "wm-1", memberId: "member-1" } } },
      { fields: { contactDetails: { contactId: "wm-1", memberId: "member-2" } } },
      { fields: { contactDetails: { contactId: "wm-2", memberId: "member-3" } } }
    ];
    const result = priorMatchesFromWalks(walks as any);
    const wm1member1 = result.find(item => item.contactId === "wm-1" && item.memberId === "member-1");
    const wm1member2 = result.find(item => item.contactId === "wm-1" && item.memberId === "member-2");

    expect(wm1member1?.count).toEqual(2);
    expect(wm1member2?.count).toEqual(1);
  });
});
