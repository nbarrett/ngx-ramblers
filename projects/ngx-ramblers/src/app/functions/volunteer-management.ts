import {
  VolunteerAssignment,
  VolunteerAssignmentConflict,
  VolunteerAssignmentCoverage,
  VolunteerAssignmentFieldChange,
  VolunteerAssignmentIdentityStatus,
  VolunteerAssignmentRequest,
  VolunteerAssignmentScope,
  VolunteerAssignmentStatus,
  VolunteerAssignmentStatusFilter,
  VolunteerCoverageSummary,
  VolunteerParish,
  VolunteerParishEligibility,
  VolunteerParishFilterCriteria,
  VolunteerParishTableRow,
  VolunteerRoleCapacityWarning,
  VolunteerRoleType,
  VolunteerSummaryFilter,
  VolunteerSupporterAssignment,
  VolunteerSupporterFilterCriteria,
  VolunteerSupporterIdentity,
  VolunteerSupporterRow,
  VOLUNTEER_ROLE_MAX_ASSIGNEES
} from "../models/volunteer-management.model";
import { MemberCookie } from "../models/member.model";
import { VolunteerMergeFields } from "../models/mail.model";
import { isNumber, isUndefined, uniq } from "es-toolkit/compat";
import { memberFullName } from "./member-names";

export function volunteerAdminAllowed(member: Partial<MemberCookie>): boolean {
  return member.volunteerAdmin === true || (isUndefined(member.volunteerAdmin) && member.memberAdmin === true);
}

export function volunteerRoleLabel(roleType: VolunteerRoleType): string {
  if (roleType === VolunteerRoleType.LOCAL_FOOTPATH_OFFICER) {
    return "Local Footpath Officer";
  } else if (roleType === VolunteerRoleType.PARISH_FOOTPATH_OBSERVER) {
    return "Parish Footpath Observer";
  } else {
    return "Group Coordinator";
  }
}

export function volunteerCoverLabel(coverage: VolunteerAssignmentCoverage): string {
  return coverage === VolunteerAssignmentCoverage.TEMPORARY ? "Temporary" : "Permanent";
}

export function volunteerSupporterName(supporterId: string | null | undefined, members: VolunteerSupporterIdentity[]): string {
  const supporter = supporterId ? members.find(member => member.id === supporterId) : null;
  return supporter ? memberFullName(supporter) : "";
}

export function volunteerAssignmentDisplayName(assignment: VolunteerAssignment, members: VolunteerSupporterIdentity[]): string {
  return volunteerSupporterName(assignment.supporterId, members) || assignment.unresolvedName || "Needs reconciliation";
}

export function volunteerSupporterKey(assignment: VolunteerAssignment): string {
  if (assignment.supporterId) {
    return assignment.supporterId;
  } else if (assignment.unresolvedName) {
    return `unresolved:${assignment.unresolvedName.trim().toLowerCase()}`;
  } else {
    return `unresolved-assignment:${assignment.id}`;
  }
}

function volunteerCoverSummary(permanentCount: number, temporaryCount: number): string {
  const parts = [
    permanentCount > 0 ? `${permanentCount} permanent` : null,
    temporaryCount > 0 ? `${temporaryCount} temporary` : null
  ].filter(part => part);
  return parts.length > 0 ? parts.join(", ") : "—";
}

function byMostRecentlyEffective(first: VolunteerSupporterAssignment, second: VolunteerSupporterAssignment): number {
  return (second.assignment.effectiveFrom ?? 0) - (first.assignment.effectiveFrom ?? 0);
}

