import expect from "expect";
import { describe, it } from "mocha";
import { legacyRoleType, matchLegacyVolunteer, volunteerImportPlan } from "../../../projects/ngx-ramblers/src/app/functions/volunteer-import";
import {
  VolunteerImportAction,
  VolunteerImportMatchConfidence,
  VolunteerImportPayload,
  VolunteerImportRecordKind
} from "../../../projects/ngx-ramblers/src/app/models/volunteer-import.model";
import {
  VolunteerAssignmentCoverage,
  VolunteerAssignmentIdentityStatus,
  VolunteerParish,
  VolunteerParishEligibility,
  VolunteerRoleType,
  VolunteerSupporterIdentity
} from "../../../projects/ngx-ramblers/src/app/models/volunteer-management.model";
import { ExternalRecipient } from "../../../projects/ngx-ramblers/src/app/models/external-recipient.model";

describe("legacy volunteer import", () => {
  const existingParishes = [
    {groupCode: "EK", parishCode: "E04000001", parishName: "Alpha", eligibility: VolunteerParishEligibility.ACTIVE}
  ] as VolunteerParish[];
  const supporters: VolunteerSupporterIdentity[] = [
    {id: "supporter-1", firstName: "Ada", lastName: "Lovelace", email: "ada@example.org"},
    {id: "supporter-2", firstName: "Alan", lastName: "Turing", email: "alan@example.org"},
    {id: "supporter-3", firstName: "Alan", lastName: "Turing", email: "alan.turing@example.org"}
  ];
  const contacts: ExternalRecipient[] = [
    {id: "contact-1", email: "clerk@alpha-pc.gov.uk", organisationName: "Alpha Parish Council", createdBy: "test", createdAt: 1}
  ];
  const existing = {parishes: existingParishes, supporters, contacts};

  const payload: VolunteerImportPayload = {
    groupCode: "EK",
    parishes: [
      {reference: "P1", parishName: "Alpha Civil Parish"},
      {reference: "P2", parishName: "Beta", parishCode: "E04000002", noPublicRightsOfWay: true},
      {reference: "P3", parishName: "Unknown place"}
    ],
    volunteers: [
      {reference: "V1", firstName: "Ada", lastName: "Lovelace", email: "ada@example.org"},
      {reference: "V2", firstName: "Alan", lastName: "Turing"},
      {reference: "V3", firstName: "Jo", lastName: "Bloggs"}
    ],
    assignments: [
      {reference: "A1", parishReference: "P1", volunteerReference: "V1", role: "LFO"},
      {reference: "A2", parishReference: "P2", volunteerReference: "V3", role: "PFO", temporary: true},
      {reference: "A3", parishReference: "P3", volunteerReference: "V1", role: "LFO"},
      {reference: "A4", parishReference: "P1", volunteerReference: "V2", role: "Warden"}
    ],
    councilContacts: [
      {reference: "C1", parishReference: "P1", organisationName: "Alpha Parish Council", email: "clerk@alpha-pc.gov.uk", telephone: "01227 000000"},
      {reference: "C2", parishReference: "P2", organisationName: "Beta Parish Council", email: "clerk@beta-pc.gov.uk"},
      {reference: "C3", parishReference: "P2", organisationName: "Gamma Parish Council"}
    ]
  };

  it("recognises the legacy role abbreviations and rejects unknown ones", () => {
    expect(legacyRoleType("LFO")).toEqual(VolunteerRoleType.LOCAL_FOOTPATH_OFFICER);
    expect(legacyRoleType("Parish Footpath Observer")).toEqual(VolunteerRoleType.PARISH_FOOTPATH_OBSERVER);
    expect(legacyRoleType("group coordinator")).toEqual(VolunteerRoleType.GROUP_COORDINATOR);
    expect(legacyRoleType("Warden")).toEqual(null);
  });

  it("matches a volunteer on email first, then on name, and flags ambiguity for review", () => {
    expect(matchLegacyVolunteer({reference: "V1", firstName: "Ada", lastName: "Lovelace", email: "ADA@example.org"}, supporters).supporterId).toEqual("supporter-1");
    expect(matchLegacyVolunteer({reference: "V1", firstName: "Ada", lastName: "Lovelace"}, supporters).supporterId).toEqual("supporter-1");
    const ambiguous = matchLegacyVolunteer({reference: "V2", firstName: "Alan", lastName: "Turing"}, supporters);
    expect(ambiguous.supporterId).toEqual(null);
    expect(ambiguous.confidence).toEqual(VolunteerImportMatchConfidence.NEEDS_REVIEW);
    const unmatched = matchLegacyVolunteer({reference: "V3", firstName: "Jo", lastName: "Bloggs"}, supporters);
    expect(unmatched.confidence).toEqual(VolunteerImportMatchConfidence.UNMATCHED);
  });

  it("matches a legacy parish to an existing official code by name when no code is supplied", () => {
    const plan = volunteerImportPlan(payload, existing, 100);
    expect(plan.parishes.map(parish => `${parish.parishCode}/${parish.parishName}`)).toEqual([
      "E04000001/Alpha Civil Parish",
      "E04000002/Beta"
    ]);
    expect(plan.parishes[1].eligibility).toEqual(VolunteerParishEligibility.NO_PUBLIC_RIGHTS_OF_WAY);
  });

  it("puts a parish with no code and no name match into the review queue and imports nothing for it", () => {
    const plan = volunteerImportPlan(payload, existing, 100);
    const parishDecision = plan.reviewQueue.find(decision => decision.reference === "P3");
    expect(parishDecision.action).toEqual(VolunteerImportAction.SKIP);
    expect(parishDecision.reason).toEqual("No official parish code supplied and no parish name matched");
    expect(plan.assignments.some(assignment => assignment.sourceReference.endsWith("A3"))).toEqual(false);
  });

  it("imports an assignment for an unmatched person against their recorded name rather than dropping it", () => {
    const plan = volunteerImportPlan(payload, existing, 100);
    const unresolved = plan.assignments.find(assignment => assignment.sourceReference.endsWith("A2"));
    expect(unresolved.supporterId).toEqual(null);
    expect(unresolved.unresolvedName).toEqual("Jo Bloggs");
    expect(unresolved.identityStatus).toEqual(VolunteerAssignmentIdentityStatus.UNRESOLVED);
    expect(unresolved.coverage).toEqual(VolunteerAssignmentCoverage.TEMPORARY);
  });

  it("skips an assignment whose role is not recognised", () => {
    const plan = volunteerImportPlan(payload, existing, 100);
    const decision = plan.decisions.find(entry => entry.kind === VolunteerImportRecordKind.ASSIGNMENT && entry.reference === "A4");
    expect(decision.action).toEqual(VolunteerImportAction.SKIP);
    expect(decision.reason).toEqual("Role \"Warden\" was not recognised");
  });

  it("links imported assignments to their legacy record so a repeat import updates rather than duplicates", () => {
    const plan = volunteerImportPlan(payload, existing, 100);
    expect(plan.assignments.map(assignment => assignment.sourceReference)).toEqual([
      "legacy-volunteer-import:A1",
      "legacy-volunteer-import:A2"
    ]);
    expect(plan.assignments[0].effectiveFrom).toEqual(null);
  });

  it("imports council contacts, updating one that already exists and holding back one with no email", () => {
    const plan = volunteerImportPlan(payload, existing, 100);
    expect(plan.contacts.map(contact => contact.email)).toEqual(["clerk@alpha-pc.gov.uk", "clerk@beta-pc.gov.uk"]);
    expect(plan.contacts[0].parishCodes).toEqual(["E04000001"]);
    const withoutEmail = plan.reviewQueue.find(decision => decision.reference === "C3");
    expect(withoutEmail.action).toEqual(VolunteerImportAction.SKIP);
    expect(withoutEmail.reason).toEqual("No email address recorded");
  });

  it("combines a clerk who covers several parishes into one contact carrying every parish code", () => {
    const sharedClerkPayload: VolunteerImportPayload = {
      ...payload,
      councilContacts: [
        {reference: "C1", parishReference: "P1", organisationName: "Alpha Parish Council", contactName: "Jan Becket", email: "clerk@shared-pc.gov.uk"},
        {reference: "C2", parishReference: "P2", organisationName: "Beta Parish Council", roleTitle: "Clerk", email: "Clerk@Shared-PC.gov.uk"}
      ]
    };
    const plan = volunteerImportPlan(sharedClerkPayload, existing, 100);
    expect(plan.contacts.length).toEqual(1);
    expect(plan.contacts[0].parishCodes).toEqual(["E04000001", "E04000002"]);
    expect(plan.contacts[0].contactName).toEqual("Jan Becket");
    expect(plan.contacts[0].roleTitle).toEqual("Clerk");
    const mergedDecision = plan.decisions.find(decision => decision.reference === "C2");
    expect(mergedDecision.action).toEqual(VolunteerImportAction.SKIP);
    expect(mergedDecision.confidence).toEqual(VolunteerImportMatchConfidence.MATCHED);
    expect(mergedDecision.matchedTo).toEqual("Alpha Parish Council");
    expect(plan.summary.contactsToImport).toEqual(1);
    expect(plan.summary.contactsNeedingReview).toEqual(0);
  });

  it("summarises what a dry run would do", () => {
    const plan = volunteerImportPlan(payload, existing, 100);
    expect(plan.summary).toEqual({
      parishesToCreate: 1,
      parishesToUpdate: 1,
      parishesNeedingReview: 2,
      volunteersMatched: 1,
      volunteersNeedingReview: 2,
      assignmentsToImport: 1,
      assignmentsToImportUnresolved: 1,
      assignmentsSkipped: 2,
      contactsToImport: 2,
      contactsNeedingReview: 1
    });
  });
});
