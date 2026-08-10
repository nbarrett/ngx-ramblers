import { isString } from "es-toolkit/compat";
import { ParishFeatureProperties } from "../models/parish-map.model";
import { ParishCoverageFilter, ParishFilterSelectOption, ParishOverlayFilter } from "../models/area-map.model";
import {
  VolunteerAssignmentCoverage,
  VolunteerAssignmentIdentityStatus,
  VolunteerAssignmentRequest,
  VolunteerMapAssignment,
  VolunteerParish,
  VolunteerParishEligibility,
  VolunteerRoleType
} from "../models/volunteer-management.model";

export function footpathObserverAssignment(assignments: VolunteerMapAssignment[] | undefined): VolunteerMapAssignment | null {
  return assignments?.find(assignment => assignment.roleType === VolunteerRoleType.PARISH_FOOTPATH_OBSERVER) ?? null;
}

export function assignmentsByParishCode(assignments: VolunteerMapAssignment[]): Map<string, VolunteerMapAssignment[]> {
  return assignments.reduce((byParish, assignment) =>
    byParish.set(assignment.parishCode, [...(byParish.get(assignment.parishCode) ?? []), assignment]),
    new Map<string, VolunteerMapAssignment[]>());
}

export function parishesByCode(parishes: VolunteerParish[]): Map<string, VolunteerParish> {
  return parishes.reduce((byCode, parish) => byCode.set(parish.parishCode, parish), new Map<string, VolunteerParish>());
}

export function withoutAssignment(assignments: VolunteerMapAssignment[], assignmentId: string): VolunteerMapAssignment[] {
  return assignments.filter(item => item.id !== assignmentId);
}

export function withFootpathObserverAssignment(assignments: VolunteerMapAssignment[], saved: VolunteerMapAssignment): VolunteerMapAssignment[] {
  const otherAssignments = assignments.filter(item => item.id !== saved.id && item.roleType !== VolunteerRoleType.PARISH_FOOTPATH_OBSERVER);
  return [...otherAssignments, saved];
}

export function footpathObserverAssignmentRequest(existing: VolunteerMapAssignment | null, groupCode: string, parishCode: string, supporterId: string, effectiveFrom: number | null): VolunteerAssignmentRequest {
  return existing ? {
    id: existing.id,
    groupCode,
    parishCode: existing.parishCode,
    supporterId,
    unresolvedName: null,
    identityStatus: VolunteerAssignmentIdentityStatus.LINKED,
    roleType: existing.roleType,
    coverage: existing.coverage
  } : {
    groupCode,
    parishCode,
    supporterId,
    identityStatus: VolunteerAssignmentIdentityStatus.LINKED,
    roleType: VolunteerRoleType.PARISH_FOOTPATH_OBSERVER,
    coverage: VolunteerAssignmentCoverage.PERMANENT,
    effectiveFrom
  };
}

export function volunteerParishFor(existingParish: VolunteerParish | undefined, groupCode: string, props: ParishFeatureProperties): VolunteerParish {
  return existingParish ?? {
    groupCode,
    parishCode: props.PARNCP24CD,
    parishName: props.PARNCP24NM,
    eligibility: VolunteerParishEligibility.ACTIVE
  };
}

export function parishTooltipText(parishName: string, assignment: VolunteerMapAssignment | null, resolvedAssigneeName: string | null): string {
  const statusText = assignment ? " (PFO covered)" : " (PFO vacant)";
  const assigneeText = isString(resolvedAssigneeName)
    ? ` - ${resolvedAssigneeName}`
    : assignment?.unresolvedName ? ` - ${assignment.unresolvedName}` : "";
  return `${parishName}${statusText}${assigneeText}`;
}

