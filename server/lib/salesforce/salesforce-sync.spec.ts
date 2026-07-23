import expect from "expect";
import { describe, it } from "mocha";
import { RamblersMember } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { SalesforceMember } from "./salesforce.model";
import { reconcileSupporterSnapshot } from "./salesforce-sync";

function existing(memberRef: string, overrides: Partial<RamblersMember> = {}): RamblersMember {
  return {
    salesforceMemberRef: memberRef,
    firstName: "Existing",
    postcode: "CT1 2AA",
    ...overrides,
  } as RamblersMember;
}

function supporter(memberRef: string, overrides: Partial<SalesforceMember> = {}): SalesforceMember {
  return {
    membershipNo: null,
    memberRef,
    contactId: `CONTACT-${memberRef}`,
    title: null,
    firstName: "Current",
    lastName: "Supporter",
    email: `${memberRef.toLowerCase()}@example.org`,
    doNotEmail: false,
    landline: null,
    mobile: null,
    friendlyName: "Current",
    membershipStatus: null,
    memberType: null,
    membershipJoinDate: null,
    membershipExpiry: null,
    membershipEndDate: null,
    teamStatus: "Volunteer",
    teamRelationshipFrom: null,
    wellbeingWalker: false,
    walkLeader: false,
    volunteerRoles: [],
    noWalkProgram: false,
    noCampaigning: false,
    noSurveys: false,
    canEmailVolunteers: false,
    canEmailMembers: false,
    canEmailWellbeingWalkers: false,
    canViewMemberData: false,
    canViewMemberDate: false,
    emailConsent: true,
    emailConsentLastUpdated: null,
    postConsent: false,
    postConsentLastUpdated: null,
    phoneConsent: false,
    phoneConsentLastUpdated: null,
    emailConsentWellbeingWalks: false,
    ...overrides,
  };
}

describe("salesforce-sync supporter snapshot reconciliation", () => {
  it("preserves locally held fields missing from the API", () => {
    const result = reconcileSupporterSnapshot([existing("SUP-1")], [supporter("SUP-1")]);

    expect(result.members).toHaveLength(1);
    expect(result.members[0].postcode).toEqual("CT1 2AA");
    expect(result.members[0].firstName).toEqual("Current");
  });

  it("counts supporters that disappear from a later snapshot without preparing them for apply", () => {
    const result = reconcileSupporterSnapshot([existing("SUP-1")], []);

    expect(result.members).toHaveLength(0);
    expect(result.disappearedCount).toEqual(1);
  });

  it("keeps non-member supporters stable by memberRef", () => {
    const result = reconcileSupporterSnapshot(
      [existing("SUP-1", { membershipNumber: null })],
      [supporter("SUP-1", { membershipNo: null })],
    );

    expect(result.members).toHaveLength(1);
    expect(result.newCount).toEqual(0);
  });

  it("deduplicates the same supporter returned for more than one configured team", () => {
    const result = reconcileSupporterSnapshot([], [supporter("SUP-1"), supporter("SUP-1")]);

    expect(result.members).toHaveLength(1);
  });
});