export function volunteerSupporterRows(assignments: VolunteerAssignment[], parishes: VolunteerParish[], members: VolunteerSupporterIdentity[]): VolunteerSupporterRow[] {
  const parishLookup = new Map(parishes.map(parish => [parish.parishCode, parish]));
  const grouped = assignments.reduce((groups: Map<string, VolunteerSupporterAssignment[]>, assignment) => {
    const parish = parishLookup.get(assignment.parishCode);
    const key = volunteerSupporterKey(assignment);
    groups.set(key, [...(groups.get(key) ?? []), {
      assignment,
      assignmentId: assignment.id ?? "",
      parishName: volunteerAssignmentScopeLabel(assignment, parish?.parishName),
      localAuthorityName: parish?.localAuthorityName ?? "",
      roleLabel: volunteerRoleLabel(assignment.roleType),
      coverLabel: volunteerCoverLabel(assignment.coverage)
    }]);
    return groups;
  }, new Map<string, VolunteerSupporterAssignment[]>());
  return Array.from(grouped.entries()).map(([key, supporterAssignments]) => {
    const firstAssignment = supporterAssignments[0].assignment;
    const supporter = firstAssignment.supporterId ? members.find(member => member.id === firstAssignment.supporterId) : null;
    const active = supporterAssignments.filter(entry => entry.assignment.status === VolunteerAssignmentStatus.ACTIVE).sort(byMostRecentlyEffective);
    const ended = supporterAssignments.filter(entry => entry.assignment.status === VolunteerAssignmentStatus.ENDED).sort(byMostRecentlyEffective);
    const permanentCount = active.filter(entry => entry.assignment.coverage === VolunteerAssignmentCoverage.PERMANENT).length;
    const temporaryCount = active.filter(entry => entry.assignment.coverage === VolunteerAssignmentCoverage.TEMPORARY).length;
    const roles = uniq(active.map(entry => entry.roleLabel));
    const parishNames = uniq(active.map(entry => entry.parishName));
    return {
      key,
      supporterId: firstAssignment.supporterId ?? null,
      displayName: volunteerAssignmentDisplayName(firstAssignment, members),
      email: supporter?.email ?? "",
      identityStatus: supporter ? VolunteerAssignmentIdentityStatus.LINKED : VolunteerAssignmentIdentityStatus.UNRESOLVED,
      roles: roles.length > 0 ? roles.join(", ") : "—",
      parishes: parishNames.length > 0 ? parishNames.join(", ") : "—",
      parishCount: parishNames.length,
      activeAssignmentCount: active.length,
      endedAssignmentCount: ended.length,
      temporaryAssignmentCount: temporaryCount,
      permanentAssignmentCount: permanentCount,
      cover: volunteerCoverSummary(permanentCount, temporaryCount),
      statusLabel: active.length > 0 ? "Active" : "No active assignments",
      assignments: [...active, ...ended]
    };
  });
}

const VOLUNTEER_ASSIGNMENT_OPEN_ENDED = Number.MAX_SAFE_INTEGER;

function volunteerAssignmentRangesOverlap(firstFrom: number, firstTo: number, secondFrom: number, secondTo: number): boolean {
  return firstFrom <= secondTo && secondFrom <= firstTo;
}

export function volunteerAssignmentConflicts(activeAssignments: VolunteerAssignment[], candidate: VolunteerAssignmentRequest, members: VolunteerSupporterIdentity[]): VolunteerAssignmentConflict[] {
  if (candidate.coverage === VolunteerAssignmentCoverage.TEMPORARY) {
    return [];
  } else {
    const candidateFrom = candidate.effectiveFrom ?? 0;
    const candidateTo = candidate.effectiveTo ?? VOLUNTEER_ASSIGNMENT_OPEN_ENDED;
    return activeAssignments
      .filter(assignment => assignment.id !== candidate.id
        && assignment.parishCode === candidate.parishCode
        && assignment.roleType === candidate.roleType
        && assignment.coverage === VolunteerAssignmentCoverage.PERMANENT
        && volunteerAssignmentRangesOverlap(candidateFrom, candidateTo, assignment.effectiveFrom ?? 0, assignment.effectiveTo ?? VOLUNTEER_ASSIGNMENT_OPEN_ENDED))
      .map(assignment => ({
        assignmentId: assignment.id ?? "",
        displayName: volunteerAssignmentDisplayName(assignment, members),
        roleLabel: volunteerRoleLabel(assignment.roleType),
        effectiveFrom: assignment.effectiveFrom,
        effectiveTo: assignment.effectiveTo
      }));
  }
}

