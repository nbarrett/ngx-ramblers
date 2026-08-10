import expect from "expect";
import { describe, it } from "mocha";
import {
  filterVolunteerSupporterRows,
  volunteerAdminAllowed,
  volunteerAssignmentConflicts,
  volunteerAssignmentFieldChanges,
  volunteerCoverageSummary,
  volunteerMergeFieldsFor,
  volunteerRoleCapacityWarning,
  volunteerSupporterRows
} from "../../../projects/ngx-ramblers/src/app/functions/volunteer-management";
import {
  VolunteerAssignment,
  VolunteerAssignmentCoverage,
  VolunteerAssignmentIdentityStatus,
  VolunteerAssignmentStatus,
  VolunteerAssignmentStatusFilter,
  VolunteerParish,
  VolunteerParishEligibility,
  VolunteerRoleType,
  VolunteerSupporterIdentity
} from "../../../projects/ngx-ramblers/src/app/models/volunteer-management.model";

describe("volunteer management", () => {
  it("accepts older member-admin sessions until a volunteer permission is present", () => {
    expect(volunteerAdminAllowed({memberAdmin: true})).toEqual(true);
    expect(volunteerAdminAllowed({memberAdmin: true, volunteerAdmin: false})).toEqual(false);
    expect(volunteerAdminAllowed({memberAdmin: false, volunteerAdmin: true})).toEqual(true);
    expect(volunteerAdminAllowed({memberAdmin: false})).toEqual(false);
  });

  it("derives vacancies, temporary cover and distinct supporter totals from active assignments", () => {
    const parishes = [
      {groupCode: "EK", parishCode: "A", parishName: "Alpha", eligibility: VolunteerParishEligibility.ACTIVE},
      {groupCode: "EK", parishCode: "B", parishName: "Beta", eligibility: VolunteerParishEligibility.ACTIVE},
      {groupCode: "EK", parishCode: "C", parishName: "Gamma", eligibility: VolunteerParishEligibility.NO_PUBLIC_RIGHTS_OF_WAY}
    ] as VolunteerParish[];
    const assignment = (parishCode: string, roleType: VolunteerRoleType, supporterId: string, coverage: VolunteerAssignmentCoverage, status = VolunteerAssignmentStatus.ACTIVE): VolunteerAssignment => ({
      groupCode: "EK",
      parishCode,
      supporterId,
      identityStatus: VolunteerAssignmentIdentityStatus.LINKED,
      roleType,
      coverage,
      status,
      effectiveFrom: 1,
      createdAt: 1,
      createdBy: "test",
      updatedAt: 1,
      updatedBy: "test"
    });
    const assignments = [
      assignment("A", VolunteerRoleType.LOCAL_FOOTPATH_OFFICER, "supporter-1", VolunteerAssignmentCoverage.PERMANENT),
      assignment("A", VolunteerRoleType.PARISH_FOOTPATH_OBSERVER, "supporter-1", VolunteerAssignmentCoverage.TEMPORARY),
      assignment("B", VolunteerRoleType.PARISH_FOOTPATH_OBSERVER, "supporter-2", VolunteerAssignmentCoverage.PERMANENT, VolunteerAssignmentStatus.ENDED),
      assignment("C", VolunteerRoleType.LOCAL_FOOTPATH_OFFICER, "supporter-3", VolunteerAssignmentCoverage.PERMANENT)
    ];

    expect(volunteerCoverageSummary(parishes, assignments)).toEqual({
      parishCount: 3,
      eligibleParishCount: 2,
      activeAssignmentCount: 3,
      supporterCount: 2,
      localFootpathOfficerVacancies: 1,
      parishFootpathObserverVacancies: 1,
      temporaryAssignmentCount: 1
    });
  });

  describe("volunteer-centred rows", () => {
    const parishes = [
      {groupCode: "EK", parishCode: "A", parishName: "Alpha", localAuthorityName: "Alpha District", eligibility: VolunteerParishEligibility.ACTIVE},
      {groupCode: "EK", parishCode: "B", parishName: "Beta", localAuthorityName: "Beta District", eligibility: VolunteerParishEligibility.ACTIVE}
    ] as VolunteerParish[];
    const members: VolunteerSupporterIdentity[] = [
      {id: "supporter-1", firstName: "Ada", lastName: "Lovelace", email: "ada@example.org"},
      {id: "supporter-2", firstName: "Alan", lastName: "Turing", email: "alan@example.org"}
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

    it("groups assignments by supporter and summarises roles, parishes and cover", () => {
      const rows = volunteerSupporterRows([
        assignment({id: "one"}),
        assignment({id: "two", parishCode: "B", roleType: VolunteerRoleType.PARISH_FOOTPATH_OBSERVER, coverage: VolunteerAssignmentCoverage.TEMPORARY}),
        assignment({id: "three", supporterId: "supporter-2", parishCode: "B"})
      ], parishes, members);

      expect(rows.length).toEqual(2);
      const ada = rows.find(row => row.supporterId === "supporter-1");
      expect(ada.displayName).toEqual("Ada Lovelace");
      expect(ada.email).toEqual("ada@example.org");
      expect(ada.roles).toEqual("Local Footpath Officer, Parish Footpath Observer");
      expect(ada.parishes).toEqual("Alpha, Beta");
      expect(ada.parishCount).toEqual(2);
      expect(ada.activeAssignmentCount).toEqual(2);
      expect(ada.cover).toEqual("1 permanent, 1 temporary");
      expect(ada.statusLabel).toEqual("Active");
    });

    it("keeps ended assignments as history and reports supporters with no active assignments", () => {
      const rows = volunteerSupporterRows([
        assignment({id: "one", status: VolunteerAssignmentStatus.ENDED, effectiveTo: 5})
      ], parishes, members);

      expect(rows.length).toEqual(1);
      expect(rows[0].activeAssignmentCount).toEqual(0);
      expect(rows[0].endedAssignmentCount).toEqual(1);
      expect(rows[0].roles).toEqual("—");
      expect(rows[0].cover).toEqual("—");
      expect(rows[0].statusLabel).toEqual("No active assignments");
    });

    it("groups unresolved assignments by name rather than merging them into one volunteer", () => {
      const rows = volunteerSupporterRows([
        assignment({id: "one", supporterId: null, unresolvedName: "Jo Bloggs", identityStatus: VolunteerAssignmentIdentityStatus.UNRESOLVED}),
        assignment({id: "two", supporterId: null, unresolvedName: "jo bloggs", parishCode: "B", identityStatus: VolunteerAssignmentIdentityStatus.UNRESOLVED}),
        assignment({id: "three", supporterId: null, unresolvedName: "Pat Smith", identityStatus: VolunteerAssignmentIdentityStatus.UNRESOLVED})
      ], parishes, members);

      expect(rows.length).toEqual(2);
      expect(rows.map(row => row.displayName).sort()).toEqual(["Jo Bloggs", "Pat Smith"]);
      expect(rows.every(row => row.supporterId === null)).toEqual(true);
      expect(rows.find(row => row.displayName === "Jo Bloggs").activeAssignmentCount).toEqual(2);
    });

    it("filters volunteer rows by search text, role, cover and assignment status", () => {
      const rows = volunteerSupporterRows([
        assignment({id: "one"}),
        assignment({id: "two", supporterId: "supporter-2", parishCode: "B", roleType: VolunteerRoleType.PARISH_FOOTPATH_OBSERVER, coverage: VolunteerAssignmentCoverage.TEMPORARY}),
        assignment({id: "three", supporterId: null, unresolvedName: "Jo Bloggs", status: VolunteerAssignmentStatus.ENDED, effectiveTo: 5, identityStatus: VolunteerAssignmentIdentityStatus.UNRESOLVED})
      ], parishes, members);
      const noFilters = {searchText: "", roleFilter: null, statusFilter: null, coverageFilter: null};

      expect(filterVolunteerSupporterRows(rows, noFilters).length).toEqual(3);
      expect(filterVolunteerSupporterRows(rows, {...noFilters, searchText: "turing"}).map(row => row.displayName)).toEqual(["Alan Turing"]);
      expect(filterVolunteerSupporterRows(rows, {...noFilters, searchText: "alpha"}).map(row => row.displayName)).toEqual(["Ada Lovelace"]);
      expect(filterVolunteerSupporterRows(rows, {...noFilters, roleFilter: VolunteerRoleType.PARISH_FOOTPATH_OBSERVER}).map(row => row.displayName)).toEqual(["Alan Turing"]);
      expect(filterVolunteerSupporterRows(rows, {...noFilters, coverageFilter: VolunteerAssignmentCoverage.TEMPORARY}).map(row => row.displayName)).toEqual(["Alan Turing"]);
      expect(filterVolunteerSupporterRows(rows, {...noFilters, statusFilter: VolunteerAssignmentStatusFilter.NONE_ACTIVE}).map(row => row.displayName)).toEqual(["Jo Bloggs"]);
      expect(filterVolunteerSupporterRows(rows, {...noFilters, statusFilter: VolunteerAssignmentStatusFilter.ENDED}).map(row => row.displayName)).toEqual(["Jo Bloggs"]);
      expect(filterVolunteerSupporterRows(rows, {...noFilters, statusFilter: VolunteerAssignmentStatusFilter.ACTIVE}).length).toEqual(2);
    });

    it("warns about overlapping permanent cover but allows temporary overlaps", () => {
      const existing = [assignment({id: "existing", effectiveFrom: 100, effectiveTo: 200})];
      const candidate = {
        groupCode: "EK",
        parishCode: "A",
        supporterId: "supporter-2",
        identityStatus: VolunteerAssignmentIdentityStatus.LINKED,
        roleType: VolunteerRoleType.LOCAL_FOOTPATH_OFFICER,
        coverage: VolunteerAssignmentCoverage.PERMANENT,
        effectiveFrom: 150
      };

      const conflicts = volunteerAssignmentConflicts(existing, candidate, members);
      expect(conflicts.length).toEqual(1);
      expect(conflicts[0].displayName).toEqual("Ada Lovelace");
      expect(conflicts[0].assignmentId).toEqual("existing");

      expect(volunteerAssignmentConflicts(existing, {...candidate, coverage: VolunteerAssignmentCoverage.TEMPORARY}, members)).toEqual([]);
      expect(volunteerAssignmentConflicts(existing, {...candidate, roleType: VolunteerRoleType.PARISH_FOOTPATH_OBSERVER}, members)).toEqual([]);
      expect(volunteerAssignmentConflicts(existing, {...candidate, parishCode: "B"}, members)).toEqual([]);
      expect(volunteerAssignmentConflicts(existing, {...candidate, effectiveFrom: 300}, members)).toEqual([]);
      expect(volunteerAssignmentConflicts(existing, {...candidate, id: "existing"}, members)).toEqual([]);
    });

    it("treats Parish Footpath Observers as an unbounded list but warns on a second Local Footpath Officer", () => {
      const observer = (id: string, supporterId: string) => assignment({id, supporterId, roleType: VolunteerRoleType.PARISH_FOOTPATH_OBSERVER});
      const candidate = {
        groupCode: "EK",
        parishCode: "A",
        supporterId: "supporter-2",
        identityStatus: VolunteerAssignmentIdentityStatus.LINKED,
        roleType: VolunteerRoleType.PARISH_FOOTPATH_OBSERVER,
        coverage: VolunteerAssignmentCoverage.PERMANENT,
        effectiveFrom: 150
      };

      expect(volunteerRoleCapacityWarning([observer("one", "supporter-1"), observer("two", "supporter-2"), observer("three", "supporter-1")], candidate, members)).toEqual(null);

      const secondOfficer = volunteerRoleCapacityWarning([assignment({id: "lfo"})], {...candidate, roleType: VolunteerRoleType.LOCAL_FOOTPATH_OFFICER}, members);
      expect(secondOfficer.limit).toEqual(1);
      expect(secondOfficer.roleLabel).toEqual("Local Footpath Officer");
      expect(secondOfficer.holderNames).toEqual(["Ada Lovelace"]);

      expect(volunteerRoleCapacityWarning([assignment({id: "lfo"})], {...candidate, roleType: VolunteerRoleType.LOCAL_FOOTPATH_OFFICER, id: "lfo"}, members)).toEqual(null);
    });

    it("treats an existing open-ended permanent assignment as overlapping a later start", () => {
      const existing = [assignment({id: "existing", effectiveFrom: 100})];
      const conflicts = volunteerAssignmentConflicts(existing, {
        groupCode: "EK",
        parishCode: "A",
        supporterId: "supporter-2",
        identityStatus: VolunteerAssignmentIdentityStatus.LINKED,
        roleType: VolunteerRoleType.LOCAL_FOOTPATH_OFFICER,
        coverage: VolunteerAssignmentCoverage.PERMANENT,
        effectiveFrom: 5000
      }, members);
      expect(conflicts.length).toEqual(1);
    });

    it("records only the fields that actually changed", () => {
      const before = assignment({id: "one", coverage: VolunteerAssignmentCoverage.PERMANENT, notes: "original"});
      const after = assignment({id: "one", coverage: VolunteerAssignmentCoverage.TEMPORARY, notes: "original", supporterId: "supporter-2"});

      expect(volunteerAssignmentFieldChanges(before, after)).toEqual([
        {fieldName: "supporterId", from: "supporter-1", to: "supporter-2"},
        {fieldName: "coverage", from: "permanent", to: "temporary"}
      ]);
      expect(volunteerAssignmentFieldChanges(before, before)).toEqual([]);
    });

    it("builds the merge fields a letter needs from a volunteer's own assignments", () => {
      const held = [
        assignment({id: "one", parishCode: "B", roleType: VolunteerRoleType.PARISH_FOOTPATH_OBSERVER, coverage: VolunteerAssignmentCoverage.TEMPORARY, effectiveFrom: 300}),
        assignment({id: "two", parishCode: "A", effectiveFrom: 200}),
        assignment({id: "three", parishCode: "A", supporterId: "supporter-2"}),
        assignment({id: "four", parishCode: "A", status: VolunteerAssignmentStatus.ENDED, effectiveTo: 9})
      ];
      const mergeFields = volunteerMergeFieldsFor("supporter-1", held, parishes, members, value => `date-${value}`);

      expect(mergeFields.ROLES).toEqual("Local Footpath Officer, Parish Footpath Observer");
      expect(mergeFields.PARISH_COUNT).toEqual("2");
      expect(mergeFields.PARISH_NAMES).toEqual("Alpha, Beta");
      expect(mergeFields.AUTHORITIES).toEqual("Alpha District, Beta District");
      expect(mergeFields.COVER).toEqual("Permanent, Temporary");
      expect(mergeFields.EARLIEST_START).toEqual("date-200");
      expect(mergeFields.PARISH_TABLE).toContain("<table");
      expect(mergeFields.PARISH_TABLE).toContain("Alpha");
      expect(mergeFields.PARISH_TABLE).toContain("Beta");
      expect(mergeFields.PARISH_TABLE).toContain("Temporary");
    });

    it("leaves the merge fields empty for someone with no current assignments", () => {
      const mergeFields = volunteerMergeFieldsFor("supporter-9", [assignment({id: "one"})], parishes, members, value => `date-${value}`);
      expect(mergeFields.PARISH_COUNT).toEqual("0");
      expect(mergeFields.PARISH_NAMES).toEqual("");
      expect(mergeFields.PARISH_TABLE).toEqual("");
      expect(mergeFields.EARLIEST_START).toEqual("");
    });

    it("builds a counterpart table listing the other officers covering the same parishes", () => {
      const held = [
        assignment({id: "one", parishCode: "A"}),
        assignment({id: "counterpart", parishCode: "A", supporterId: "supporter-2", roleType: VolunteerRoleType.PARISH_FOOTPATH_OBSERVER}),
        assignment({id: "elsewhere", parishCode: "B", supporterId: "supporter-2"})
      ];
      const mergeFields = volunteerMergeFieldsFor("supporter-1", held, parishes, members, value => `date-${value}`);
      expect(mergeFields.COUNTERPART_TABLE).toContain("Alan Turing");
      expect(mergeFields.COUNTERPART_TABLE).toContain("Parish Footpath Observer");
      expect(mergeFields.COUNTERPART_TABLE).toContain("alan@example.org");
      expect(mergeFields.COUNTERPART_TABLE).not.toContain("Beta");
      expect(volunteerMergeFieldsFor("supporter-2", held, parishes, members, value => `date-${value}`).COUNTERPART_TABLE).toContain("Ada Lovelace");
      expect(volunteerMergeFieldsFor("supporter-9", [], parishes, members, value => `date-${value}`).COUNTERPART_TABLE).toEqual("");
    });

    it("escapes parish names so a letter cannot be broken by stray markup", () => {
      const escapedParishes = [{groupCode: "EK", parishCode: "A", parishName: "Alpha <b>& Co</b>", eligibility: VolunteerParishEligibility.ACTIVE}] as VolunteerParish[];
      const mergeFields = volunteerMergeFieldsFor("supporter-1", [assignment({id: "one"})], escapedParishes, members, value => `date-${value}`);
      expect(mergeFields.PARISH_TABLE).toContain("Alpha &lt;b&gt;&amp; Co&lt;/b&gt;");
      expect(mergeFields.PARISH_TABLE).not.toContain("<b>");
    });

    it("records every populated field when an assignment is created", () => {
      const created = assignment({id: "one", notes: "new record"});
      const changes = volunteerAssignmentFieldChanges(null, created);
      expect(changes.map(change => change.fieldName)).toEqual(["supporterId", "roleType", "coverage", "status", "effectiveFrom", "notes"]);
      expect(changes.every(change => change.from === "")).toEqual(true);
    });
  });
});
