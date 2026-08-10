import {
  VolunteerAreaCoverageStat,
  VolunteerAssignment,
  VolunteerAssignmentCoverage,
  VolunteerParish,
  VolunteerParishEligibility,
  VolunteerRoleCoverageStat,
  VolunteerRoleCoverState,
  VolunteerRoleHolderStat,
  VolunteerRoleType,
  VolunteerStatistics
} from "../models/volunteer-management.model";
import {
  volunteerActiveAssignments,
  volunteerAssignmentsForParish,
  volunteerRoleLabel,
  volunteerSupporterKey
} from "./volunteer-management";

const PARISH_ROLES = [VolunteerRoleType.LOCAL_FOOTPATH_OFFICER, VolunteerRoleType.PARISH_FOOTPATH_OBSERVER];

export function volunteerParishRoleCoverState(activeAssignments: VolunteerAssignment[], parishCode: string, roleType: VolunteerRoleType): VolunteerRoleCoverState {
  const roleAssignments = volunteerAssignmentsForParish(activeAssignments, parishCode, roleType);
  if (roleAssignments.length === 0) {
    return VolunteerRoleCoverState.VACANT;
  } else if (roleAssignments.some(assignment => assignment.coverage === VolunteerAssignmentCoverage.PERMANENT)) {
    return VolunteerRoleCoverState.PERMANENT;
  } else {
    return VolunteerRoleCoverState.TEMPORARY;
  }
}

function eligibleParishes(parishes: VolunteerParish[]): VolunteerParish[] {
  return parishes.filter(parish => parish.eligibility === VolunteerParishEligibility.ACTIVE);
}

function roleCoverageStat(parishes: VolunteerParish[], activeAssignments: VolunteerAssignment[], roleType: VolunteerRoleType): VolunteerRoleCoverageStat {
  const states = parishes.map(parish => volunteerParishRoleCoverState(activeAssignments, parish.parishCode, roleType));
  return {
    roleType,
    roleLabel: volunteerRoleLabel(roleType),
    eligibleParishes: parishes.length,
    permanent: states.filter(state => state === VolunteerRoleCoverState.PERMANENT).length,
    temporary: states.filter(state => state === VolunteerRoleCoverState.TEMPORARY).length,
    vacant: states.filter(state => state === VolunteerRoleCoverState.VACANT).length
  };
}

function holderKeys(activeAssignments: VolunteerAssignment[], parishCodes: Set<string> | null, roleType: VolunteerRoleType): Set<string> {
  return new Set(activeAssignments
    .filter(assignment => assignment.roleType === roleType && (!parishCodes || parishCodes.has(assignment.parishCode)))
    .map(assignment => volunteerSupporterKey(assignment)));
}

function roleHolderStat(activeAssignments: VolunteerAssignment[]): VolunteerRoleHolderStat {
  const localFootpathOfficerKeys = holderKeys(activeAssignments, null, VolunteerRoleType.LOCAL_FOOTPATH_OFFICER);
  const parishFootpathObserverKeys = holderKeys(activeAssignments, null, VolunteerRoleType.PARISH_FOOTPATH_OBSERVER);
  return {
    localFootpathOfficers: localFootpathOfficerKeys.size,
    parishFootpathObservers: parishFootpathObserverKeys.size,
    bothRoles: Array.from(localFootpathOfficerKeys).filter(key => parishFootpathObserverKeys.has(key)).length,
    groupCoordinators: holderKeys(activeAssignments, null, VolunteerRoleType.GROUP_COORDINATOR).size,
    needingReconciliation: new Set(activeAssignments.filter(assignment => !assignment.supporterId).map(assignment => volunteerSupporterKey(assignment))).size
  };
}

function areaCoverageStat(key: string, areaParishes: VolunteerParish[], activeAssignments: VolunteerAssignment[]): VolunteerAreaCoverageStat {
  const parishCodes = new Set(areaParishes.map(parish => parish.parishCode));
  const vacancies = (roleType: VolunteerRoleType): number =>
    areaParishes.filter(parish => volunteerParishRoleCoverState(activeAssignments, parish.parishCode, roleType) === VolunteerRoleCoverState.VACANT).length;
  return {
    key,
    label: key || "Not set",
    eligibleParishes: areaParishes.length,
    localFootpathOfficerVacancies: vacancies(VolunteerRoleType.LOCAL_FOOTPATH_OFFICER),
    parishFootpathObserverVacancies: vacancies(VolunteerRoleType.PARISH_FOOTPATH_OBSERVER),
    localFootpathOfficerHolders: holderKeys(activeAssignments, parishCodes, VolunteerRoleType.LOCAL_FOOTPATH_OFFICER).size,
    parishFootpathObserverHolders: holderKeys(activeAssignments, parishCodes, VolunteerRoleType.PARISH_FOOTPATH_OBSERVER).size
  };
}

function groupParishes(parishes: VolunteerParish[], keyOf: (parish: VolunteerParish) => string): Map<string, VolunteerParish[]> {
  return parishes.reduce((groups: Map<string, VolunteerParish[]>, parish) => {
    const key = keyOf(parish) ?? "";
    groups.set(key, [...(groups.get(key) ?? []), parish]);
    return groups;
  }, new Map<string, VolunteerParish[]>());
}

function areaStats(parishes: VolunteerParish[], activeAssignments: VolunteerAssignment[], keyOf: (parish: VolunteerParish) => string): VolunteerAreaCoverageStat[] {
  return Array.from(groupParishes(parishes, keyOf).entries())
    .map(([key, areaParishes]) => areaCoverageStat(key, areaParishes, activeAssignments))
    .sort((first, second) => second.eligibleParishes - first.eligibleParishes || first.label.localeCompare(second.label));
}

export function volunteerStatistics(parishes: VolunteerParish[], assignments: VolunteerAssignment[]): VolunteerStatistics {
  const activeAssignments = volunteerActiveAssignments(assignments);
  const eligible = eligibleParishes(parishes);
  return {
    totalParishes: parishes.length,
    eligibleParishes: eligible.length,
    noPublicRightsOfWay: parishes.length - eligible.length,
    activeAssignments: activeAssignments.length,
    temporaryAssignments: activeAssignments.filter(assignment => assignment.coverage === VolunteerAssignmentCoverage.TEMPORARY).length,
    distinctVolunteers: new Set(activeAssignments.map(assignment => volunteerSupporterKey(assignment))).size,
    coverage: PARISH_ROLES.map(roleType => roleCoverageStat(eligible, activeAssignments, roleType)),
    roleHolders: roleHolderStat(activeAssignments),
    bySector: areaStats(eligible, activeAssignments, parish => parish.sectorCode ?? ""),
    byGroup: areaStats(eligible, activeAssignments, parish => parish.rightsOfWayGroupCode ?? "")
  };
}
