import {
  VolunteerAssignment,
  VolunteerMyCouncilContact,
  VolunteerMyInformation,
  VolunteerMyInformationInput,
  VolunteerMyParish,
  VolunteerMyPersonRef,
  VolunteerMyRole,
  VolunteerSupporterIdentity
} from "../models/volunteer-management.model";
import { ExternalRecipient } from "../models/external-recipient.model";
import { volunteerCoverLabel, volunteerRoleLabel } from "./volunteer-management";
import { memberFullName } from "./member-names";

function counterpartName(assignment: VolunteerAssignment, member: VolunteerSupporterIdentity | null): string {
  if (member) {
    return memberFullName(member);
  } else if (assignment.unresolvedName) {
    return assignment.unresolvedName;
  } else {
    return "Needs reconciliation";
  }
}

function counterpartsForParish(parishCode: string, memberId: string, assignments: VolunteerAssignment[], memberLookup: Map<string, VolunteerSupporterIdentity>): VolunteerMyPersonRef[] {
  return assignments
    .filter(assignment => assignment.parishCode === parishCode && assignment.supporterId !== memberId)
    .map(assignment => {
      const member = assignment.supporterId ? memberLookup.get(assignment.supporterId) ?? null : null;
      return {
        name: counterpartName(assignment, member),
        email: member?.email,
        roleLabel: volunteerRoleLabel(assignment.roleType),
        coverLabel: volunteerCoverLabel(assignment.coverage)
      };
    })
    .sort((first, second) => first.name.localeCompare(second.name) || first.roleLabel.localeCompare(second.roleLabel));
}

function councilContactsForParish(parishCode: string, contacts: ExternalRecipient[]): VolunteerMyCouncilContact[] {
  return contacts
    .filter(contact => (contact.parishCodes ?? []).includes(parishCode))
    .map(contact => ({
      organisationName: contact.organisationName,
      contactName: contact.contactName,
      roleTitle: contact.roleTitle,
      email: contact.email,
      telephone: contact.telephone,
      postalAddress: contact.postalAddress
    }));
}

export function volunteerMyInformation(input: VolunteerMyInformationInput): VolunteerMyInformation {
  const parishLookup = new Map(input.parishes.map(parish => [parish.parishCode, parish]));
  const memberLookup = new Map(input.members.map(member => [member.id, member]));
  const myAssignments = input.assignments.filter(assignment => !!assignment.parishCode && assignment.supporterId === input.memberId);
  const groupedByParish = myAssignments.reduce((groups: Map<string, VolunteerAssignment[]>, assignment) => {
    const existing = groups.get(assignment.parishCode) ?? [];
    return groups.set(assignment.parishCode, [...existing, assignment]);
  }, new Map<string, VolunteerAssignment[]>());
  const parishes: VolunteerMyParish[] = Array.from(groupedByParish.entries())
    .map(([parishCode, parishAssignments]) => {
      const parish = parishLookup.get(parishCode) ?? null;
      const myRoles: VolunteerMyRole[] = parishAssignments.map(assignment => ({
        roleLabel: volunteerRoleLabel(assignment.roleType),
        coverLabel: volunteerCoverLabel(assignment.coverage),
        effectiveFrom: assignment.effectiveFrom,
        effectiveTo: assignment.effectiveTo
      }));
      return {
        parishCode,
        parishName: parish?.parishName ?? parishCode,
        localAuthorityName: parish?.localAuthorityName,
        sectorCode: parish?.sectorCode,
        rightsOfWayGroupCode: parish?.rightsOfWayGroupCode,
        myRoles,
        counterparts: counterpartsForParish(parishCode, input.memberId, input.assignments, memberLookup),
        councilContacts: councilContactsForParish(parishCode, input.contacts)
      };
    })
    .sort((first, second) => first.parishName.localeCompare(second.parishName));
  return {
    memberName: input.memberName,
    parishCount: parishes.length,
    parishes
  };
}
