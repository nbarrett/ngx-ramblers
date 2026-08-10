import expect from "expect";
import { describe, it } from "mocha";
import { volunteerStatistics } from "../../../projects/ngx-ramblers/src/app/functions/volunteer-statistics";
import {
  VolunteerAssignment,
  VolunteerAssignmentCoverage,
  VolunteerAssignmentIdentityStatus,
  VolunteerAssignmentStatus,
  VolunteerParish,
  VolunteerParishEligibility,
  VolunteerRoleType
} from "../../../projects/ngx-ramblers/src/app/models/volunteer-management.model";

describe("volunteer statistics", () => {
  const parishes = [
    {groupCode: "EK", parishCode: "A", parishName: "Alpha", sectorCode: "S1", rightsOfWayGroupCode: "G1", eligibility: VolunteerParishEligibility.ACTIVE},
    {groupCode: "EK", parishCode: "B", parishName: "Beta", sectorCode: "S2", rightsOfWayGroupCode: "G2", eligibility: VolunteerParishEligibility.ACTIVE},
    {groupCode: "EK", parishCode: "C", parishName: "Gamma", eligibility: VolunteerParishEligibility.NO_PUBLIC_RIGHTS_OF_WAY}
  ] as VolunteerParish[];
  const assignment = (overrides: Partial<VolunteerAssignment>): VolunteerAssignment => ({
    id: "assignment", groupCode: "EK", parishCode: "A", supporterId: "supporter-1",
    identityStatus: VolunteerAssignmentIdentityStatus.LINKED, roleType: VolunteerRoleType.LOCAL_FOOTPATH_OFFICER,
    coverage: VolunteerAssignmentCoverage.PERMANENT, status: VolunteerAssignmentStatus.ACTIVE,
    effectiveFrom: 1, createdAt: 1, createdBy: "test", updatedAt: 1, updatedBy: "test", ...overrides
  });
  const assignments = [
    assignment({id: "a-lfo"}),
    assignment({id: "a-pfo", roleType: VolunteerRoleType.PARISH_FOOTPATH_OBSERVER, coverage: VolunteerAssignmentCoverage.TEMPORARY, supporterId: "supporter-2"}),
    assignment({id: "b-lfo", parishCode: "B"}),
    assignment({id: "ended", parishCode: "B", status: VolunteerAssignmentStatus.ENDED, effectiveTo: 9})
  ];

  const stats = volunteerStatistics(parishes, assignments);

  it("counts parishes, eligibility and active work only", () => {
    expect(stats.totalParishes).toEqual(3);
    expect(stats.eligibleParishes).toEqual(2);
    expect(stats.noPublicRightsOfWay).toEqual(1);
    expect(stats.activeAssignments).toEqual(3);
    expect(stats.temporaryAssignments).toEqual(1);
    expect(stats.distinctVolunteers).toEqual(2);
  });

  it("classifies role coverage as permanent, temporary or vacant across eligible parishes", () => {
    const localFootpathOfficer = stats.coverage.find(row => row.roleType === VolunteerRoleType.LOCAL_FOOTPATH_OFFICER);
    const parishFootpathObserver = stats.coverage.find(row => row.roleType === VolunteerRoleType.PARISH_FOOTPATH_OBSERVER);
    expect(localFootpathOfficer).toMatchObject({permanent: 2, temporary: 0, vacant: 0, eligibleParishes: 2});
    expect(parishFootpathObserver).toMatchObject({permanent: 0, temporary: 1, vacant: 1, eligibleParishes: 2});
  });

  it("counts distinct role holders and those holding both roles", () => {
    expect(stats.roleHolders).toEqual({
      localFootpathOfficers: 1,
      parishFootpathObservers: 1,
      bothRoles: 0,
      groupCoordinators: 0,
      needingReconciliation: 0
    });
  });

  it("counts people holding both roles once", () => {
    const bothRoles = volunteerStatistics(parishes, [...assignments, assignment({id: "b-pfo", parishCode: "B", roleType: VolunteerRoleType.PARISH_FOOTPATH_OBSERVER})]);
    expect(bothRoles.roleHolders.bothRoles).toEqual(1);
  });

  it("breaks coverage down by sector with holders and vacancies", () => {
    const sector2 = stats.bySector.find(area => area.key === "S2");
    expect(sector2).toMatchObject({
      eligibleParishes: 1,
      localFootpathOfficerHolders: 1,
      localFootpathOfficerVacancies: 0,
      parishFootpathObserverHolders: 0,
      parishFootpathObserverVacancies: 1
    });
  });

  it("breaks coverage down by rights-of-way group", () => {
    expect(stats.byGroup.map(area => area.key).sort()).toEqual(["G1", "G2"]);
  });
});
