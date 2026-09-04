import {
  VolunteerAssignment,
  VolunteerAssignmentCoverage,
  VolunteerAssignmentStatus,
  VolunteerDirectoryColumn,
  VolunteerParish,
  VolunteerParishEligibility,
  VolunteerReport,
  VolunteerReportType,
  VolunteerRoleType,
  VolunteerSupporterIdentity,
  VolunteerSupporterRow
} from "../models/volunteer-management.model";
import { ExternalRecipient } from "../models/external-recipient.model";
import {
  volunteerActiveAssignments,
  volunteerAssignmentDisplayName,
  volunteerAssignmentNames,
  volunteerAssignmentsForParish,
  volunteerAssignmentIsParishScoped,
  volunteerAssignmentScopeLabel,
  volunteerParishCoverageLabel,
  volunteerRoleLabel,
  rightsOfWayGroupMatches,
  volunteerSupporterRows
} from "./volunteer-management";
import { externalContactDisplayName, externalContactDuplicates, externalContactTypeLabel } from "./external-contacts";
import { externalContactLastActivity, staleExternalContacts } from "./external-contact-retention";
import { uniq } from "es-toolkit/compat";

export interface VolunteerReportInput {
  parishes: VolunteerParish[];
  assignments: VolunteerAssignment[];
  members: VolunteerSupporterIdentity[];
  contacts: ExternalRecipient[];
  formatDate: (value: number) => string;
  contactRetentionDays?: number;
  now?: number;
  directoryColumns?: VolunteerDirectoryColumn[];
  includeTemporaryAsVacant?: boolean;
  rightsOfWayGroupCode?: string | null;
}

const PARISH_ROLES = [VolunteerRoleType.LOCAL_FOOTPATH_OFFICER, VolunteerRoleType.PARISH_FOOTPATH_OBSERVER];
const ALL_ROLES = [...PARISH_ROLES, VolunteerRoleType.GROUP_COORDINATOR];

export function volunteerReportTitle(reportType: VolunteerReportType): string {
  if (reportType === VolunteerReportType.VACANCIES) {
    return "Vacancies by role and group";
  } else if (reportType === VolunteerReportType.COVER_TYPE) {
    return "Permanent and temporary cover";
  } else if (reportType === VolunteerReportType.PARISH_COVERAGE) {
    return "Parish coverage by authority, group and sector";
  } else if (reportType === VolunteerReportType.ACTIVE_ROLE_HOLDERS) {
    return "Current role holders";
  } else if (reportType === VolunteerReportType.COMBINED_ROLE_HOLDERS) {
    return "Volunteers holding both roles";
  } else if (reportType === VolunteerReportType.VOLUNTEERS_WITHOUT_ASSIGNMENTS) {
    return "Volunteers with no current assignments";
  } else if (reportType === VolunteerReportType.UNRESOLVED_SUPPORTER_LINKS) {
    return "Assignments not linked to a supporter";
  } else if (reportType === VolunteerReportType.MISSING_CONTACT_INFORMATION) {
    return "Data quality exceptions";
  } else if (reportType === VolunteerReportType.ASSIGNMENT_DIRECTORY) {
    return "Assignment directory";
  } else {
    return "Parish codes for mapping";
  }
}