export function volunteerRoleCapacityWarning(activeAssignments: VolunteerAssignment[], candidate: VolunteerAssignmentRequest, members: VolunteerSupporterIdentity[]): VolunteerRoleCapacityWarning | null {
  const limit = VOLUNTEER_ROLE_MAX_ASSIGNEES[candidate.roleType];
  const holders = activeAssignments.filter(assignment => assignment.id !== candidate.id
    && assignment.parishCode === candidate.parishCode
    && assignment.roleType === candidate.roleType);
  if (isNumber(limit) && holders.length >= limit) {
    return {
      limit,
      roleLabel: volunteerRoleLabel(candidate.roleType),
      holderNames: holders.map(assignment => volunteerAssignmentDisplayName(assignment, members))
    };
  } else {
    return null;
  }
}

export function volunteerAssignmentFieldChanges(before: Partial<VolunteerAssignment> | null, after: Partial<VolunteerAssignment>): VolunteerAssignmentFieldChange[] {
  const trackedFields = ["supporterId", "unresolvedName", "roleType", "coverage", "status", "effectiveFrom", "effectiveTo", "notes"];
  return trackedFields.reduce((changes: VolunteerAssignmentFieldChange[], fieldName) => {
    const from = before ? before[fieldName] : null;
    const to = after[fieldName];
    const unchanged = (from ?? null) === (to ?? null) || (isUndefined(to) && !!before);
    return unchanged ? changes : [...changes, {fieldName, from: volunteerAuditValue(from), to: volunteerAuditValue(to)}];
  }, []);
}

function volunteerAuditValue(value: any): string {
  return value === null || isUndefined(value) ? "" : String(value);
}

export function volunteerMergeFieldsFor(supporterId: string, assignments: VolunteerAssignment[], parishes: VolunteerParish[], members: VolunteerSupporterIdentity[], formatDate: (value: number) => string): VolunteerMergeFields {
  const parishLookup = new Map(parishes.map(parish => [parish.parishCode, parish]));
  const active = volunteerActiveAssignments(assignments);
  const held = active
    .filter(assignment => assignment.supporterId === supporterId)
    .map(assignment => ({assignment, parish: parishLookup.get(assignment.parishCode) ?? null}))
    .sort((first, second) => (first.parish?.parishName ?? "").localeCompare(second.parish?.parishName ?? ""));
  const parishNames = uniq(held.map(entry => entry.parish?.parishName ?? entry.assignment.parishCode));
  const startDates = held.map(entry => entry.assignment.effectiveFrom).filter(value => value);
  return {
    ROLES: uniq(held.map(entry => volunteerRoleLabel(entry.assignment.roleType))).join(", "),
    PARISH_COUNT: String(parishNames.length),
    PARISH_NAMES: parishNames.join(", "),
    PARISH_TABLE: volunteerParishTableHtml(held, formatDate),
    COUNTERPART_TABLE: volunteerCounterpartTableHtml(supporterId, held, active, parishLookup, members),
    AUTHORITIES: uniq(held.map(entry => entry.parish?.localAuthorityName).filter(value => value)).join(", "),
    SECTORS: uniq(held.map(entry => entry.parish?.sectorCode).filter(value => value)).join(", "),
    ROW_GROUPS: uniq(held.map(entry => entry.parish?.rightsOfWayGroupCode).filter(value => value)).join(", "),
    COVER: uniq(held.map(entry => volunteerCoverLabel(entry.assignment.coverage))).join(", "),
    EARLIEST_START: startDates.length > 0 ? formatDate(Math.min(...startDates)) : ""
  };
}

