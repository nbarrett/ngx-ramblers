import {
  VolunteerAssignment,
  VolunteerAudience,
  VolunteerAudienceCriteria,
  VolunteerAudienceExclusion,
  VolunteerAudienceRecipient,
  VolunteerAssignmentScope,
  VolunteerAudienceType,
  VolunteerParish,
  VolunteerRoleType,
  VolunteerSupporterIdentity
} from "../models/volunteer-management.model";
import { ExternalContactType, ExternalRecipient } from "../models/external-recipient.model";
import { volunteerActiveAssignments, volunteerAssignmentDisplayName, volunteerAssignmentIsParishScoped } from "./volunteer-management";
import { externalContactDisplayName } from "./external-contacts";
import { memberFullName } from "./member-names";
import { uniq } from "es-toolkit/compat";

export interface VolunteerAudienceInput {
  parishes: VolunteerParish[];
  assignments: VolunteerAssignment[];
  members: VolunteerSupporterIdentity[];
  contacts: ExternalRecipient[];
}

const CONTACT_AUDIENCES = [VolunteerAudienceType.PARISH_AND_TOWN_COUNCILS, VolunteerAudienceType.LOCAL_AUTHORITY_CONTACTS];

export function volunteerAudienceTitle(audienceType: VolunteerAudienceType): string {
  if (audienceType === VolunteerAudienceType.ALL_ROLE_HOLDERS) {
    return "All role holders";
  } else if (audienceType === VolunteerAudienceType.LOCAL_FOOTPATH_OFFICERS) {
    return "Local Footpath Officers";
  } else if (audienceType === VolunteerAudienceType.PARISH_FOOTPATH_OBSERVERS) {
    return "Parish Footpath Observers";
  } else if (audienceType === VolunteerAudienceType.COMBINED_ROLE_HOLDERS) {
    return "Volunteers holding both roles";
  } else if (audienceType === VolunteerAudienceType.PARISH_FOOTPATH_OBSERVERS_EXCLUDING_OFFICERS) {
    return "Parish Footpath Observers who are not also Local Footpath Officers";
  } else if (audienceType === VolunteerAudienceType.GROUP_COORDINATORS) {
    return "Group coordinators";
  } else if (audienceType === VolunteerAudienceType.PARISH_AND_TOWN_COUNCILS) {
    return "Parish and town councils";
  } else {
    return "Local authority contacts";
  }
}

function parishesMatching(parishes: VolunteerParish[], criteria: VolunteerAudienceCriteria): VolunteerParish[] {
  return parishes.filter(parish =>
    (!criteria.localAuthorityCode || parish.localAuthorityCode === criteria.localAuthorityCode)
    && (!criteria.sectorCode || parish.sectorCode === criteria.sectorCode)
    && (!criteria.rightsOfWayGroupCode || parish.rightsOfWayGroupCode === criteria.rightsOfWayGroupCode));
}

function supporterIdsForRole(assignments: VolunteerAssignment[], roleType: VolunteerRoleType): string[] {
  return uniq(assignments.filter(assignment => assignment.roleType === roleType && assignment.supporterId).map(assignment => assignment.supporterId));
}

function selectedAssignments(input: VolunteerAudienceInput, criteria: VolunteerAudienceCriteria): VolunteerAssignment[] {
  const matchingParishes = parishesMatching(input.parishes, criteria);
  const parishCodes = new Set(matchingParishes.map(parish => parish.parishCode));
  const groupCodes = new Set(matchingParishes.map(parish => parish.rightsOfWayGroupCode).filter(code => code));
  const sectorCodes = new Set(matchingParishes.map(parish => parish.sectorCode).filter(code => code));
  return volunteerActiveAssignments(input.assignments).filter(assignment => volunteerAssignmentIsParishScoped(assignment)
    ? parishCodes.has(assignment.parishCode)
    : assignmentCoversSelection(assignment, groupCodes, sectorCodes));
}

function assignmentCoversSelection(assignment: VolunteerAssignment, groupCodes: Set<string>, sectorCodes: Set<string>): boolean {
  if (assignment.scope === VolunteerAssignmentScope.RIGHTS_OF_WAY_GROUP) {
    return !assignment.rightsOfWayGroupCode || groupCodes.has(assignment.rightsOfWayGroupCode);
  } else if (assignment.scope === VolunteerAssignmentScope.SECTOR) {
    return !assignment.sectorCode || sectorCodes.has(assignment.sectorCode);
  } else {
    return false;
  }
}

function supporterIdsFor(audienceType: VolunteerAudienceType, assignments: VolunteerAssignment[]): string[] {
  const localFootpathOfficers = supporterIdsForRole(assignments, VolunteerRoleType.LOCAL_FOOTPATH_OFFICER);
  const parishFootpathObservers = supporterIdsForRole(assignments, VolunteerRoleType.PARISH_FOOTPATH_OBSERVER);
  if (audienceType === VolunteerAudienceType.LOCAL_FOOTPATH_OFFICERS) {
    return localFootpathOfficers;
  } else if (audienceType === VolunteerAudienceType.PARISH_FOOTPATH_OBSERVERS) {
    return parishFootpathObservers;
  } else if (audienceType === VolunteerAudienceType.COMBINED_ROLE_HOLDERS) {
    return parishFootpathObservers.filter(supporterId => localFootpathOfficers.includes(supporterId));
  } else if (audienceType === VolunteerAudienceType.PARISH_FOOTPATH_OBSERVERS_EXCLUDING_OFFICERS) {
    return parishFootpathObservers.filter(supporterId => !localFootpathOfficers.includes(supporterId));
  } else if (audienceType === VolunteerAudienceType.GROUP_COORDINATORS) {
    return supporterIdsForRole(assignments, VolunteerRoleType.GROUP_COORDINATOR);
  } else if (audienceType === VolunteerAudienceType.ALL_ROLE_HOLDERS) {
    return uniq([...localFootpathOfficers, ...parishFootpathObservers, ...supporterIdsForRole(assignments, VolunteerRoleType.GROUP_COORDINATOR)]);
  } else {
    return [];
  }
}