export function parishMatchesCoverageFilter(filter: ParishCoverageFilter, assignments: VolunteerMapAssignment[]): boolean {
  const localFootpathOfficerCovered = assignments.some(assignment => assignment.roleType === VolunteerRoleType.LOCAL_FOOTPATH_OFFICER);
  const parishFootpathObserverCovered = assignments.some(assignment => assignment.roleType === VolunteerRoleType.PARISH_FOOTPATH_OBSERVER);
  const temporaryCover = assignments.some(assignment => assignment.coverage === VolunteerAssignmentCoverage.TEMPORARY);
  return filter === ParishCoverageFilter.LFO_COVERED ? localFootpathOfficerCovered
    : filter === ParishCoverageFilter.LFO_VACANT ? !localFootpathOfficerCovered
      : filter === ParishCoverageFilter.PFO_COVERED ? parishFootpathObserverCovered
        : filter === ParishCoverageFilter.PFO_VACANT ? !parishFootpathObserverCovered
          : temporaryCover;
}

export function parishOverlayFilterActive(filter: ParishOverlayFilter): boolean {
  return filter.coverage.length > 0 || filter.rightsOfWayGroupCode.length > 0 || filter.localAuthorityCode.length > 0 || filter.sectorCode.length > 0;
}

export function parishMatchesOverlayFilter(filter: ParishOverlayFilter, parish: VolunteerParish | undefined, assignments: VolunteerMapAssignment[]): boolean {
  const coverageMatches = filter.coverage.length === 0 || filter.coverage.some(option => parishMatchesCoverageFilter(option, assignments));
  const rightsOfWayGroupMatches = filter.rightsOfWayGroupCode.length === 0 || (!!parish?.rightsOfWayGroupCode && filter.rightsOfWayGroupCode.includes(parish.rightsOfWayGroupCode));
  const localAuthorityMatches = filter.localAuthorityCode.length === 0 || (!!parish?.localAuthorityCode && filter.localAuthorityCode.includes(parish.localAuthorityCode));
  const sectorMatches = filter.sectorCode.length === 0 || (!!parish?.sectorCode && filter.sectorCode.includes(parish.sectorCode));
  return coverageMatches && rightsOfWayGroupMatches && localAuthorityMatches && sectorMatches;
}

function distinctFilterOptions(parishes: VolunteerParish[], valueFor: (parish: VolunteerParish) => string, labelFor: (parish: VolunteerParish) => string): ParishFilterSelectOption[] {
  const optionsByValue = parishes.reduce((byValue, parish) => {
    const value = valueFor(parish);
    return value && !byValue.has(value)
      ? byValue.set(value, {value, label: labelFor(parish) || value})
      : byValue;
  }, new Map<string, ParishFilterSelectOption>());
  return [...optionsByValue.values()].sort((first, second) => first.label.localeCompare(second.label));
}

export function rightsOfWayGroupFilterOptions(parishes: VolunteerParish[]): ParishFilterSelectOption[] {
  return distinctFilterOptions(parishes, parish => parish.rightsOfWayGroupCode, parish => parish.rightsOfWayGroupCode);
}

export function localAuthorityFilterOptions(parishes: VolunteerParish[]): ParishFilterSelectOption[] {
  return distinctFilterOptions(parishes, parish => parish.localAuthorityCode, parish => parish.localAuthorityName);
}

export function sectorFilterOptions(parishes: VolunteerParish[]): ParishFilterSelectOption[] {
  return distinctFilterOptions(parishes, parish => parish.sectorCode, parish => parish.sectorCode);
}

export const PARISH_CATEGORICAL_PALETTE: string[] = [
  "#4a8c3f", "#1f77b4", "#ff7f0e", "#9467bd", "#8c564b", "#e377c2", "#17becf", "#bcbd22",
  "#d62728", "#2ca02c", "#7f7f7f", "#393b79", "#a55194", "#637939", "#8c6d31", "#843c39"
];

export function categoricalColourMap(codes: string[]): Map<string, string> {
  return codes.reduce((byCode, code, index) =>
    byCode.set(code, PARISH_CATEGORICAL_PALETTE[index % PARISH_CATEGORICAL_PALETTE.length]),
    new Map<string, string>());
}
