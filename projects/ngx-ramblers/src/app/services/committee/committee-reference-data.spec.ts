import { CommitteeConfig, CommitteeMember, RoleType } from "../../models/committee.model";
import { CommitteeReferenceData } from "./committee-reference-data";

const NIC: CommitteeMember = {
  roleType: RoleType.COMMITTEE_MEMBER,
  type: "secretary",
  description: "Secretary",
  fullName: "Nic Meadway",
  memberId: "578bb704bd966f28bff5081b",
  email: "secretary@example.co.uk",
  nameAndDescription: "Secretary (Nic Meadway)"
};

const EXPECTED_NIC: CommitteeMember = {
  roleType: RoleType.COMMITTEE_MEMBER,
  description: "Secretary",
  fullName: "Nic Meadway",
  memberId: "578bb704bd966f28bff5081b",
  email: "secretary@example.co.uk",
  nameAndDescription: "Secretary (Nic Meadway)",
  type: "secretary"
};

const mockData: CommitteeConfig = {
  roles: [
    NIC,
    {
      roleType: RoleType.COMMITTEE_MEMBER,
      type: "treasurer",
      description: "Treasurer",
      fullName: "Jon Inglett",
      email: "treasurer@example.co.uk",
      memberId: "5a22f683bd966f3d367dbd80"
    },
    {
      roleType: RoleType.COMMITTEE_MEMBER,
      type: "membership",
      description: "Membership",
      fullName: "Jenny Brown",
      email: "membership@example.co.uk",
      memberId: "5318ce73a08549a65a4a2899"
    },
    {
      roleType: RoleType.COMMITTEE_MEMBER,
      type: "social",
      description: "Social Co-ordinator",
      fullName: "Andrew Goh",
      email: "social@example.co.uk",
      memberId: "5a281ddec2ef160584439b1f"
    },
    {
      roleType: RoleType.COMMITTEE_MEMBER,
      type: "walks",
      description: "Walks Co-ordinator",
      fullName: "Stuart Maisner",
      email: "walks@example.co.uk",
      memberId: "55470ac1e4b0996846fa82ba"
    },
    {
      roleType: RoleType.COMMITTEE_MEMBER,
      type: "support",
      description: "Technical Support",
      fullName: "Nick Barrett",
      email: "nick.barrett@example.co.uk",
      memberId: "52ab5d94e4b0f92ce9a5caee"
    }
  ],
  expenses: undefined,
  fileTypes: [{description: "file", public: true}]
};

describe("CommitteeReferenceData", () => {

  it("should return members for role", () => {
    const service: CommitteeReferenceData = CommitteeReferenceData.create(mockData, null);
    expect(service.committeeMembersForRole("secretary")).toEqual([EXPECTED_NIC]);
  });

  it("should return committee members", () => {
    const service: CommitteeReferenceData = CommitteeReferenceData.create(mockData, null);
    expect(service.committeeMembers()).toContainEqual(EXPECTED_NIC);
  });

  it("contactUsField should data based on supplied role and field", () => {
    const service: CommitteeReferenceData = CommitteeReferenceData.create(mockData, null);
    expect(service.contactUsField("support", "memberId")).toEqual("52ab5d94e4b0f92ce9a5caee");
    expect(service.contactUsField("membership", "fullName")).toEqual("Jenny Brown");
  });

  it("committeeMemberForMember finds the role by the member's id", () => {
    const service: CommitteeReferenceData = CommitteeReferenceData.create(mockData, null);
    expect(service.committeeMemberForMember("578bb704bd966f28bff5081b")).toEqual(EXPECTED_NIC);
    expect(service.committeeMemberForMember("missing")).toEqual(undefined);
  });

  it("committeeMemberForPreferredRoles prefers the first matching role with an email", () => {
    const service: CommitteeReferenceData = CommitteeReferenceData.create(mockData, null);
    expect(service.committeeMemberForPreferredRoles("membership,secretary,contact-us").type).toEqual("membership");
    expect(service.committeeMemberForPreferredRoles("unknown,secretary,contact-us").type).toEqual("secretary");
  });

  it("committeeMemberForPreferredRoles falls back to any contactable role when none of the preferred match", () => {
    const service: CommitteeReferenceData = CommitteeReferenceData.create({
      ...mockData,
      roles: mockData.roles.filter(role => role.type === "support")
    }, null);
    expect(service.committeeMemberForPreferredRoles("membership,secretary").type).toEqual("support");
  });
});
