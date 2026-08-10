import {
  LegacyAssignmentRecord,
  LegacyCouncilContactRecord,
  LegacyParishRecord,
  LegacyVolunteerRecord,
  VolunteerImportAction,
  VolunteerImportDecision,
  VolunteerImportMatchConfidence,
  VolunteerImportPayload,
  VolunteerImportPlan,
  VolunteerImportRecordKind,
  VolunteerImportSummary
} from "../models/volunteer-import.model";
import {
  VolunteerAssignmentCoverage,
  VolunteerAssignmentIdentityStatus,
  VolunteerAssignmentRequest,
  VolunteerParish,
  VolunteerAssignmentScope,
  VolunteerParishEligibility,
  VolunteerRoleType,
  VolunteerSupporterIdentity
} from "../models/volunteer-management.model";
import { CreateExternalRecipientRequest, ExternalContactType, ExternalRecipient } from "../models/external-recipient.model";
import { memberFullName } from "./member-names";

export interface VolunteerImportExisting {
  parishes: VolunteerParish[];
  supporters: VolunteerSupporterIdentity[];
  contacts: ExternalRecipient[];
}

interface VolunteerMatch {
  supporterId: string | null;
  confidence: VolunteerImportMatchConfidence;
  reason: string;
  matchedTo: string;
}

export const LEGACY_SOURCE_REFERENCE_PREFIX = "legacy-volunteer-import";

