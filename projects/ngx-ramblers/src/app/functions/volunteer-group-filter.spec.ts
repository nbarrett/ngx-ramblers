import { filterVolunteerParishes, filterVolunteerSupporterRows, rightsOfWayGroupMatches, volunteerSupporterRows } from "./volunteer-management";
import { scopeReportInputToRightsOfWayGroup, volunteerReport, VolunteerReportInput } from "./volunteer-reports";
import {
  VolunteerAssignment,
  VolunteerAssignmentCoverage,
  VolunteerAssignmentIdentityStatus,
  VolunteerAssignmentStatus,
  VolunteerParish,
  VolunteerReportType,
  VolunteerRoleType
} from "../models/volunteer-management.model";

function parish(parishCode: string, parishName: string, rightsOfWayGroupCode: string): VolunteerParish {
  return {groupCode: "KENT", parishCode, parishName, rightsOfWayGroupCode, localAuthorityName: "Authority", sectorCode: "S1"} as VolunteerParish;
}

function assignment(id: string, parishCode: string, roleType: VolunteerRoleType, supporterId: string): VolunteerAssignment {
  return {
    id,
    groupCode: "KENT",
    parishCode,
    supporterId,
    identityStatus: VolunteerAssignmentIdentityStatus.LINKED,
    roleType,
    coverage: VolunteerAssignmentCoverage.PERMANENT,
    status: VolunteerAssignmentStatus.ACTIVE,
    effectiveFrom: 1_700_000_000_000
  } as VolunteerAssignment;
}

const parishes = [
  parish("P1", "Pembury", "Tunbridge Wells"),
  parish("P2", "Speldhurst", "Tunbridge Wells"),
  parish("P3", "Bridge", "Canterbury")
];

const assignments = [
  assignment("a1", "P1", VolunteerRoleType.PARISH_FOOTPATH_OBSERVER, "m1"),
  assignment("a2", "P2", VolunteerRoleType.LOCAL_FOOTPATH_OFFICER, "m1"),
  assignment("a3", "P3", VolunteerRoleType.PARISH_FOOTPATH_OBSERVER, "m2")
];

const members = [
  {id: "m1", firstName: "Ann", lastName: "Walker", email: "ann@example.org"},
  {id: "m2", firstName: "Bob", lastName: "Hill", email: "bob@example.org"}
];

describe("rightsOfWayGroupMatches", () => {
  it("matches case-insensitively and treats no filter as a match", () => {
    expect(rightsOfWayGroupMatches("Tunbridge Wells", "tunbridge wells")).toBe(true);
    expect(rightsOfWayGroupMatches("Canterbury", "Tunbridge Wells")).toBe(false);
    expect(rightsOfWayGroupMatches(undefined, null)).toBe(true);
  });
});

describe("filterVolunteerParishes with a rights-of-way group", () => {
  it("keeps only the parishes in the chosen group", () => {
    const result = filterVolunteerParishes(parishes, assignments, members, {searchText: "", roleFilter: null, summaryFilter: null, rightsOfWayGroupCode: "Tunbridge Wells"});
    expect(result.map(item => item.parishCode)).toEqual(["P1", "P2"]);
  });

  it("finds parishes by typing the group name into the search box", () => {
    const result = filterVolunteerParishes(parishes, assignments, members, {searchText: "canterbury", roleFilter: null, summaryFilter: null});
    expect(result.map(item => item.parishCode)).toEqual(["P3"]);
  });
});

describe("filterVolunteerSupporterRows with a rights-of-way group", () => {
  it("keeps volunteers with an active assignment in the chosen group", () => {
    const rows = volunteerSupporterRows(assignments, parishes, members);
    const result = filterVolunteerSupporterRows(rows, {searchText: "", roleFilter: null, statusFilter: null, coverageFilter: null, rightsOfWayGroupCode: "Canterbury"});
    expect(result.map(row => row.displayName)).toEqual(["Bob Hill"]);
  });
});

describe("volunteerReport scoped to a rights-of-way group", () => {
  const input: VolunteerReportInput = {
    parishes,
    assignments,
    members,
    contacts: [],
    formatDate: value => String(value),
    rightsOfWayGroupCode: "Tunbridge Wells"
  };

  it("drops parishes and assignments outside the group", () => {
    const scoped = scopeReportInputToRightsOfWayGroup(input);
    expect(scoped.parishes.map(item => item.parishCode)).toEqual(["P1", "P2"]);
    expect(scoped.assignments.map(item => item.id)).toEqual(["a1", "a2"]);
  });

  it("lists only the group's role holders, with the group named on each row", () => {
    const report = volunteerReport(VolunteerReportType.ACTIVE_ROLE_HOLDERS, input);
    expect(report.rows.map(row => `${row.volunteer}|${row.role}|${row.rightsOfWayGroup}|${row.parishNames}`)).toEqual([
      "Ann Walker|Local Footpath Officer|Tunbridge Wells|Speldhurst",
      "Ann Walker|Parish Footpath Observer|Tunbridge Wells|Pembury"
    ]);
    expect(report.description).toContain("Tunbridge Wells rights-of-way group only");
  });

  it("leaves everything in when no group is chosen", () => {
    const report = volunteerReport(VolunteerReportType.ACTIVE_ROLE_HOLDERS, {...input, rightsOfWayGroupCode: null});
    expect(report.rows.length).toBe(3);
  });
});
