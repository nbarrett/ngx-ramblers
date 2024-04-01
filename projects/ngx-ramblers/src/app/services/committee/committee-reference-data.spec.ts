import { CommitteeConfig, CommitteeMember } from "../../models/committee.model";
import { CommitteeReferenceData } from "./committee-reference-data";

const NIC = {
  type: "secretary",
  description: "Secretary",
  fullName: "Nic Meadway",
  memberId: "578bb704bd966f28bff5081b",
  email: "secretary@example.co.uk",
  nameAndDescription: "Secretary (Nic Meadway)"
};

const EXPECTED_NIC: CommitteeMember = {
  description: "Secretary",
  fullName: "Nic Meadway",
  memberId: "578bb704bd966f28bff5081b",
  email: "secretary@example.co.uk",
  nameAndDescription: "Secretary (Nic Meadway)",
  type: "secretary"
};

const mockData: CommitteeConfig = {
  expenses: undefined,
  contactUs: {
      chairman: {
        type: "chairman",
        description: "Chairman",
        fullName: "Kerry O'Grady",
        email: "chairman@example.co.uk",
        memberId: "52c595b3e4b003b51a33dac0"
      },
      secretary: NIC,
      treasurer: {
        type: "treasurer",
        description: "Treasurer",
        fullName: "Jon Inglett",
        email: "treasurer@example.co.uk",
        memberId: "5a22f683bd966f3d367dbd80"
      },
      membership: {
        type: "membership",
        description: "Membership",
        fullName: "Jenny Brown",
        email: "membership@example.co.uk",
        memberId: "5318ce73a08549a65a4a2899"
      },
      social: {
        type: "social",
        description: "Social Co-ordinator",
        fullName: "Andrew Goh",
        email: "social@example.co.uk",
        memberId: "5a281ddec2ef160584439b1f"
      },
      walks: {
        type: "walks",
        description: "Walks Co-ordinator",
        fullName: "Stuart Maisner",
        email: "walks@example.co.uk",
        memberId: "55470ac1e4b0996846fa82ba"
      },
      support: {
        type: "support",
        description: "Technical Support",
        fullName: "Nick Barrett",
        email: "nick.barrett@example.co.uk",
        memberId: "52ab5d94e4b0f92ce9a5caee"
      }
    },
    fileTypes: [{description: "file", public: true}]
};

describe("CommitteeReferenceData", () => {

  it("should return members for role", () => {
    const service: CommitteeReferenceData = CommitteeReferenceData.create(mockData, null);
    expect(service.committeeMembersForRole("secretary")).toEqual([EXPECTED_NIC]);
  });

  it("should return committee members", () => {
    const service: CommitteeReferenceData = CommitteeReferenceData.create(mockData, null);
    expect(service.committeeMembers()[1]).toEqual(EXPECTED_NIC);
  });

  it("contactUsField should data based on supplied role and field", () => {
    const service: CommitteeReferenceData = CommitteeReferenceData.create(mockData, null);
    expect(service.contactUsField("support", "memberId")).toEqual("52ab5d94e4b0f92ce9a5caee");
    expect(service.contactUsField("membership", "fullName")).toEqual("Jenny Brown");
    expect(service.contactUsField("walks", "nameAndDescription")).toEqual("Walks Co-ordinator (Stuart Maisner)");
    expect(service.contactUsField("social", "nameAndDescription")).toEqual("Social Co-ordinator (Andrew Goh)");
  });
});
