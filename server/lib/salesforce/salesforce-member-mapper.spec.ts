import expect from "expect";
import { describe, it } from "mocha";
import { mapSalesforceMemberToRamblersMember } from "./salesforce-member-mapper";
import { SalesforceMember } from "./salesforce.model";

function supporter(overrides: Partial<SalesforceMember> = {}): SalesforceMember {
  return {
    membershipNo: "3300001",
    memberRef: "SUP-3300001",
    contactId: "003Dn00000A1b2cDEF",
    title: "Mrs",
    firstName: "Jane",
    lastName: "Smith",
    email: "jane.smith@example.com",
    doNotEmail: false,
    landline: "01303 555111",
    mobile: "07700 900001",
    friendlyName: "Jane",
    membershipStatus: "Active",
    memberType: "Individual Membership",
    membershipJoinDate: "2023-07-15",
    membershipExpiry: "2026-07-15",
    membershipEndDate: null,
    teamStatus: "Member",
    teamRelationshipFrom: "2023-07-15",
    wellbeingWalker: false,
    walkLeader: true,
    volunteerRoles: [],
    noWalkProgram: false,
    noCampaigning: false,
    noSurveys: false,
    canEmailVolunteers: false,
    canEmailMembers: true,
    canEmailWellbeingWalkers: false,
    canViewMemberData: true,
    canViewMemberDate: true,
    emailConsent: true,
    emailConsentLastUpdated: "2023-07-15",
    postConsent: true,
    postConsentLastUpdated: "2023-07-15",
    phoneConsent: false,
    phoneConsentLastUpdated: null,
    emailConsentWellbeingWalks: false,
    ...overrides,
  };
}

describe("salesforce-member-mapper", () => {
  it("maps published supporter identity, contact and permissions", () => {
    const result = mapSalesforceMemberToRamblersMember(supporter());

    expect(result.salesforceId).toEqual("003Dn00000A1b2cDEF");
    expect(result.salesforceMemberRef).toEqual("SUP-3300001");
    expect(result.membershipNumber).toEqual("3300001");
    expect(result.membershipExpiryDate).toEqual("15/07/26");
    expect(result.emailPermissionLastUpdated).toEqual("15/07/2023");
    expect(result.canEmailMembers).toEqual(true);
    expect(result.canViewMemberData).toEqual(true);
  });

  it("keeps a non-member supporter stable without a membership number", () => {
    const result = mapSalesforceMemberToRamblersMember(supporter({
      membershipNo: null,
      teamStatus: "Volunteer",
    }));

    expect(result.membershipNumber).toBeNull();
    expect(result.salesforceMemberRef).toEqual("SUP-3300001");
    expect(result.salesforceTeamStatus).toEqual("Volunteer");
  });

  it("combines email consent and do-not-email into the existing NGX consent field", () => {
    expect(mapSalesforceMemberToRamblersMember(supporter()).emailMarketingConsent).toEqual("true");
    expect(mapSalesforceMemberToRamblersMember(supporter({ doNotEmail: true })).emailMarketingConsent).toEqual("false");
  });

  it("maps volunteer roles to their names rather than stringifying the objects", () => {
    const mapped = mapSalesforceMemberToRamblersMember(supporter({
      volunteerRoles: [
        {roleName: "Local Footpath Officer", startDate: "2020-01-01", displayName: null, walkLeaderStatus: null, wellbeingWalksRole: false},
        {roleName: "Parish Footpath Observer", startDate: "2021-01-01", displayName: "Observer, Chartham", walkLeaderStatus: null, wellbeingWalksRole: false}
      ]
    }));

    expect(mapped.volunteerRoles).toEqual("Local Footpath Officer, Observer, Chartham");
    expect(mapped.volunteerRoles).not.toContain("[object Object]");
  });

  it("leaves volunteer roles empty when a supporter holds none", () => {
    expect(mapSalesforceMemberToRamblersMember(supporter({volunteerRoles: []})).volunteerRoles).toEqual(null);
  });
});