function normalised(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function normalisedParishName(value?: string | null): string {
  return normalised(value).replace(/\b(civil parish|parish|cp)\b/g, "").replace(/[^a-z0-9]+/g, "");
}

export function legacyRoleType(role: string): VolunteerRoleType | null {
  const value = normalised(role).replace(/[^a-z]/g, "");
  if (value === "lfo" || value === "localfootpathofficer") {
    return VolunteerRoleType.LOCAL_FOOTPATH_OFFICER;
  } else if (value === "pfo" || value === "parishfootpathobserver") {
    return VolunteerRoleType.PARISH_FOOTPATH_OBSERVER;
  } else if (value === "coordinator" || value === "groupcoordinator") {
    return VolunteerRoleType.GROUP_COORDINATOR;
  } else {
    return null;
  }
}

export function matchLegacyVolunteer(volunteer: LegacyVolunteerRecord, supporters: VolunteerSupporterIdentity[]): VolunteerMatch {
  const email = normalised(volunteer.email);
  const fullName = `${volunteer.firstName ?? ""} ${volunteer.lastName ?? ""}`.trim();
  const emailMatches = email ? supporters.filter(supporter => normalised(supporter.email) === email) : [];
  const nameMatches = supporters.filter(supporter =>
    normalised(supporter.firstName) === normalised(volunteer.firstName)
    && normalised(supporter.lastName) === normalised(volunteer.lastName)
    && normalised(volunteer.lastName) !== "");
  if (emailMatches.length === 1) {
    return {supporterId: emailMatches[0].id, confidence: VolunteerImportMatchConfidence.MATCHED, reason: "Matched on email address", matchedTo: memberFullName(emailMatches[0])};
  } else if (emailMatches.length > 1) {
    return {supporterId: null, confidence: VolunteerImportMatchConfidence.NEEDS_REVIEW, reason: `${emailMatches.length} supporters share this email address`, matchedTo: ""};
  } else if (nameMatches.length === 1) {
    return {supporterId: nameMatches[0].id, confidence: VolunteerImportMatchConfidence.MATCHED, reason: "Matched on first and last name", matchedTo: memberFullName(nameMatches[0])};
  } else if (nameMatches.length > 1) {
    return {supporterId: null, confidence: VolunteerImportMatchConfidence.NEEDS_REVIEW, reason: `${nameMatches.length} supporters share this name`, matchedTo: ""};
  } else {
    return {supporterId: null, confidence: VolunteerImportMatchConfidence.UNMATCHED, reason: fullName ? "No supporter found with this name or email address" : "No name recorded", matchedTo: ""};
  }
}

export function matchLegacyParish(parish: LegacyParishRecord, existingParishes: VolunteerParish[]): VolunteerParish | null {
  const code = normalised(parish.parishCode);
  const byCode = code ? existingParishes.find(existing => normalised(existing.parishCode) === code) : null;
  const byName = existingParishes.find(existing => normalisedParishName(existing.parishName) === normalisedParishName(parish.parishName));
  return byCode ?? byName ?? null;
}

export function volunteerImportPlan(payload: VolunteerImportPayload, existing: VolunteerImportExisting, _now: number): VolunteerImportPlan {
  const decisions: VolunteerImportDecision[] = [];
  const parishByReference = new Map<string, VolunteerParish>();
  const parishes = payload.parishes.map(legacyParish => {
    const matched = matchLegacyParish(legacyParish, existing.parishes);
    const parishCode = matched?.parishCode ?? legacyParish.parishCode?.trim() ?? "";
    const parish: VolunteerParish = {
      groupCode: payload.groupCode,
      parishCode,
      parishName: legacyParish.parishName?.trim() ?? matched?.parishName ?? "",
      localAuthorityCode: legacyParish.localAuthorityCode ?? matched?.localAuthorityCode,
      localAuthorityName: legacyParish.localAuthorityName ?? matched?.localAuthorityName,
      sectorCode: legacyParish.sectorCode ?? matched?.sectorCode,
      rightsOfWayGroupCode: legacyParish.rightsOfWayGroupCode ?? matched?.rightsOfWayGroupCode,
      membershipGroupCode: legacyParish.membershipGroupCode ?? matched?.membershipGroupCode,
      parishType: legacyParish.parishType ?? matched?.parishType,
      eligibility: legacyParish.noPublicRightsOfWay ? VolunteerParishEligibility.NO_PUBLIC_RIGHTS_OF_WAY : VolunteerParishEligibility.ACTIVE,
      notes: legacyParish.notes
    };
    decisions.push({
      kind: VolunteerImportRecordKind.PARISH,
      reference: legacyParish.reference,
      description: legacyParish.parishName,
      action: parishCode ? (matched ? VolunteerImportAction.UPDATE : VolunteerImportAction.CREATE) : VolunteerImportAction.SKIP,
      confidence: matched ? VolunteerImportMatchConfidence.MATCHED : (parishCode ? VolunteerImportMatchConfidence.UNMATCHED : VolunteerImportMatchConfidence.NEEDS_REVIEW),
      matchedTo: matched?.parishCode,
      reason: matched ? "Matched to an existing parish" : (parishCode ? "No existing parish matched; will be created with the supplied code" : "No official parish code supplied and no parish name matched")
    });
    if (parishCode) {
      parishByReference.set(legacyParish.reference, parish);
    }
    return parish;
  }).filter(parish => parish.parishCode);

  const matchByVolunteerReference = new Map<string, VolunteerMatch>();
  payload.volunteers.forEach(volunteer => {
    const match = matchLegacyVolunteer(volunteer, existing.supporters);
    matchByVolunteerReference.set(volunteer.reference, match);
    decisions.push({
      kind: VolunteerImportRecordKind.VOLUNTEER,
      reference: volunteer.reference,
      description: `${volunteer.firstName ?? ""} ${volunteer.lastName ?? ""}`.trim() || volunteer.email || volunteer.reference,
      action: match.supporterId ? VolunteerImportAction.UPDATE : VolunteerImportAction.IMPORT_UNRESOLVED,
      confidence: match.confidence,
      matchedTo: match.matchedTo,
      reason: match.reason
    });
  });

  const volunteerByReference = new Map(payload.volunteers.map(volunteer => [volunteer.reference, volunteer]));
  const assignments = payload.assignments.map(legacyAssignment => {
    const parish = parishByReference.get(legacyAssignment.parishReference);
    const roleType = legacyRoleType(legacyAssignment.role);
    const match = matchByVolunteerReference.get(legacyAssignment.volunteerReference);
    const volunteer = volunteerByReference.get(legacyAssignment.volunteerReference);
    const unresolvedName = volunteer ? `${volunteer.firstName ?? ""} ${volunteer.lastName ?? ""}`.trim() : "";
    const decision = assignmentDecision(legacyAssignment, parish, roleType, match, unresolvedName);
    decisions.push(decision);
    return decision.action === VolunteerImportAction.SKIP ? null : {
      groupCode: payload.groupCode,
      ...scopeFieldsFor(legacyAssignment, parish),
      supporterId: match?.supporterId ?? null,
      unresolvedName: match?.supporterId ? null : (unresolvedName || null),
      sourceReference: `${LEGACY_SOURCE_REFERENCE_PREFIX}:${legacyAssignment.reference}`,
      identityStatus: match?.supporterId ? VolunteerAssignmentIdentityStatus.LINKED : VolunteerAssignmentIdentityStatus.UNRESOLVED,
      roleType,
      coverage: legacyAssignment.temporary ? VolunteerAssignmentCoverage.TEMPORARY : VolunteerAssignmentCoverage.PERMANENT,
      effectiveFrom: legacyAssignment.effectiveFrom ?? null,
      notes: [legacyAssignment.notes, volunteer?.notes].filter(note => note).join(" ") || undefined
    } as VolunteerAssignmentRequest;
  }).filter(assignment => assignment);

  const contactRowsByEmail = payload.councilContacts.reduce((groups: Map<string, LegacyCouncilContactRecord[]>, legacyContact) => {
    const email = normalised(legacyContact.email);
    return email ? groups.set(email, [...(groups.get(email) ?? []), legacyContact]) : groups;
  }, new Map<string, LegacyCouncilContactRecord[]>());
  const contacts = payload.councilContacts.map(legacyContact => {
    const email = normalised(legacyContact.email);
    const groupedRows = email ? contactRowsByEmail.get(email) ?? [legacyContact] : [legacyContact];
    const duplicate = email ? existing.contacts.find(contact => normalised(contact.email) === email) : null;
    const decision = contactDecision(legacyContact, email, duplicate, groupedRows);
    decisions.push(decision);
    if (decision.action === VolunteerImportAction.SKIP) {
      return null;
    } else {
      const firstValueOf = (pick: (row: LegacyCouncilContactRecord) => string | undefined) =>
        groupedRows.map(pick).find(candidate => candidate?.trim());
      const parishCodes = groupedRows
        .map(row => parishByReference.get(row.parishReference)?.parishCode)
        .filter(code => code);
      return {
        email: legacyContact.email.trim(),
        organisationName: firstValueOf(row => row.organisationName),
        contactName: firstValueOf(row => row.contactName),
        roleTitle: firstValueOf(row => row.roleTitle),
        telephone: firstValueOf(row => row.telephone),
        postalAddress: firstValueOf(row => row.postalAddress),
        contactType: ExternalContactType.PARISH_COUNCIL,
        parishCodes: Array.from(new Set(parishCodes)),
        notes: Array.from(new Set(groupedRows.map(row => row.notes).filter(note => note))).join(" ") || undefined
      } as CreateExternalRecipientRequest;
    }
  }).filter(contact => contact);

  const reviewQueue = decisions.filter(decision =>
    decision.action === VolunteerImportAction.SKIP ||
    decision.action === VolunteerImportAction.IMPORT_UNRESOLVED ||
    decision.confidence === VolunteerImportMatchConfidence.NEEDS_REVIEW);
  return {groupCode: payload.groupCode, decisions, reviewQueue, parishes, assignments, contacts, summary: summaryFrom(decisions)};
}

function scopeFieldsFor(legacyAssignment: LegacyAssignmentRecord, parish: VolunteerParish | undefined): Partial<VolunteerAssignmentRequest> {
  if (legacyAssignment.scope === VolunteerAssignmentScope.RIGHTS_OF_WAY_GROUP) {
    return {scope: VolunteerAssignmentScope.RIGHTS_OF_WAY_GROUP, rightsOfWayGroupCode: legacyAssignment.scopeReference};
  } else if (legacyAssignment.scope === VolunteerAssignmentScope.SECTOR) {
    return {scope: VolunteerAssignmentScope.SECTOR, sectorCode: legacyAssignment.scopeReference};
  } else {
    return {scope: VolunteerAssignmentScope.PARISH, parishCode: parish?.parishCode};
  }
}

function assignmentTargetResolved(legacyAssignment: LegacyAssignmentRecord, parish: VolunteerParish | undefined): boolean {
  return legacyAssignment.scope && legacyAssignment.scope !== VolunteerAssignmentScope.PARISH
    ? !!legacyAssignment.scopeReference
    : !!parish;
}

function assignmentDecision(legacyAssignment: LegacyAssignmentRecord, parish: VolunteerParish | undefined, roleType: VolunteerRoleType | null, match: VolunteerMatch | undefined, unresolvedName: string): VolunteerImportDecision {
  const target = legacyAssignment.scope && legacyAssignment.scope !== VolunteerAssignmentScope.PARISH
    ? legacyAssignment.scopeReference
    : parish?.parishName ?? legacyAssignment.parishReference;
  const description = `${legacyAssignment.role} for ${target}`;
  const base = {kind: VolunteerImportRecordKind.ASSIGNMENT, reference: legacyAssignment.reference, description};
  if (!assignmentTargetResolved(legacyAssignment, parish)) {
    return {...base, action: VolunteerImportAction.SKIP, confidence: VolunteerImportMatchConfidence.UNMATCHED, reason: "No parish, group or sector could be resolved for this assignment"};
  } else if (!roleType) {
    return {...base, action: VolunteerImportAction.SKIP, confidence: VolunteerImportMatchConfidence.UNMATCHED, reason: `Role "${legacyAssignment.role}" was not recognised`};
  } else if (match?.supporterId) {
    return {...base, action: VolunteerImportAction.CREATE, confidence: VolunteerImportMatchConfidence.MATCHED, matchedTo: match.matchedTo, reason: match.reason};
  } else {
    return {...base, action: VolunteerImportAction.IMPORT_UNRESOLVED, confidence: VolunteerImportMatchConfidence.NEEDS_REVIEW, reason: unresolvedName ? `Will be recorded against the name "${unresolvedName}" until a supporter is linked` : "No volunteer name recorded for this assignment"};
  }
}

function contactDecision(legacyContact: LegacyCouncilContactRecord, email: string, duplicate: ExternalRecipient | undefined, groupedRows: LegacyCouncilContactRecord[]): VolunteerImportDecision {
  const description = legacyContact.organisationName || legacyContact.contactName || legacyContact.reference;
  const base = {kind: VolunteerImportRecordKind.COUNCIL_CONTACT, reference: legacyContact.reference, description};
  const primaryRow = groupedRows[0];
  if (!email) {
    return {...base, action: VolunteerImportAction.SKIP, confidence: VolunteerImportMatchConfidence.NEEDS_REVIEW, reason: "No email address recorded"};
  } else if (primaryRow !== legacyContact) {
    return {...base, action: VolunteerImportAction.SKIP, confidence: VolunteerImportMatchConfidence.MATCHED, matchedTo: primaryRow.organisationName || primaryRow.contactName || primaryRow.reference, reason: "Shares an email address with another row; parishes combined into one contact"};
  } else if (duplicate) {
    return {...base, action: VolunteerImportAction.UPDATE, confidence: VolunteerImportMatchConfidence.MATCHED, matchedTo: duplicate.email, reason: "An existing contact already uses this email address"};
  } else {
    return {...base, action: VolunteerImportAction.CREATE, confidence: VolunteerImportMatchConfidence.MATCHED, reason: "New contact"};
  }
}

function countOf(decisions: VolunteerImportDecision[], kind: VolunteerImportRecordKind, predicate: (decision: VolunteerImportDecision) => boolean): number {
  return decisions.filter(decision => decision.kind === kind && predicate(decision)).length;
}

function summaryFrom(decisions: VolunteerImportDecision[]): VolunteerImportSummary {
  return {
    parishesToCreate: countOf(decisions, VolunteerImportRecordKind.PARISH, decision => decision.action === VolunteerImportAction.CREATE),
    parishesToUpdate: countOf(decisions, VolunteerImportRecordKind.PARISH, decision => decision.action === VolunteerImportAction.UPDATE),
    parishesNeedingReview: countOf(decisions, VolunteerImportRecordKind.PARISH, decision => decision.confidence !== VolunteerImportMatchConfidence.MATCHED),
    volunteersMatched: countOf(decisions, VolunteerImportRecordKind.VOLUNTEER, decision => decision.confidence === VolunteerImportMatchConfidence.MATCHED),
    volunteersNeedingReview: countOf(decisions, VolunteerImportRecordKind.VOLUNTEER, decision => decision.confidence !== VolunteerImportMatchConfidence.MATCHED),
    assignmentsToImport: countOf(decisions, VolunteerImportRecordKind.ASSIGNMENT, decision => decision.action === VolunteerImportAction.CREATE),
    assignmentsToImportUnresolved: countOf(decisions, VolunteerImportRecordKind.ASSIGNMENT, decision => decision.action === VolunteerImportAction.IMPORT_UNRESOLVED),
    assignmentsSkipped: countOf(decisions, VolunteerImportRecordKind.ASSIGNMENT, decision => decision.action === VolunteerImportAction.SKIP),
    contactsToImport: countOf(decisions, VolunteerImportRecordKind.COUNCIL_CONTACT, decision => decision.action !== VolunteerImportAction.SKIP),
    contactsNeedingReview: countOf(decisions, VolunteerImportRecordKind.COUNCIL_CONTACT, decision => decision.confidence !== VolunteerImportMatchConfidence.MATCHED)
  };
}