function volunteerReportDescription(reportType: VolunteerReportType): string {
  if (reportType === VolunteerReportType.VACANCIES) {
    return "Every eligible parish with no active holder of a role. Parishes with no public rights of way are left out.";
  } else if (reportType === VolunteerReportType.COVER_TYPE) {
    return "Every active assignment with whether it is permanent or temporary cover, and the dates it runs between.";
  } else if (reportType === VolunteerReportType.PARISH_COVERAGE) {
    return "One row per parish with its authority, group and sector, and who currently covers each role.";
  } else if (reportType === VolunteerReportType.ACTIVE_ROLE_HOLDERS) {
    return "Everyone currently holding a Local Footpath Officer, Parish Footpath Observer or coordinator role, with the parishes they cover.";
  } else if (reportType === VolunteerReportType.COMBINED_ROLE_HOLDERS) {
    return "Volunteers who are both a Local Footpath Officer and a Parish Footpath Observer somewhere.";
  } else if (reportType === VolunteerReportType.VOLUNTEERS_WITHOUT_ASSIGNMENTS) {
    return "People who have held an assignment in the past but hold none now.";
  } else if (reportType === VolunteerReportType.UNRESOLVED_SUPPORTER_LINKS) {
    return "Assignments recorded against a name rather than a supporter record, which need reconciling.";
  } else if (reportType === VolunteerReportType.MISSING_CONTACT_INFORMATION) {
    return "Records that need attention: role holders with no email address, contacts missing an email or telephone number, contacts that look like duplicates, assignments or contacts pointing at a parish that no longer exists, and, where a retention window is set, contacts held longer than the window with no parish link.";
  } else if (reportType === VolunteerReportType.ASSIGNMENT_DIRECTORY) {
    return "One row per active assignment with the volunteer, their role and where they cover. Choose which contact columns to include before downloading.";
  } else {
    return "Official parish codes with their coverage status, laid out for use in mapping software.";
  }
}

export function scopeReportInputToRightsOfWayGroup(input: VolunteerReportInput): VolunteerReportInput {
  const groupCode = (input.rightsOfWayGroupCode || "").trim();
  if (!groupCode) {
    return input;
  } else {
    const parishes = input.parishes.filter(parish => rightsOfWayGroupMatches(parish.rightsOfWayGroupCode, groupCode));
    const parishCodes = new Set(parishes.map(parish => parish.parishCode));
    const assignments = input.assignments.filter(assignment => (assignment.parishCode && parishCodes.has(assignment.parishCode)) || rightsOfWayGroupMatches(assignment.rightsOfWayGroupCode, groupCode));
    return {...input, parishes, assignments};
  }
}

export function volunteerReport(reportType: VolunteerReportType, unscopedInput: VolunteerReportInput): VolunteerReport {
  const input = scopeReportInputToRightsOfWayGroup(unscopedInput);
  const activeAssignments = volunteerActiveAssignments(input.assignments);
  const supporterRows = volunteerSupporterRows(input.assignments, input.parishes, input.members);
  const scopeNote = input.rightsOfWayGroupCode ? ` Showing the ${input.rightsOfWayGroupCode} rights-of-way group only.` : "";
  return {
    type: reportType,
    title: volunteerReportTitle(reportType),
    description: volunteerReportDescription(reportType) + scopeNote,
    columns: reportColumns(reportType, input),
    rows: reportRows(reportType, input, activeAssignments, supporterRows),
    groupByKey: reportGroupByKey(reportType)
  };
}

function reportGroupByKey(reportType: VolunteerReportType): string | undefined {
  if (reportType === VolunteerReportType.VACANCIES) {
    return "rightsOfWayGroup";
  } else if (reportType === VolunteerReportType.PARISH_COVERAGE) {
    return "localAuthority";
  } else {
    return undefined;
  }
}

