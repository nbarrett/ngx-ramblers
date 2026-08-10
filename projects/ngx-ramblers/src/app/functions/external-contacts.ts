import {
  ExternalContactDuplicate,
  ExternalContactFilterCriteria,
  ExternalContactRow,
  ExternalContactType,
  ExternalRecipient
} from "../models/external-recipient.model";
import { VolunteerParish, VolunteerSupporterIdentity } from "../models/volunteer-management.model";
import { memberFullName } from "./member-names";
import { isString } from "es-toolkit/compat";

export function externalContactTypeLabel(contactType?: ExternalContactType): string {
  if (contactType === ExternalContactType.PARISH_COUNCIL) {
    return "Parish council";
  } else if (contactType === ExternalContactType.TOWN_COUNCIL) {
    return "Town council";
  } else if (contactType === ExternalContactType.LOCAL_AUTHORITY) {
    return "Local authority";
  } else if (contactType === ExternalContactType.OTHER_ORGANISATION) {
    return "Other organisation";
  } else if (contactType === ExternalContactType.INDIVIDUAL) {
    return "Individual";
  } else {
    return "Unclassified";
  }
}

export function externalContactDisplayName(contact: ExternalRecipient): string {
  const organisationName = normalisedContactValue(contact.organisationName);
  const contactName = normalisedContactValue(contact.contactName);
  if (organisationName && contactName) {
    return `${contact.organisationName} (${contact.contactName})`;
  } else if (organisationName) {
    return contact.organisationName;
  } else if (contactName) {
    return contact.contactName;
  } else {
    return contact.name || contact.email;
  }
}

function normalisedContactValue(value?: string | null): string {
  return isString(value) ? value.trim().toLowerCase() : "";
}

export function externalContactRows(contacts: ExternalRecipient[], parishes: VolunteerParish[], members: VolunteerSupporterIdentity[]): ExternalContactRow[] {
  const parishLookup = new Map(parishes.map(parish => [parish.parishCode, parish.parishName]));
  return contacts.map(contact => {
    const parishCodes = contact.parishCodes ?? [];
    const supporter = contact.supporterId ? members.find(member => member.id === contact.supporterId) : null;
    return {
      ...contact,
      displayName: externalContactDisplayName(contact),
      contactTypeLabel: externalContactTypeLabel(contact.contactType),
      linkedParishCount: parishCodes.length,
      linkedParishNames: parishCodes.map(parishCode => parishLookup.get(parishCode) ?? parishCode).join(", "),
      supporterName: supporter ? memberFullName(supporter) : ""
    };
  });
}

export function filterExternalContacts(rows: ExternalContactRow[], criteria: ExternalContactFilterCriteria): ExternalContactRow[] {
  const searchText = criteria.searchText.trim().toLowerCase();
  return rows.filter(row => {
    const textMatches = !searchText || [row.displayName, row.email, row.roleTitle, row.telephone, row.postalAddress, row.linkedParishNames, row.supporterName, row.notes]
      .some(value => value?.toLowerCase().includes(searchText));
    const typeMatches = !criteria.contactType || row.contactType === criteria.contactType;
    const parishMatches = !criteria.parishCode || (row.parishCodes ?? []).includes(criteria.parishCode);
    return textMatches && typeMatches && parishMatches;
  });
}

export function externalContactDuplicates(candidate: ExternalRecipient, contacts: ExternalRecipient[]): ExternalContactDuplicate[] {
  const candidateEmail = normalisedContactValue(candidate.email);
  const candidateOrganisation = normalisedContactValue(candidate.organisationName);
  const candidateContactName = normalisedContactValue(candidate.contactName);
  return contacts
    .filter(contact => contact.id && contact.id !== candidate.id)
    .map(contact => ({contact, reason: duplicateReasonFor(contact, candidateEmail, candidateOrganisation, candidateContactName)}))
    .filter(entry => entry.reason)
    .map(entry => ({
      id: entry.contact.id,
      displayName: externalContactDisplayName(entry.contact),
      email: entry.contact.email,
      reason: entry.reason
    }));
}

function duplicateReasonFor(contact: ExternalRecipient, candidateEmail: string, candidateOrganisation: string, candidateContactName: string): string {
  const contactEmail = normalisedContactValue(contact.email);
  const contactOrganisation = normalisedContactValue(contact.organisationName);
  const contactName = normalisedContactValue(contact.contactName);
  if (candidateEmail && contactEmail === candidateEmail) {
    return "Same email address";
  } else if (candidateOrganisation && candidateContactName && contactOrganisation === candidateOrganisation && contactName === candidateContactName) {
    return "Same organisation and contact name";
  } else if (candidateOrganisation && !candidateContactName && contactOrganisation === candidateOrganisation) {
    return "Same organisation";
  } else if (candidateContactName && !candidateOrganisation && contactName === candidateContactName && !contactOrganisation) {
    return "Same contact name";
  } else {
    return "";
  }
}
