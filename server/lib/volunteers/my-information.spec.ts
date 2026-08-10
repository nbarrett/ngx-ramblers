import expect from "expect";
import { describe, it } from "mocha";
import { volunteerMyInformation } from "../../../projects/ngx-ramblers/src/app/functions/volunteer-my-information";
import {
  VolunteerAssignment,
  VolunteerAssignmentCoverage,
  VolunteerAssignmentIdentityStatus,
  VolunteerAssignmentStatus,
  VolunteerParish,
  VolunteerParishEligibility,
  VolunteerRoleType,
  VolunteerSupporterIdentity
} from "../../../projects/ngx-ramblers/src/app/models/volunteer-management.model";
import { ExternalContactType, ExternalRecipient } from "../../../projects/ngx-ramblers/src/app/models/external-recipient.model";

describe("volunteer my information", () => {
  const parishes = [
    {groupCode: "EK", parishCode: "A", parishName: "Zeta", localAuthorityName: "Zeta District", sectorCode: "S1", rightsOfWayGroupCode: "G1", eligibility: VolunteerParishEligibility.ACTIVE},
    {groupCode: "EK", parishCode: "B", parishName: "Alpha", localAuthorityName: "Alpha District", sectorCode: "S2", rightsOfWayGroupCode: "G2", eligibility: VolunteerParishEligibility.ACTIVE}
  ] as VolunteerParish[];
  const members: VolunteerSupporterIdentity[] = [
    {id: "supporter-2", firstName: "Alan", lastName: "Turing", email: "alan@example.org"},
    {id: "supporter-3", firstName: "Grace", lastName: "Hopper"}
  ];
  const contacts: ExternalRecipient[] = [
    {id: "contact-1", email: "clerk@alpha-pc.gov.uk", organisationName: "Alpha Parish Council", roleTitle: "Clerk", telephone: "01227 000000", contactType: ExternalContactType.PARISH_COUNCIL, parishCodes: ["B"], createdBy: "test", createdAt: 1}
  ];
  const assignment = (overrides: Partial<VolunteerAssignment>): VolunteerAssignment => ({
    id: "assignment-1",
    groupCode: "EK",
    parishCode: "A",
    supporterId: "supporter-1",
    identityStatus: VolunteerAssignmentIdentityStatus.LINKED,
    roleType: VolunteerRoleType.LOCAL_FOOTPATH_OFFICER,
    coverage: VolunteerAssignmentCoverage.PERMANENT,
    status: VolunteerAssignmentStatus.ACTIVE,
    effectiveFrom: 1,
    createdAt: 1,
    createdBy: "test",
    updatedAt: 1,
    updatedBy: "test",
    ...overrides
  });
  const assignments = [
    assignment({id: "mine-a-lfo", parishCode: "A"}),
    assignment({id: "mine-b-pfo", parishCode: "B", roleType: VolunteerRoleType.PARISH_FOOTPATH_OBSERVER, coverage: VolunteerAssignmentCoverage.TEMPORARY}),
    assignment({id: "counterpart-a", parishCode: "A", supporterId: "supporter-2", roleType: VolunteerRoleType.PARISH_FOOTPATH_OBSERVER}),
    assignment({id: "counterpart-a-unresolved", parishCode: "A", supporterId: null, unresolvedName: "Jo Bloggs", identityStatus: VolunteerAssignmentIdentityStatus.UNRESOLVED, roleType: VolunteerRoleType.GROUP_COORDINATOR}),
    assignment({id: "elsewhere", parishCode: "C", supporterId: "supporter-3"})
  ];
  const input = {memberId: "supporter-1", memberName: "Ada Lovelace", assignments, parishes, members, contacts};

  it("summarises only the parishes the member covers, sorted by name", () => {
    const result = volunteerMyInformation(input);
    expect(result.memberName).toEqual("Ada Lovelace");
    expect(result.parishCount).toEqual(2);
    expect(result.parishes.map(parish => parish.parishName)).toEqual(["Alpha", "Zeta"]);
  });

  it("reports my roles with cover labels for each parish", () => {
    const result = volunteerMyInformation(input);
    const zeta = result.parishes.find(parish => parish.parishCode === "A");
    expect(zeta.myRoles).toEqual([{roleLabel: "Local Footpath Officer", coverLabel: "Permanent", effectiveFrom: 1, effectiveTo: undefined}]);
    const alpha = result.parishes.find(parish => parish.parishCode === "B");
    expect(alpha.myRoles[0].coverLabel).toEqual("Temporary");
  });

  it("lists counterparts on the same parish, excluding the member, resolving names and emails", () => {
    const result = volunteerMyInformation(input);
    const zeta = result.parishes.find(parish => parish.parishCode === "A");
    expect(zeta.counterparts).toEqual([
      {name: "Alan Turing", email: "alan@example.org", roleLabel: "Parish Footpath Observer", coverLabel: "Permanent"},
      {name: "Jo Bloggs", email: undefined, roleLabel: "Group Coordinator", coverLabel: "Permanent"}
    ]);
  });

  it("attaches council contacts matched by parish code", () => {
    const result = volunteerMyInformation(input);
    const alpha = result.parishes.find(parish => parish.parishCode === "B");
    expect(alpha.councilContacts).toEqual([{organisationName: "Alpha Parish Council", contactName: undefined, roleTitle: "Clerk", email: "clerk@alpha-pc.gov.uk", telephone: "01227 000000", postalAddress: undefined}]);
    const zeta = result.parishes.find(parish => parish.parishCode === "A");
    expect(zeta.councilContacts).toEqual([]);
  });

  it("returns an empty result when the member holds no assignments", () => {
    const result = volunteerMyInformation({...input, memberId: "nobody"});
    expect(result.parishCount).toEqual(0);
    expect(result.parishes).toEqual([]);
  });
});