function reportColumns(reportType: VolunteerReportType, input: VolunteerReportInput): {key: string; label: string}[] {
  if (reportType === VolunteerReportType.VACANCIES) {
    return [
      {key: "parishName", label: "Parish"},
      {key: "parishCode", label: "Parish code"},
      {key: "role", label: "Vacant role"},
      {key: "status", label: "Status"},
      {key: "rightsOfWayGroup", label: "Rights-of-way group"},
      {key: "localAuthority", label: "Authority"},
      {key: "sector", label: "Sector"}
    ];
  } else if (reportType === VolunteerReportType.COVER_TYPE) {
    return [
      {key: "volunteer", label: "Volunteer"},
      {key: "role", label: "Role"},
      {key: "parishName", label: "Parish"},
      {key: "rightsOfWayGroup", label: "Rights-of-way group"},
      {key: "cover", label: "Cover"},
      {key: "effectiveFrom", label: "From"},
      {key: "effectiveTo", label: "To"}
    ];
  } else if (reportType === VolunteerReportType.PARISH_COVERAGE) {
    return [
      {key: "parishName", label: "Parish"},
      {key: "parishCode", label: "Parish code"},
      {key: "localAuthority", label: "Authority"},
      {key: "rightsOfWayGroup", label: "Rights-of-way group"},
      {key: "sector", label: "Sector"},
      {key: "localFootpathOfficer", label: "LFO"},
      {key: "parishFootpathObserver", label: "PFO"},
      {key: "coverage", label: "Coverage"}
    ];
  } else if (reportType === VolunteerReportType.ACTIVE_ROLE_HOLDERS) {
    return [
      {key: "volunteer", label: "Volunteer"},
      {key: "email", label: "Email"},
      {key: "role", label: "Role"},
      {key: "rightsOfWayGroup", label: "Rights-of-way group"},
      {key: "parishCount", label: "Parishes"},
      {key: "parishNames", label: "Parish names"}
    ];
  } else if (reportType === VolunteerReportType.COMBINED_ROLE_HOLDERS) {
    return [
      {key: "volunteer", label: "Volunteer"},
      {key: "email", label: "Email"},
      {key: "rightsOfWayGroup", label: "Rights-of-way group"},
      {key: "localFootpathOfficerParishes", label: "LFO parishes"},
      {key: "parishFootpathObserverParishes", label: "PFO parishes"}
    ];
  } else if (reportType === VolunteerReportType.VOLUNTEERS_WITHOUT_ASSIGNMENTS) {
    return [
      {key: "volunteer", label: "Volunteer"},
      {key: "email", label: "Email"},
      {key: "endedAssignmentCount", label: "Past assignments"},
      {key: "lastParishes", label: "Last covered"}
    ];
  } else if (reportType === VolunteerReportType.UNRESOLVED_SUPPORTER_LINKS) {
    return [
      {key: "recordedName", label: "Recorded name"},
      {key: "role", label: "Role"},
      {key: "parishName", label: "Parish"},
      {key: "cover", label: "Cover"},
      {key: "notes", label: "Notes"}
    ];
  } else if (reportType === VolunteerReportType.MISSING_CONTACT_INFORMATION) {
    return [
      {key: "name", label: "Name"},
      {key: "recordType", label: "Record"},
      {key: "missing", label: "Missing"},
      {key: "context", label: "Context"}
    ];
  } else if (reportType === VolunteerReportType.ASSIGNMENT_DIRECTORY) {
    const includeEmail = (input.directoryColumns ?? []).includes(VolunteerDirectoryColumn.EMAIL);
    const includeCouncilContact = (input.directoryColumns ?? []).includes(VolunteerDirectoryColumn.COUNCIL_CONTACT);
    return [
      {key: "volunteer", label: "Volunteer"},
      {key: "role", label: "Role"},
      {key: "target", label: "Covers"},
      {key: "localAuthority", label: "Authority"},
      {key: "rightsOfWayGroup", label: "Rights-of-way group"},
      {key: "sector", label: "Sector"},
      {key: "cover", label: "Cover"},
      ...(includeEmail ? [{key: "email", label: "Email"}] : []),
      ...(includeCouncilContact ? [
        {key: "councilContact", label: "Council contact"},
        {key: "councilContactEmail", label: "Council contact email"}
      ] : [])
    ];
  } else {
    return [
      {key: "parishCode", label: "PARISH_CODE"},
      {key: "parishName", label: "PARISH_NAME"},
      {key: "localAuthorityCode", label: "AUTHORITY_CODE"},
      {key: "localAuthorityName", label: "AUTHORITY_NAME"},
      {key: "sectorCode", label: "SECTOR"},
      {key: "parishType", label: "TYPE"},
      {key: "rightsOfWayGroupCode", label: "ROW_GROUP"},
      {key: "localFootpathOfficer", label: "LFO"},
      {key: "parishFootpathObserver", label: "PFO"},
      {key: "coverage", label: "COVERAGE"},
      {key: "eligible", label: "ELIGIBLE"}
    ];
  }
}

