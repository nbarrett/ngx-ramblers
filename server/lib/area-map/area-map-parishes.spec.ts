import expect from "expect";
import { describe, it } from "mocha";
import {
  localAuthorityFilterOptions,
  parishMatchesCoverageFilter,
  parishMatchesOverlayFilter,
  parishOverlayFilterActive,
  rightsOfWayGroupFilterOptions,
  sectorFilterOptions
} from "../../../projects/ngx-ramblers/src/app/functions/area-map-parishes";
import { ParishCoverageFilter, ParishOverlayFilter } from "../../../projects/ngx-ramblers/src/app/models/area-map.model";
import {
  VolunteerAssignmentCoverage,
  VolunteerAssignmentStatus,
  VolunteerMapAssignment,
  VolunteerParish,
  VolunteerParishEligibility,
  VolunteerRoleType
} from "../../../projects/ngx-ramblers/src/app/models/volunteer-management.model";

describe("area map parish filtering", () => {

  const localFootpathOfficer: VolunteerMapAssignment = {
    id: "lfo-1",
    parishCode: "E04001129",
    roleType: VolunteerRoleType.LOCAL_FOOTPATH_OFFICER,
    coverage: VolunteerAssignmentCoverage.PERMANENT,
    status: VolunteerAssignmentStatus.ACTIVE
  };

  const parishFootpathObserver: VolunteerMapAssignment = {
    id: "pfo-1",
    parishCode: "E04001129",
    roleType: VolunteerRoleType.PARISH_FOOTPATH_OBSERVER,
    coverage: VolunteerAssignmentCoverage.PERMANENT,
    status: VolunteerAssignmentStatus.ACTIVE
  };

  const temporaryObserver: VolunteerMapAssignment = {
    id: "pfo-2",
    parishCode: "E04001130",
    roleType: VolunteerRoleType.PARISH_FOOTPATH_OBSERVER,
    coverage: VolunteerAssignmentCoverage.TEMPORARY,
    status: VolunteerAssignmentStatus.ACTIVE
  };

  const parish = (overrides: Partial<VolunteerParish>): VolunteerParish => ({
    groupCode: "AR",
    parishCode: "E04001129",
    parishName: "Allhallows",
    eligibility: VolunteerParishEligibility.ACTIVE,
    ...overrides
  });

  const emptyFilter: ParishOverlayFilter = {
    coverage: [],
    rightsOfWayGroupCode: [],
    localAuthorityCode: [],
    sectorCode: []
  };

  describe("parishMatchesCoverageFilter", () => {
    it("matches LFO covered and vacant on the presence of a local footpath officer", () => {
      expect(parishMatchesCoverageFilter(ParishCoverageFilter.LFO_COVERED, [localFootpathOfficer])).toBe(true);
      expect(parishMatchesCoverageFilter(ParishCoverageFilter.LFO_COVERED, [parishFootpathObserver])).toBe(false);
      expect(parishMatchesCoverageFilter(ParishCoverageFilter.LFO_VACANT, [parishFootpathObserver])).toBe(true);
      expect(parishMatchesCoverageFilter(ParishCoverageFilter.LFO_VACANT, [localFootpathOfficer])).toBe(false);
    });

    it("matches PFO covered and vacant on the presence of a parish footpath observer", () => {
      expect(parishMatchesCoverageFilter(ParishCoverageFilter.PFO_COVERED, [parishFootpathObserver])).toBe(true);
      expect(parishMatchesCoverageFilter(ParishCoverageFilter.PFO_COVERED, [localFootpathOfficer])).toBe(false);
      expect(parishMatchesCoverageFilter(ParishCoverageFilter.PFO_VACANT, [])).toBe(true);
      expect(parishMatchesCoverageFilter(ParishCoverageFilter.PFO_VACANT, [parishFootpathObserver])).toBe(false);
    });

    it("matches temporary cover on any temporary assignment regardless of role", () => {
      expect(parishMatchesCoverageFilter(ParishCoverageFilter.TEMPORARY_COVER, [temporaryObserver])).toBe(true);
      expect(parishMatchesCoverageFilter(ParishCoverageFilter.TEMPORARY_COVER, [localFootpathOfficer, parishFootpathObserver])).toBe(false);
      expect(parishMatchesCoverageFilter(ParishCoverageFilter.TEMPORARY_COVER, [{...localFootpathOfficer, coverage: VolunteerAssignmentCoverage.TEMPORARY}])).toBe(true);
    });
  });

  describe("parishOverlayFilterActive", () => {
    it("reports an empty filter as inactive", () => {
      expect(parishOverlayFilterActive(emptyFilter)).toBe(false);
    });

    it("reports any populated dimension as active", () => {
      expect(parishOverlayFilterActive({...emptyFilter, coverage: [ParishCoverageFilter.PFO_VACANT]})).toBe(true);
      expect(parishOverlayFilterActive({...emptyFilter, rightsOfWayGroupCode: ["GR01"]})).toBe(true);
      expect(parishOverlayFilterActive({...emptyFilter, localAuthorityCode: ["BR1"]})).toBe(true);
      expect(parishOverlayFilterActive({...emptyFilter, sectorCode: ["1"]})).toBe(true);
    });
  });

  describe("parishMatchesOverlayFilter", () => {
    it("matches everything when the filter is empty", () => {
      expect(parishMatchesOverlayFilter(emptyFilter, undefined, [])).toBe(true);
    });

    it("combines coverage options with any-of semantics", () => {
      const filter = {...emptyFilter, coverage: [ParishCoverageFilter.LFO_COVERED, ParishCoverageFilter.PFO_COVERED]};
      expect(parishMatchesOverlayFilter(filter, undefined, [parishFootpathObserver])).toBe(true);
      expect(parishMatchesOverlayFilter(filter, undefined, [localFootpathOfficer])).toBe(true);
      expect(parishMatchesOverlayFilter(filter, undefined, [])).toBe(false);
    });

    it("combines separate dimensions with all-of semantics", () => {
      const filter = {...emptyFilter, coverage: [ParishCoverageFilter.PFO_COVERED], rightsOfWayGroupCode: ["GR02"]};
      expect(parishMatchesOverlayFilter(filter, parish({rightsOfWayGroupCode: "GR02"}), [parishFootpathObserver])).toBe(true);
      expect(parishMatchesOverlayFilter(filter, parish({rightsOfWayGroupCode: "GR01"}), [parishFootpathObserver])).toBe(false);
      expect(parishMatchesOverlayFilter(filter, parish({rightsOfWayGroupCode: "GR02"}), [])).toBe(false);
    });

    it("filters by local authority and sector codes", () => {
      expect(parishMatchesOverlayFilter({...emptyFilter, localAuthorityCode: ["BR1"]}, parish({localAuthorityCode: "BR1"}), [])).toBe(true);
      expect(parishMatchesOverlayFilter({...emptyFilter, localAuthorityCode: ["BR1"]}, parish({localAuthorityCode: "BR2"}), [])).toBe(false);
      expect(parishMatchesOverlayFilter({...emptyFilter, sectorCode: ["3"]}, parish({sectorCode: "3"}), [])).toBe(true);
      expect(parishMatchesOverlayFilter({...emptyFilter, sectorCode: ["3"]}, parish({sectorCode: "1"}), [])).toBe(false);
    });

    it("excludes parishes with no volunteer record when a code filter is set", () => {
      expect(parishMatchesOverlayFilter({...emptyFilter, rightsOfWayGroupCode: ["GR01"]}, undefined, [])).toBe(false);
      expect(parishMatchesOverlayFilter({...emptyFilter, coverage: [ParishCoverageFilter.PFO_VACANT]}, undefined, [])).toBe(true);
    });
  });

  describe("filter option builders", () => {
    const parishes: VolunteerParish[] = [
      parish({parishCode: "E1", rightsOfWayGroupCode: "GR02", localAuthorityCode: "BR2", localAuthorityName: "Southern District", sectorCode: "3"}),
      parish({parishCode: "E2", rightsOfWayGroupCode: "GR01", localAuthorityCode: "BR1", localAuthorityName: "Northern District", sectorCode: "1"}),
      parish({parishCode: "E3", rightsOfWayGroupCode: "GR01", localAuthorityCode: "BR1", localAuthorityName: "Northern District", sectorCode: "1"}),
      parish({parishCode: "E4"})
    ];

    it("builds distinct sorted rights of way group options labelled by code", () => {
      expect(rightsOfWayGroupFilterOptions(parishes)).toEqual([
        {value: "GR01", label: "GR01"},
        {value: "GR02", label: "GR02"}
      ]);
    });

    it("builds local authority options labelled by name", () => {
      expect(localAuthorityFilterOptions(parishes)).toEqual([
        {value: "BR1", label: "Northern District"},
        {value: "BR2", label: "Southern District"}
      ]);
    });

    it("falls back to the code when an authority has no name", () => {
      expect(localAuthorityFilterOptions([parish({localAuthorityCode: "BR9"})])).toEqual([
        {value: "BR9", label: "BR9"}
      ]);
    });

    it("builds sector options and skips parishes without a sector", () => {
      expect(sectorFilterOptions(parishes)).toEqual([
        {value: "1", label: "1"},
        {value: "3", label: "3"}
      ]);
    });
  });
});