function volunteerCounterpartTableHtml(supporterId: string, held: {assignment: VolunteerAssignment; parish: VolunteerParish | null}[], active: VolunteerAssignment[], parishLookup: Map<string, VolunteerParish>, members: VolunteerSupporterIdentity[]): string {
  const heldParishCodes = new Set(held.map(entry => entry.assignment.parishCode).filter(code => code));
  const memberLookup = new Map(members.map(member => [member.id, member]));
  const counterparts = active
    .filter(assignment => assignment.parishCode
      && heldParishCodes.has(assignment.parishCode)
      && assignment.supporterId !== supporterId)
    .map(assignment => ({
      assignment,
      parish: parishLookup.get(assignment.parishCode) ?? null,
      email: assignment.supporterId ? memberLookup.get(assignment.supporterId)?.email ?? "" : ""
    }))
    .sort((first, second) => (first.parish?.parishName ?? "").localeCompare(second.parish?.parishName ?? "")
      || volunteerRoleLabel(first.assignment.roleType).localeCompare(volunteerRoleLabel(second.assignment.roleType)));
  const rows = counterparts.map(entry => `<tr><td style="${EMAIL_CELL_STYLE}">${escapeHtmlValue(entry.assignment.parishCode)}</td><td style="${EMAIL_CELL_STYLE}">${escapeHtmlValue(entry.parish?.parishName ?? "")}</td><td style="${EMAIL_CELL_STYLE}">${escapeHtmlValue(volunteerRoleLabel(entry.assignment.roleType))}</td><td style="${EMAIL_CELL_STYLE}">${escapeHtmlValue(volunteerAssignmentDisplayName(entry.assignment, members))}</td><td style="${EMAIL_WRAP_CELL_STYLE}">${escapeHtmlValue(entry.email)}</td></tr>`).join("");
  return counterparts.length > 0
    ? `<table role="presentation" style="${EMAIL_TABLE_STYLE}"><thead><tr><th style="${EMAIL_HEADER_STYLE}">Code</th><th style="${EMAIL_HEADER_STYLE}">Parish</th><th style="${EMAIL_HEADER_STYLE}">Role</th><th style="${EMAIL_HEADER_STYLE}">Name</th><th style="${EMAIL_HEADER_STYLE}">Email</th></tr></thead><tbody>${rows}</tbody></table>`
    : "";
}

