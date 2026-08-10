import expect from "expect";
import { describe, it } from "mocha";
import { volunteerAudience } from "../../../projects/ngx-ramblers/src/app/functions/volunteer-audiences";
import {
  VolunteerAssignment,
  VolunteerAssignmentCoverage,
  VolunteerAssignmentIdentityStatus,
  VolunteerAssignmentStatus,
  VolunteerAudienceType,
  VolunteerParish,
  VolunteerParishEligibility,
  VolunteerRoleType,
  VolunteerSupporterIdentity
} from "../../../projects/ngx-ramblers/src/app/models/volunteer-management.model";
import { ExternalContactType, ExternalRecipient } from "../../../projects/ngx-ramblers/src/app/models/external-recipient.model";

describe("volunteer audiences", () => {
  const parishes = [
    {groupCode: "EK", parishCode: "A", parishName: "Alpha", localAuthorityCode: "AD", sectorCode: "S1", rightsOfWayGroupCode: "G1", eligibility: VolunteerParishEligibility.ACTIVE},
    {groupCode: "EK", parishCode: "B", parishName: "Beta", localAuthorityCode: "BD", sectorCode: "S2", rightsOfWayGroupCode: "G2", eligibility: VolunteerParishEligibility.ACTIVE}
  ] as VolunteerParish[];
  const members: VolunteerSupporterIdentity[] = [
    {id: "supporter-1", firstName: "Ada", lastName: "Lovelace", email: "ada@example.org"},
    {id: "supporter-2", firstName: "Alan", lastName: "Turing", email: "alan@example.org"},
    {id: "supporter-3", firstName: "Grace", lastName: "Hopper"}
  ];
  const contacts: ExternalRecipient[] = [
    {id: "contact-1", email: "clerk@alpha-pc.gov.uk", organisationName: "Alpha Parish Council", contactType: ExternalContactType.PARISH_COUNCIL, parishCodes: ["A"], createdBy: "test", createdAt: 1},
    {id: "contact-2", email: "clerk@beta-pc.gov.uk", organisationName: "Beta Parish Council", contactType: ExternalContactType.PARISH_COUNCIL, parishCodes: ["B"], createdBy: "test", createdAt: 1},
    {id: "contact-3", email: "rights@county.gov.uk", organisationName: "County Highways", contactType: ExternalContactType.LOCAL_AUTHORITY, parishCodes: ["A", "B"], createdBy: "test", createdAt: 1}
  ];
  const assignment = (overrides: Partial<VolunteerAssignment>): VolunteerAssignment => ({
    id: "assignment-1",
    groupCode: "EK",
    parishCode: "A",
    supporterId: "supporter-1",
    identityStatus: VolunteerAssignmentIdentityStatus.LINKED,
    roleType: VolunteerRoleType.LOCAL_FOOTPATH_OFFICER,
    coverage: VolunteerAssignmentCoverage.PERMANENT,
    status: VolunteerAssignmentStatus.ACTIVE,
    effectiveFrom: 1,
    createdAt: 1,
    createdBy: "test",
    updatedAt: 1,
    updatedBy: "test",
    ...overrides
  });
  const assignments = [
    assignment({id: "one"}),
    assignment({id: "two", roleType: VolunteerRoleType.PARISH_FOOTPATH_OBSERVER}),
    assignment({id: "three", parishCode: "B", supporterId: "supporter-2", roleType: VolunteerRoleType.PARISH_FOOTPATH_OBSERVER}),
    assignment({id: "four", parishCode: "B", supporterId: null, unresolvedName: "Jo Bloggs", identityStatus: VolunteerAssignmentIdentityStatus.UNRESOLVED}),
    assignment({id: "five", parishCode: "A", supporterId: "supporter-3", roleType: VolunteerRoleType.GROUP_COORDINATOR}),
    assignment({id: "six", parishCode: "A", supporterId: "supporter-2", status: VolunteerAssignmentStatus.ENDED, effectiveTo: 9})
  ];
  const input = {parishes, assignments, members, contacts};

  it("selects only holders of the requested role from active assignments", () => {
    const audience = volunteerAudience({audienceType: VolunteerAudienceType.LOCAL_FOOTPATH_OFFICERS}, input);
    expect(audience.supporterIds).toEqual(["supporter-1"]);
    expect(audience.title).toEqual("Local Footpath Officers");
  });

  it("separates volunteers holding both roles from those holding only the observer role", () => {
    expect(volunteerAudience({audienceType: VolunteerAudienceType.COMBINED_ROLE_HOLDERS}, input).supporterIds).toEqual(["supporter-1"]);
    expect(volunteerAudience({audienceType: VolunteerAudienceType.PARISH_FOOTPATH_OBSERVERS_EXCLUDING_OFFICERS}, input).supporterIds).toEqual(["supporter-2"]);
  });

  it("leaves out volunteers with no email address and assignments with no supporter link", () => {
    const audience = volunteerAudience({audienceType: VolunteerAudienceType.ALL_ROLE_HOLDERS}, input);
    expect(audience.supporterIds).toEqual(["supporter-1", "supporter-2"]);
    expect(audience.excluded).toEqual([
      {reason: "No email address", count: 1, names: ["Grace Hopper"]},
      {reason: "Not linked to a supporter record", count: 1, names: ["Jo Bloggs"]}
    ]);
  });

  it("limits the audience to parishes matching the authority, sector or group filters", () => {
    expect(volunteerAudience({audienceType: VolunteerAudienceType.ALL_ROLE_HOLDERS, localAuthorityCode: "BD"}, input).supporterIds).toEqual(["supporter-2"]);
    expect(volunteerAudience({audienceType: VolunteerAudienceType.ALL_ROLE_HOLDERS, sectorCode: "S1"}, input).supporterIds).toEqual(["supporter-1"]);
    expect(volunteerAudience({audienceType: VolunteerAudienceType.ALL_ROLE_HOLDERS, rightsOfWayGroupCode: "G2"}, input).supporterIds).toEqual(["supporter-2"]);
  });

  it("builds council and authority audiences from contacts, honouring parish filters", () => {
    const councils = volunteerAudience({audienceType: VolunteerAudienceType.PARISH_AND_TOWN_COUNCILS}, input);
    expect(councils.supporterIds).toEqual([]);
    expect(councils.externalRecipients.map(recipient => recipient.email)).toEqual(["clerk@alpha-pc.gov.uk", "clerk@beta-pc.gov.uk"]);

    const filtered = volunteerAudience({audienceType: VolunteerAudienceType.PARISH_AND_TOWN_COUNCILS, localAuthorityCode: "AD"}, input);
    expect(filtered.externalRecipients.map(recipient => recipient.email)).toEqual(["clerk@alpha-pc.gov.uk"]);

    const authorities = volunteerAudience({audienceType: VolunteerAudienceType.LOCAL_AUTHORITY_CONTACTS}, input);
    expect(authorities.externalRecipients.map(recipient => recipient.email)).toEqual(["rights@county.gov.uk"]);
  });

  it("includes a contact only once even when two records share an address", () => {
    const duplicateContact: ExternalRecipient = {id: "contact-4", email: "CLERK@alpha-pc.gov.uk", organisationName: "Alpha Parish Council Office", contactType: ExternalContactType.PARISH_COUNCIL, parishCodes: ["A"], createdBy: "test", createdAt: 1};
    const audience = volunteerAudience({audienceType: VolunteerAudienceType.PARISH_AND_TOWN_COUNCILS}, {...input, contacts: [...contacts, duplicateContact]});
    expect(audience.externalRecipients.map(recipient => recipient.email)).toEqual(["clerk@alpha-pc.gov.uk", "clerk@beta-pc.gov.uk"]);
    expect(audience.excluded).toContainEqual({reason: "Already included under another entry", count: 1, names: ["Alpha Parish Council Office"]});
  });

  it("leaves out a contact with no email address", () => {
    const contactWithoutEmail: ExternalRecipient = {id: "contact-5", email: "", organisationName: "Gamma Parish Council", contactType: ExternalContactType.PARISH_COUNCIL, parishCodes: ["A"], createdBy: "test", createdAt: 1};
    const audience = volunteerAudience({audienceType: VolunteerAudienceType.PARISH_AND_TOWN_COUNCILS}, {...input, contacts: [...contacts, contactWithoutEmail]});
    expect(audience.excluded).toContainEqual({reason: "No email address", count: 1, names: ["Gamma Parish Council"]});
  });

  it("groups exclusions by reason so one repeated name does not fill the list", () => {
    const manyUnresolved = Array.from({length: 40}, (unused, index) => assignment({
      id: `unresolved-${index}`,
      parishCode: index % 2 === 0 ? "A" : "B",
      supporterId: null,
      unresolvedName: "Existing allocated coverage",
      identityStatus: VolunteerAssignmentIdentityStatus.UNRESOLVED
    }));
    const audience = volunteerAudience({audienceType: VolunteerAudienceType.ALL_ROLE_HOLDERS}, {...input, assignments: manyUnresolved});
    expect(audience.excluded).toEqual([
      {reason: "Not linked to a supporter record", count: 40, names: ["Existing allocated coverage"]}
    ]);
  });
});