function reportRows(reportType: VolunteerReportType, input: VolunteerReportInput, activeAssignments: VolunteerAssignment[], supporterRows: VolunteerSupporterRow[]): Record<string, string | number>[] {
  if (reportType === VolunteerReportType.VACANCIES) {
    return vacancyRows(input, activeAssignments);
  } else if (reportType === VolunteerReportType.COVER_TYPE) {
    return coverTypeRows(input, activeAssignments);
  } else if (reportType === VolunteerReportType.PARISH_COVERAGE) {
    return parishCoverageRows(input, activeAssignments);
  } else if (reportType === VolunteerReportType.ACTIVE_ROLE_HOLDERS) {
    return activeRoleHolderRows(supporterRows);
  } else if (reportType === VolunteerReportType.COMBINED_ROLE_HOLDERS) {
    return combinedRoleHolderRows(supporterRows);
  } else if (reportType === VolunteerReportType.VOLUNTEERS_WITHOUT_ASSIGNMENTS) {
    return volunteersWithoutAssignmentRows(supporterRows);
  } else if (reportType === VolunteerReportType.UNRESOLVED_SUPPORTER_LINKS) {
    return unresolvedSupporterRows(input, activeAssignments);
  } else if (reportType === VolunteerReportType.MISSING_CONTACT_INFORMATION) {
    return [
      ...missingContactInformationRows(input, supporterRows),
      ...duplicateContactRows(input),
      ...invalidParishLinkRows(input, activeAssignments),
      ...retentionReviewRows(input)
    ];
  } else if (reportType === VolunteerReportType.ASSIGNMENT_DIRECTORY) {
    return assignmentDirectoryRows(input, activeAssignments);
  } else {
    return parishCodeRows(input, activeAssignments);
  }
}

function assignmentDirectoryRows(input: VolunteerReportInput, activeAssignments: VolunteerAssignment[]): Record<string, string | number>[] {
  const parishLookup = new Map(input.parishes.map(parish => [parish.parishCode, parish]));
  const memberLookup = new Map(input.members.map(member => [member.id, member]));
  const includeEmail = (input.directoryColumns ?? []).includes(VolunteerDirectoryColumn.EMAIL);
  const includeCouncilContact = (input.directoryColumns ?? []).includes(VolunteerDirectoryColumn.COUNCIL_CONTACT);
  return activeAssignments
    .map(assignment => {
      const parish = parishLookup.get(assignment.parishCode);
      const councilContact = includeCouncilContact
        ? input.contacts.find(contact => (contact.parishCodes ?? []).includes(assignment.parishCode))
        : undefined;
      return {
        volunteer: volunteerAssignmentDisplayName(assignment, input.members),
        role: volunteerRoleLabel(assignment.roleType),
        target: volunteerAssignmentIsParishScoped(assignment) ? parish?.parishName ?? assignment.parishCode : volunteerAssignmentScopeLabel(assignment),
        localAuthority: parish?.localAuthorityName ?? "",
        rightsOfWayGroup: parish?.rightsOfWayGroupCode ?? "",
        sector: parish?.sectorCode ?? "",
        cover: volunteerCoverageValue(assignment),
        ...(includeEmail ? {email: assignment.supporterId ? memberLookup.get(assignment.supporterId)?.email ?? "" : ""} : {}),
        ...(includeCouncilContact ? {
          councilContact: councilContact ? externalContactDisplayName(councilContact) : "",
          councilContactEmail: councilContact?.email ?? ""
        } : {})
      };
    })
    .sort((first, second) => String(first.volunteer).localeCompare(String(second.volunteer)) || String(first.target).localeCompare(String(second.target)));
}