function escapeHtmlValue(value: string): string {
  return (value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const EMAIL_TABLE_STYLE = "width:100%;border-collapse:collapse;font-size:15px;margin:6px 0 18px;border:1px solid #e3e8e4;border-radius:8px;overflow:hidden;";
const EMAIL_HEADER_STYLE = "text-align:left;padding:10px 14px;background:#eef4ef;border-bottom:2px solid #cfe0d4;font-weight:600;white-space:nowrap;color:#404143;";
const EMAIL_CELL_STYLE = "padding:10px 14px;border-bottom:1px solid #edf1ee;vertical-align:top;white-space:nowrap;";
const EMAIL_WRAP_CELL_STYLE = "padding:10px 14px;border-bottom:1px solid #edf1ee;vertical-align:top;word-break:break-word;";

function volunteerParishTableHtml(held: {assignment: VolunteerAssignment; parish: VolunteerParish | null}[], formatDate: (value: number) => string): string {
  const rows = held.map(entry => `<tr><td style="${EMAIL_CELL_STYLE}">${escapeHtmlValue(entry.parish?.parishName ?? entry.assignment.parishCode)}</td><td style="${EMAIL_CELL_STYLE}">${escapeHtmlValue(volunteerRoleLabel(entry.assignment.roleType))}</td><td style="${EMAIL_CELL_STYLE}">${escapeHtmlValue(volunteerCoverLabel(entry.assignment.coverage))}</td><td style="${EMAIL_CELL_STYLE}">${escapeHtmlValue(entry.parish?.localAuthorityName ?? "")}</td><td style="${EMAIL_CELL_STYLE}">${escapeHtmlValue(entry.assignment.effectiveFrom ? formatDate(entry.assignment.effectiveFrom) : "")}</td></tr>`).join("");
  return held.length > 0
    ? `<table role="presentation" style="${EMAIL_TABLE_STYLE}"><thead><tr><th style="${EMAIL_HEADER_STYLE}">Parish</th><th style="${EMAIL_HEADER_STYLE}">Role</th><th style="${EMAIL_HEADER_STYLE}">Cover</th><th style="${EMAIL_HEADER_STYLE}">Authority</th><th style="${EMAIL_HEADER_STYLE}">From</th></tr></thead><tbody>${rows}</tbody></table>`
    : "";
}

export function volunteerActiveAssignments(assignments: VolunteerAssignment[]): VolunteerAssignment[] {
  return assignments.filter(assignment => assignment.status === VolunteerAssignmentStatus.ACTIVE);
}

export function volunteerAssignmentIsParishScoped(assignment: VolunteerAssignment): boolean {
  return !assignment.scope || assignment.scope === VolunteerAssignmentScope.PARISH;
}

export function volunteerAssignmentScopeLabel(assignment: VolunteerAssignment, parishName?: string): string {
  if (assignment.scope === VolunteerAssignmentScope.RIGHTS_OF_WAY_GROUP) {
    return `${assignment.rightsOfWayGroupCode || "Unknown group"} (whole group)`;
  } else if (assignment.scope === VolunteerAssignmentScope.SECTOR) {
    return `${assignment.sectorCode || "Unknown sector"} (whole sector)`;
  } else {
    return parishName || assignment.parishCode || "";
  }
}

export function volunteerAssignmentsForParish(assignments: VolunteerAssignment[], parishCode: string, roleType?: VolunteerRoleType): VolunteerAssignment[] {
  return assignments.filter(assignment => volunteerAssignmentIsParishScoped(assignment)
    && assignment.parishCode === parishCode
    && (!roleType || assignment.roleType === roleType));
}

export function volunteerAssignmentNameList(activeAssignments: VolunteerAssignment[], parishCode: string, roleType: VolunteerRoleType, members: VolunteerSupporterIdentity[]): string[] {
  return volunteerAssignmentsForParish(activeAssignments, parishCode, roleType).map(assignment => volunteerAssignmentDisplayName(assignment, members));
}

export function volunteerAssignmentNames(activeAssignments: VolunteerAssignment[], parishCode: string, roleType: VolunteerRoleType, members: VolunteerSupporterIdentity[]): string {
  const names = volunteerAssignmentNameList(activeAssignments, parishCode, roleType, members);
  return names.length > 0 ? names.join(", ") : "Vacant";
}

export function volunteerParishHasVacancy(activeAssignments: VolunteerAssignment[], parishCode: string): boolean {
  return volunteerAssignmentsForParish(activeAssignments, parishCode, VolunteerRoleType.LOCAL_FOOTPATH_OFFICER).length === 0
    || volunteerAssignmentsForParish(activeAssignments, parishCode, VolunteerRoleType.PARISH_FOOTPATH_OBSERVER).length === 0;
}

export function volunteerParishCoverageLabel(activeAssignments: VolunteerAssignment[], parishCode: string): string {
  const localFootpathOfficerVacant = volunteerAssignmentsForParish(activeAssignments, parishCode, VolunteerRoleType.LOCAL_FOOTPATH_OFFICER).length === 0;
  const parishFootpathObserverVacant = volunteerAssignmentsForParish(activeAssignments, parishCode, VolunteerRoleType.PARISH_FOOTPATH_OBSERVER).length === 0;
  if (localFootpathOfficerVacant && parishFootpathObserverVacant) {
    return "LFO & PFO vacant";
  } else if (localFootpathOfficerVacant) {
    return "LFO vacant";
  } else if (parishFootpathObserverVacant) {
    return "PFO vacant";
  } else {
    return "Covered";
  }
}

export function volunteerParishSummaryFilterMatches(parish: VolunteerParish, assignments: VolunteerAssignment[], summaryFilter: VolunteerSummaryFilter | null): boolean {
  const eligible = parish.eligibility === VolunteerParishEligibility.ACTIVE;
  const hasLocalFootpathOfficer = assignments.some(assignment => assignment.roleType === VolunteerRoleType.LOCAL_FOOTPATH_OFFICER);
  const hasParishFootpathObserver = assignments.some(assignment => assignment.roleType === VolunteerRoleType.PARISH_FOOTPATH_OBSERVER);
  if (summaryFilter === VolunteerSummaryFilter.ELIGIBLE_PARISHES) {
    return eligible;
  } else if (summaryFilter === VolunteerSummaryFilter.LOCAL_FOOTPATH_OFFICER_COVERED) {
    return eligible && hasLocalFootpathOfficer;
  } else if (summaryFilter === VolunteerSummaryFilter.LOCAL_FOOTPATH_OFFICER_VACANT) {
    return eligible && !hasLocalFootpathOfficer;
  } else if (summaryFilter === VolunteerSummaryFilter.PARISH_FOOTPATH_OBSERVER_COVERED) {
    return eligible && hasParishFootpathObserver;
  } else if (summaryFilter === VolunteerSummaryFilter.PARISH_FOOTPATH_OBSERVER_VACANT) {
    return eligible && !hasParishFootpathObserver;
  } else if (summaryFilter === VolunteerSummaryFilter.TEMPORARY_ASSIGNMENTS) {
    return assignments.some(assignment => assignment.coverage === VolunteerAssignmentCoverage.TEMPORARY);
  } else if (summaryFilter === VolunteerSummaryFilter.NEEDS_RECONCILIATION) {
    return assignments.some(assignment => assignment.identityStatus === VolunteerAssignmentIdentityStatus.UNRESOLVED);
  } else if (summaryFilter === VolunteerSummaryFilter.ACTIVE_SUPPORTERS) {
    return assignments.some(assignment => !!assignment.supporterId);
  } else {
    return true;
  }
}

export function filterVolunteerParishes(parishes: VolunteerParish[], activeAssignments: VolunteerAssignment[], members: VolunteerSupporterIdentity[], criteria: VolunteerParishFilterCriteria): VolunteerParish[] {
  const searchText = criteria.searchText.trim().toLowerCase();
  return parishes.filter(parish => {
    const assignments = volunteerAssignmentsForParish(activeAssignments, parish.parishCode);
    const textMatches = !searchText || [parish.parishName, parish.parishCode, parish.localAuthorityName, parish.sectorCode, ...assignments.map(assignment => volunteerAssignmentDisplayName(assignment, members))]
      .some(value => value?.toLowerCase().includes(searchText));
    const roleMatches = !criteria.roleFilter || assignments.some(assignment => assignment.roleType === criteria.roleFilter);
    return textMatches && roleMatches && volunteerParishSummaryFilterMatches(parish, assignments, criteria.summaryFilter);
  });
}

export function volunteerParishTableRows(parishes: VolunteerParish[], activeAssignments: VolunteerAssignment[], members: VolunteerSupporterIdentity[]): VolunteerParishTableRow[] {
  return parishes.map(parish => {
    const localFootpathOfficerNames = volunteerAssignmentNameList(activeAssignments, parish.parishCode, VolunteerRoleType.LOCAL_FOOTPATH_OFFICER, members);
    const parishFootpathObserverNames = volunteerAssignmentNameList(activeAssignments, parish.parishCode, VolunteerRoleType.PARISH_FOOTPATH_OBSERVER, members);
    return {
      ...parish,
      authority: [parish.localAuthorityName, parish.sectorCode].filter(value => value).join(" "),
      localFootpathOfficer: localFootpathOfficerNames.length > 0 ? localFootpathOfficerNames.join(", ") : "Vacant",
      parishFootpathObserver: parishFootpathObserverNames.length > 0 ? parishFootpathObserverNames.join(", ") : "Vacant",
      localFootpathOfficerNames,
      parishFootpathObserverNames,
      coverage: volunteerParishCoverageLabel(activeAssignments, parish.parishCode),
      hasVacancy: volunteerParishHasVacancy(activeAssignments, parish.parishCode),
      assignmentCount: volunteerAssignmentsForParish(activeAssignments, parish.parishCode).length
    };
  });
}

export function filterVolunteerSupporterRows(rows: VolunteerSupporterRow[], criteria: VolunteerSupporterFilterCriteria): VolunteerSupporterRow[] {
  const searchText = criteria.searchText.trim().toLowerCase();
  return rows.filter(row => {
    const textMatches = !searchText || [row.displayName, row.email, row.roles, row.parishes]
      .some(value => value?.toLowerCase().includes(searchText));
    const roleMatches = !criteria.roleFilter || row.assignments
      .some(entry => entry.assignment.status === VolunteerAssignmentStatus.ACTIVE && entry.assignment.roleType === criteria.roleFilter);
    const coverageMatches = !criteria.coverageFilter || row.assignments
      .some(entry => entry.assignment.status === VolunteerAssignmentStatus.ACTIVE && entry.assignment.coverage === criteria.coverageFilter);
    return textMatches && roleMatches && coverageMatches && volunteerSupporterStatusMatches(row, criteria.statusFilter);
  });
}

function volunteerSupporterStatusMatches(row: VolunteerSupporterRow, statusFilter: VolunteerAssignmentStatusFilter | null): boolean {
  if (statusFilter === VolunteerAssignmentStatusFilter.ACTIVE) {
    return row.activeAssignmentCount > 0;
  } else if (statusFilter === VolunteerAssignmentStatusFilter.ENDED) {
    return row.endedAssignmentCount > 0;
  } else if (statusFilter === VolunteerAssignmentStatusFilter.NONE_ACTIVE) {
    return row.activeAssignmentCount === 0;
  } else {
    return true;
  }
}

export function volunteerCoverageSummary(parishes: VolunteerParish[], assignments: VolunteerAssignment[]): VolunteerCoverageSummary {
  const eligibleParishes = parishes.filter(parish => parish.eligibility === VolunteerParishEligibility.ACTIVE);
  const activeAssignments = assignments.filter(assignment => assignment.status === VolunteerAssignmentStatus.ACTIVE);
  const assignedParishCodes = (roleType: VolunteerRoleType): Set<string> => new Set(activeAssignments
    .filter(assignment => assignment.roleType === roleType)
    .map(assignment => assignment.parishCode));
  const localFootpathOfficerParishes = assignedParishCodes(VolunteerRoleType.LOCAL_FOOTPATH_OFFICER);
  const parishFootpathObserverParishes = assignedParishCodes(VolunteerRoleType.PARISH_FOOTPATH_OBSERVER);
  return {
    parishCount: parishes.length,
    eligibleParishCount: eligibleParishes.length,
    activeAssignmentCount: activeAssignments.length,
    supporterCount: new Set(activeAssignments.map(assignment => assignment.supporterId).filter(supporterId => supporterId)).size,
    localFootpathOfficerVacancies: eligibleParishes.filter(parish => !localFootpathOfficerParishes.has(parish.parishCode)).length,
    parishFootpathObserverVacancies: eligibleParishes.filter(parish => !parishFootpathObserverParishes.has(parish.parishCode)).length,
    temporaryAssignmentCount: activeAssignments.filter(assignment => assignment.coverage === VolunteerAssignmentCoverage.TEMPORARY).length
  };
}