function contactsFor(audienceType: VolunteerAudienceType, input: VolunteerAudienceInput, criteria: VolunteerAudienceCriteria): ExternalRecipient[] {
  const parishCodes = new Set(parishesMatching(input.parishes, criteria).map(parish => parish.parishCode));
  const filtersApplied = !!criteria.localAuthorityCode || !!criteria.sectorCode || !!criteria.rightsOfWayGroupCode;
  const wantedTypes = audienceType === VolunteerAudienceType.PARISH_AND_TOWN_COUNCILS
    ? [ExternalContactType.PARISH_COUNCIL, ExternalContactType.TOWN_COUNCIL]
    : [ExternalContactType.LOCAL_AUTHORITY];
  return CONTACT_AUDIENCES.includes(audienceType)
    ? input.contacts.filter(contact => wantedTypes.includes(contact.contactType)
      && (!filtersApplied || (contact.parishCodes ?? []).some(parishCode => parishCodes.has(parishCode))))
    : [];
}

export function volunteerAudience(criteria: VolunteerAudienceCriteria, input: VolunteerAudienceInput): VolunteerAudience {
  const assignments = selectedAssignments(input, criteria);
  const candidateSupporterIds = supporterIdsFor(criteria.audienceType, assignments);
  const excluded: {name: string; reason: string}[] = [];
  const includedSupporters = candidateSupporterIds
    .map(supporterId => input.members.find(member => member.id === supporterId))
    .filter(member => member);
  candidateSupporterIds
    .filter(supporterId => !input.members.some(member => member.id === supporterId))
    .forEach(supporterId => excluded.push({name: supporterId, reason: "No supporter record found"}));
  includedSupporters
    .filter(member => !member.email)
    .forEach(member => excluded.push({name: memberFullName(member), reason: "No email address"}));
  assignments
    .filter(assignment => !assignment.supporterId && audienceCoversAssignment(criteria.audienceType, assignment))
    .forEach(assignment => excluded.push({name: volunteerAssignmentDisplayName(assignment, input.members), reason: "Not linked to a supporter record"}));

  const supporterIds = includedSupporters.filter(member => member.email).map(member => member.id);
  const supporterEmails = new Set(includedSupporters.filter(member => member.email).map(member => member.email.trim().toLowerCase()));
  const externalRecipients = contactsFor(criteria.audienceType, input, criteria)
    .reduce((recipients: VolunteerAudienceRecipient[], contact) => {
      const email = (contact.email ?? "").trim().toLowerCase();
      const alreadyIncluded = supporterEmails.has(email) || recipients.some(recipient => recipient.email.toLowerCase() === email);
      if (!email) {
        excluded.push({name: externalContactDisplayName(contact), reason: "No email address"});
        return recipients;
      } else if (alreadyIncluded) {
        excluded.push({name: externalContactDisplayName(contact), reason: "Already included under another entry"});
        return recipients;
      } else {
        return [...recipients, {email: contact.email, name: externalContactDisplayName(contact)}];
      }
    }, []);

  return {
    audienceType: criteria.audienceType,
    title: volunteerAudienceTitle(criteria.audienceType),
    supporterIds,
    externalRecipients,
    excluded: groupedExclusions(excluded)
  };
}

const EXCLUSION_SAMPLE_LIMIT = 5;

function groupedExclusions(raw: {name: string; reason: string}[]): VolunteerAudienceExclusion[] {
  return uniq(raw.map(entry => entry.reason)).map(reason => {
    const names = raw.filter(entry => entry.reason === reason).map(entry => entry.name).filter(name => name);
    return {reason, count: names.length, names: uniq(names).slice(0, EXCLUSION_SAMPLE_LIMIT)};
  });
}

function audienceCoversAssignment(audienceType: VolunteerAudienceType, assignment: VolunteerAssignment): boolean {
  if (audienceType === VolunteerAudienceType.ALL_ROLE_HOLDERS) {
    return true;
  } else if (audienceType === VolunteerAudienceType.LOCAL_FOOTPATH_OFFICERS) {
    return assignment.roleType === VolunteerRoleType.LOCAL_FOOTPATH_OFFICER;
  } else if (audienceType === VolunteerAudienceType.PARISH_FOOTPATH_OBSERVERS || audienceType === VolunteerAudienceType.PARISH_FOOTPATH_OBSERVERS_EXCLUDING_OFFICERS) {
    return assignment.roleType === VolunteerRoleType.PARISH_FOOTPATH_OBSERVER;
  } else if (audienceType === VolunteerAudienceType.GROUP_COORDINATORS) {
    return assignment.roleType === VolunteerRoleType.GROUP_COORDINATOR;
  } else {
    return false;
  }
}