function volunteerCoverageValue(assignment: VolunteerAssignment): string {
  return assignment.coverage === VolunteerAssignmentCoverage.TEMPORARY ? "Temporary" : "Permanent";
}

function eligibleParishes(parishes: VolunteerParish[]): VolunteerParish[] {
  return parishes.filter(parish => parish.eligibility === VolunteerParishEligibility.ACTIVE);
}

function vacancyRows(input: VolunteerReportInput, activeAssignments: VolunteerAssignment[]): Record<string, string | number>[] {
  return eligibleParishes(input.parishes).flatMap(parish => PARISH_ROLES
    .map(roleType => ({roleType, roleAssignments: volunteerAssignmentsForParish(activeAssignments, parish.parishCode, roleType)}))
    .filter(entry => input.includeTemporaryAsVacant
      ? !entry.roleAssignments.some(assignment => assignment.coverage === VolunteerAssignmentCoverage.PERMANENT)
      : entry.roleAssignments.length === 0)
    .map(entry => ({
      parishName: parish.parishName,
      parishCode: parish.parishCode,
      role: volunteerRoleLabel(entry.roleType),
      status: entry.roleAssignments.length === 0 ? "Vacant" : "Temporary cover only",
      rightsOfWayGroup: parish.rightsOfWayGroupCode ?? "",
      localAuthority: parish.localAuthorityName ?? "",
      sector: parish.sectorCode ?? ""
    })));
}

function coverTypeRows(input: VolunteerReportInput, activeAssignments: VolunteerAssignment[]): Record<string, string | number>[] {
  const parishLookup = new Map(input.parishes.map(parish => [parish.parishCode, parish]));
  return activeAssignments.map(assignment => ({
    volunteer: volunteerAssignmentDisplayName(assignment, input.members),
    role: volunteerRoleLabel(assignment.roleType),
    parishName: volunteerAssignmentScopeLabel(assignment, parishLookup.get(assignment.parishCode)?.parishName),
    rightsOfWayGroup: assignment.rightsOfWayGroupCode || parishLookup.get(assignment.parishCode)?.rightsOfWayGroupCode || "",
    cover: assignment.coverage === VolunteerAssignmentCoverage.TEMPORARY ? "Temporary" : "Permanent",
    effectiveFrom: assignment.effectiveFrom ? input.formatDate(assignment.effectiveFrom) : "",
    effectiveTo: assignment.effectiveTo ? input.formatDate(assignment.effectiveTo) : ""
  }));
}

function parishCoverageRows(input: VolunteerReportInput, activeAssignments: VolunteerAssignment[]): Record<string, string | number>[] {
  return input.parishes.map(parish => ({
    parishName: parish.parishName,
    parishCode: parish.parishCode,
    localAuthority: parish.localAuthorityName ?? "",
    rightsOfWayGroup: parish.rightsOfWayGroupCode ?? "",
    sector: parish.sectorCode ?? "",
    localFootpathOfficer: volunteerAssignmentNames(activeAssignments, parish.parishCode, VolunteerRoleType.LOCAL_FOOTPATH_OFFICER, input.members),
    parishFootpathObserver: volunteerAssignmentNames(activeAssignments, parish.parishCode, VolunteerRoleType.PARISH_FOOTPATH_OBSERVER, input.members),
    coverage: volunteerParishCoverageLabel(activeAssignments, parish.parishCode)
  }));
}

function parishesForRole(row: VolunteerSupporterRow, roleType: VolunteerRoleType): string[] {
  return uniq(row.assignments
    .filter(entry => entry.assignment.roleType === roleType && entry.assignment.status === VolunteerAssignmentStatus.ACTIVE)
    .map(entry => entry.parishName));
}

function groupsForRoles(row: VolunteerSupporterRow, roleTypes: VolunteerRoleType[]): string {
  return uniq(row.assignments
    .filter(entry => roleTypes.includes(entry.assignment.roleType) && entry.assignment.status === VolunteerAssignmentStatus.ACTIVE)
    .map(entry => entry.rightsOfWayGroupCode)
    .filter(code => !!code)).join(", ");
}

function activeRoleHolderRows(supporterRows: VolunteerSupporterRow[]): Record<string, string | number>[] {
  return supporterRows
    .filter(row => row.activeAssignmentCount > 0)
    .flatMap(row => ALL_ROLES
      .map(roleType => ({roleType, parishNames: parishesForRole(row, roleType)}))
      .filter(entry => entry.parishNames.length > 0)
      .map(entry => ({
        volunteer: row.displayName,
        email: row.email,
        role: volunteerRoleLabel(entry.roleType),
        rightsOfWayGroup: groupsForRoles(row, [entry.roleType]),
        parishCount: entry.parishNames.length,
        parishNames: entry.parishNames.join(", ")
      })));
}

function combinedRoleHolderRows(supporterRows: VolunteerSupporterRow[]): Record<string, string | number>[] {
  return supporterRows
    .map(row => ({
      row,
      localFootpathOfficerParishes: parishesForRole(row, VolunteerRoleType.LOCAL_FOOTPATH_OFFICER),
      parishFootpathObserverParishes: parishesForRole(row, VolunteerRoleType.PARISH_FOOTPATH_OBSERVER)
    }))
    .filter(entry => entry.localFootpathOfficerParishes.length > 0 && entry.parishFootpathObserverParishes.length > 0)
    .map(entry => ({
      volunteer: entry.row.displayName,
      email: entry.row.email,
      rightsOfWayGroup: groupsForRoles(entry.row, PARISH_ROLES),
      localFootpathOfficerParishes: entry.localFootpathOfficerParishes.join(", "),
      parishFootpathObserverParishes: entry.parishFootpathObserverParishes.join(", ")
    }));
}

function volunteersWithoutAssignmentRows(supporterRows: VolunteerSupporterRow[]): Record<string, string | number>[] {
  return supporterRows
    .filter(row => row.activeAssignmentCount === 0)
    .map(row => ({
      volunteer: row.displayName,
      email: row.email,
      endedAssignmentCount: row.endedAssignmentCount,
      lastParishes: uniq(row.assignments.map(entry => entry.parishName)).join(", ")
    }));
}

function unresolvedSupporterRows(input: VolunteerReportInput, activeAssignments: VolunteerAssignment[]): Record<string, string | number>[] {
  const parishLookup = new Map(input.parishes.map(parish => [parish.parishCode, parish.parishName]));
  return activeAssignments
    .filter(assignment => !assignment.supporterId)
    .map(assignment => ({
      recordedName: assignment.unresolvedName ?? "",
      role: volunteerRoleLabel(assignment.roleType),
      parishName: volunteerAssignmentScopeLabel(assignment, parishLookup.get(assignment.parishCode)),
      cover: assignment.coverage === VolunteerAssignmentCoverage.TEMPORARY ? "Temporary" : "Permanent",
      notes: assignment.notes ?? ""
    }));
}

function duplicateContactRows(input: VolunteerReportInput): Record<string, string | number>[] {
  return input.contacts
    .map(contact => ({contact, duplicates: externalContactDuplicates(contact, input.contacts)}))
    .filter(entry => entry.duplicates.length > 0)
    .map(entry => ({
      name: externalContactDisplayName(entry.contact),
      recordType: externalContactTypeLabel(entry.contact.contactType),
      missing: "Possible duplicate",
      context: entry.duplicates.map(duplicate => `${duplicate.displayName} (${duplicate.reason.toLowerCase()})`).join("; ")
    }));
}

function invalidParishLinkRows(input: VolunteerReportInput, activeAssignments: VolunteerAssignment[]): Record<string, string | number>[] {
  const parishCodes = new Set(input.parishes.map(parish => parish.parishCode));
  const assignmentRows = activeAssignments
    .filter(assignment => volunteerAssignmentIsParishScoped(assignment) && !parishCodes.has(assignment.parishCode))
    .map(assignment => ({
      name: volunteerAssignmentDisplayName(assignment, input.members),
      recordType: "Assignment",
      missing: "Parish not found",
      context: assignment.parishCode
    }));
  const contactRows = input.contacts
    .flatMap(contact => (contact.parishCodes ?? [])
      .filter(parishCode => !parishCodes.has(parishCode))
      .map(parishCode => ({
        name: externalContactDisplayName(contact),
        recordType: externalContactTypeLabel(contact.contactType),
        missing: "Parish not found",
        context: parishCode
      })));
  return [...assignmentRows, ...contactRows];
}

function missingContactInformationRows(input: VolunteerReportInput, supporterRows: VolunteerSupporterRow[]): Record<string, string | number>[] {
  const volunteersMissingEmail = supporterRows
    .filter(row => row.activeAssignmentCount > 0 && !row.email)
    .map(row => ({
      name: row.displayName,
      recordType: "Volunteer",
      missing: row.supporterId ? "Email address" : "Supporter link and email address",
      context: row.parishes
    }));
  const contactsMissingDetail = input.contacts
    .map(contact => ({
      contact,
      missing: [contact.email ? null : "Email address", contact.telephone ? null : "Telephone"].filter(entry => entry)
    }))
    .filter(entry => entry.missing.length > 0)
    .map(entry => ({
      name: externalContactDisplayName(entry.contact),
      recordType: externalContactTypeLabel(entry.contact.contactType),
      missing: entry.missing.join(", "),
      context: entry.contact.roleTitle ?? ""
    }));
  return [...volunteersMissingEmail, ...contactsMissingDetail];
}

function retentionReviewRows(input: VolunteerReportInput): Record<string, string | number>[] {
  const retentionDays = input.contactRetentionDays ?? 0;
  const now = input.now ?? 0;
  if (retentionDays > 0 && now > 0) {
    return staleExternalContacts(input.contacts, retentionDays, now)
      .map(contact => ({
        name: externalContactDisplayName(contact),
        recordType: externalContactTypeLabel(contact.contactType),
        missing: "Held longer than the retention window with no parish link",
        context: externalContactLastActivity(contact) ? `Last updated ${input.formatDate(externalContactLastActivity(contact))}` : ""
      }));
  } else {
    return [];
  }
}

function parishCodeRows(input: VolunteerReportInput, activeAssignments: VolunteerAssignment[]): Record<string, string | number>[] {
  return input.parishes.map(parish => ({
    parishCode: parish.parishCode,
    parishName: parish.parishName,
    localAuthorityCode: parish.localAuthorityCode ?? "",
    localAuthorityName: parish.localAuthorityName ?? "",
    sectorCode: parish.sectorCode ?? "",
    parishType: parish.parishType ?? "",
    rightsOfWayGroupCode: parish.rightsOfWayGroupCode ?? "",
    localFootpathOfficer: volunteerAssignmentNames(activeAssignments, parish.parishCode, VolunteerRoleType.LOCAL_FOOTPATH_OFFICER, input.members),
    parishFootpathObserver: volunteerAssignmentNames(activeAssignments, parish.parishCode, VolunteerRoleType.PARISH_FOOTPATH_OBSERVER, input.members),
    coverage: volunteerParishCoverageLabel(activeAssignments, parish.parishCode),
    eligible: parish.eligibility === VolunteerParishEligibility.ACTIVE ? "Y" : "N"
  }));
}
