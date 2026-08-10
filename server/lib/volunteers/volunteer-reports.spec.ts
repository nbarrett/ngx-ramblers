import expect from "expect";
import { describe, it } from "mocha";
import { volunteerReport } from "../../../projects/ngx-ramblers/src/app/functions/volunteer-reports";
import {
  VolunteerAssignment,
  VolunteerAssignmentCoverage,
  VolunteerAssignmentIdentityStatus,
  VolunteerAssignmentStatus,
  VolunteerDirectoryColumn,
  VolunteerParish,
  VolunteerParishEligibility,
  VolunteerReportType,
  VolunteerRoleType,
  VolunteerSupporterIdentity
} from "../../../projects/ngx-ramblers/src/app/models/volunteer-management.model";
import { ExternalContactType, ExternalRecipient } from "../../../projects/ngx-ramblers/src/app/models/external-recipient.model";

describe("volunteer reports", () => {
  const parishes = [
    {groupCode: "EK", parishCode: "A", parishName: "Alpha", localAuthorityName: "Alpha District", localAuthorityCode: "AD", sectorCode: "S1", rightsOfWayGroupCode: "G1", eligibility: VolunteerParishEligibility.ACTIVE},
    {groupCode: "EK", parishCode: "B", parishName: "Beta", localAuthorityName: "Beta District", localAuthorityCode: "BD", sectorCode: "S2", rightsOfWayGroupCode: "G2", eligibility: VolunteerParishEligibility.ACTIVE},
    {groupCode: "EK", parishCode: "C", parishName: "Gamma", eligibility: VolunteerParishEligibility.NO_PUBLIC_RIGHTS_OF_WAY}
  ] as VolunteerParish[];
  const members: VolunteerSupporterIdentity[] = [
    {id: "supporter-1", firstName: "Ada", lastName: "Lovelace", email: "ada@example.org"},
    {id: "supporter-2", firstName: "Alan", lastName: "Turing"}
  ];
  const contacts: ExternalRecipient[] = [
    {id: "contact-1", email: "clerk@alpha-pc.gov.uk", organisationName: "Alpha Parish Council", contactType: ExternalContactType.PARISH_COUNCIL, telephone: "01227 000000", createdBy: "test", createdAt: 1},
    {id: "contact-2", email: "clerk@beta-pc.gov.uk", organisationName: "Beta Parish Council", contactType: ExternalContactType.PARISH_COUNCIL, createdBy: "test", createdAt: 1}
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
    assignment({id: "two", roleType: VolunteerRoleType.PARISH_FOOTPATH_OBSERVER, coverage: VolunteerAssignmentCoverage.TEMPORARY}),
    assignment({id: "three", parishCode: "B", supporterId: "supporter-2"}),
    assignment({id: "four", parishCode: "B", supporterId: null, unresolvedName: "Jo Bloggs", identityStatus: VolunteerAssignmentIdentityStatus.UNRESOLVED, roleType: VolunteerRoleType.PARISH_FOOTPATH_OBSERVER}),
    assignment({id: "five", parishCode: "C", status: VolunteerAssignmentStatus.ENDED, supporterId: "supporter-2", effectiveTo: 9})
  ];
  const input = {parishes, assignments, members, contacts, formatDate: (value: number) => `date-${value}`};

  it("lists vacancies only for eligible parishes", () => {
    const report = volunteerReport(VolunteerReportType.VACANCIES, input);
    expect(report.rows).toEqual([]);
    expect(report.columns.map(column => column.key)).toContain("rightsOfWayGroup");
  });

  it("reports a vacancy when an eligible parish has no holder of a role", () => {
    const report = volunteerReport(VolunteerReportType.VACANCIES, {...input, assignments: [assignment({id: "one"})]});
    expect(report.rows.map(row => `${row.parishName}/${row.role}`)).toEqual([
      "Alpha/Parish Footpath Observer",
      "Beta/Local Footpath Officer",
      "Beta/Parish Footpath Observer"
    ]);
  });

  it("reports cover type with formatted effective dates", () => {
    const report = volunteerReport(VolunteerReportType.COVER_TYPE, input);
    const temporary = report.rows.find(row => row.cover === "Temporary");
    expect(temporary.volunteer).toEqual("Ada Lovelace");
    expect(temporary.effectiveFrom).toEqual("date-1");
    expect(temporary.effectiveTo).toEqual("");
    expect(report.rows.length).toEqual(4);
  });

  it("lists volunteers holding both roles", () => {
    const report = volunteerReport(VolunteerReportType.COMBINED_ROLE_HOLDERS, input);
    expect(report.rows.map(row => row.volunteer)).toEqual(["Ada Lovelace"]);
    expect(report.rows[0].localFootpathOfficerParishes).toEqual("Alpha");
    expect(report.rows[0].parishFootpathObserverParishes).toEqual("Alpha");
  });

  it("lists assignments recorded against a name rather than a supporter", () => {
    const report = volunteerReport(VolunteerReportType.UNRESOLVED_SUPPORTER_LINKS, input);
    expect(report.rows.map(row => row.recordedName)).toEqual(["Jo Bloggs"]);
    expect(report.rows[0].parishName).toEqual("Beta");
  });

  it("reports volunteers missing an email and contacts missing details", () => {
    const report = volunteerReport(VolunteerReportType.MISSING_CONTACT_INFORMATION, input);
    expect(report.rows.map(row => `${row.name}: ${row.missing}`)).toEqual([
      "Alan Turing: Email address",
      "Jo Bloggs: Supporter link and email address",
      "Beta Parish Council: Telephone"
    ]);
  });

  it("flags duplicate contacts and records pointing at a parish that no longer exists", () => {
    const duplicate: ExternalRecipient = {id: "contact-3", email: "clerk2@alpha-pc.gov.uk", organisationName: "Alpha Parish Council", contactType: ExternalContactType.PARISH_COUNCIL, telephone: "01227 111111", createdBy: "test", createdAt: 1};
    const strandedContact: ExternalRecipient = {id: "contact-4", email: "clerk@gone-pc.gov.uk", organisationName: "Gone Parish Council", contactType: ExternalContactType.PARISH_COUNCIL, telephone: "01227 222222", parishCodes: ["NO-SUCH-CODE"], createdBy: "test", createdAt: 1};
    const strandedAssignment = assignment({id: "stranded", parishCode: "ALSO-MISSING"});
    const report = volunteerReport(VolunteerReportType.MISSING_CONTACT_INFORMATION, {
      ...input,
      assignments: [...assignments, strandedAssignment],
      contacts: [...contacts, duplicate, strandedContact]
    });

    expect(report.rows).toContainEqual({name: "Alpha Parish Council", recordType: "Parish council", missing: "Possible duplicate", context: "Alpha Parish Council (same organisation)"});
    expect(report.rows).toContainEqual({name: "Ada Lovelace", recordType: "Assignment", missing: "Parish not found", context: "ALSO-MISSING"});
    expect(report.rows).toContainEqual({name: "Gone Parish Council", recordType: "Parish council", missing: "Parish not found", context: "NO-SUCH-CODE"});
  });

  it("lists contacts held longer than the retention window with no parish link when a window is set", () => {
    const day = 24 * 60 * 60 * 1000;
    const now = 1000 * day;
    const staleContact: ExternalRecipient = {id: "contact-stale", email: "old-clerk@gone-pc.gov.uk", organisationName: "Old Clerk", contactType: ExternalContactType.INDIVIDUAL, telephone: "01227 333333", createdAt: now - 800 * day, createdBy: "test"};
    const linkedContact: ExternalRecipient = {id: "contact-linked", email: "linked@alpha-pc.gov.uk", organisationName: "Linked Clerk", contactType: ExternalContactType.INDIVIDUAL, telephone: "01227 444444", parishCodes: ["A"], createdAt: now - 800 * day, createdBy: "test"};
    const report = volunteerReport(VolunteerReportType.MISSING_CONTACT_INFORMATION, {
      ...input,
      contacts: [...contacts, staleContact, linkedContact],
      contactRetentionDays: 730,
      now
    });

    expect(report.rows).toContainEqual({name: "Old Clerk", recordType: "Individual", missing: "Held longer than the retention window with no parish link", context: `Last updated date-${now - 800 * day}`});
    expect(report.rows.filter(row => row.name === "Linked Clerk" && row.missing === "Held longer than the retention window with no parish link")).toEqual([]);
  });

  it("flags no contacts for retention when no window is configured", () => {
    const day = 24 * 60 * 60 * 1000;
    const now = 1000 * day;
    const staleContact: ExternalRecipient = {id: "contact-stale", email: "old-clerk@gone-pc.gov.uk", organisationName: "Old Clerk", contactType: ExternalContactType.INDIVIDUAL, telephone: "01227 333333", createdAt: now - 800 * day, createdBy: "test"};
    const report = volunteerReport(VolunteerReportType.MISSING_CONTACT_INFORMATION, {...input, contacts: [...contacts, staleContact], now});

    expect(report.rows.filter(row => row.missing === "Held longer than the retention window with no parish link")).toEqual([]);
  });

  it("groups the vacancy and coverage reports so they can be worked through by group", () => {
    expect(volunteerReport(VolunteerReportType.VACANCIES, input).groupByKey).toEqual("rightsOfWayGroup");
    expect(volunteerReport(VolunteerReportType.PARISH_COVERAGE, input).groupByKey).toEqual("localAuthority");
    expect(volunteerReport(VolunteerReportType.COVER_TYPE, input).groupByKey).toEqual(undefined);
  });

  it("includes coordinators among the current role holders", () => {
    const withCoordinator = [...assignments, assignment({id: "coordinator", supporterId: "supporter-2", roleType: VolunteerRoleType.GROUP_COORDINATOR})];
    const report = volunteerReport(VolunteerReportType.ACTIVE_ROLE_HOLDERS, {...input, assignments: withCoordinator});
    expect(report.rows.map(row => `${row.volunteer}/${row.role}`)).toContain("Alan Turing/Group Coordinator");
  });

  it("exports parish codes with coverage and eligibility for mapping", () => {
    const report = volunteerReport(VolunteerReportType.PARISH_CODES_FOR_MAPPING, input);
    expect(report.columns.map(column => column.label)).toEqual(["PARISH_CODE", "PARISH_NAME", "AUTHORITY_CODE", "AUTHORITY_NAME", "SECTOR", "TYPE", "ROW_GROUP", "LFO", "PFO", "COVERAGE", "ELIGIBLE"]);
    expect(report.rows.map(row => `${row.parishCode}/${row.coverage}/${row.eligible}`)).toEqual([
      "A/Covered/Y",
      "B/Covered/Y",
      "C/LFO & PFO vacant/N"
    ]);
  });

  it("builds an assignment directory whose contact columns are chosen by the caller", () => {
    const linkedContacts = [{...contacts[0], parishCodes: ["A"]}] as ExternalRecipient[];
    const bare = volunteerReport(VolunteerReportType.ASSIGNMENT_DIRECTORY, {...input, contacts: linkedContacts});
    expect(bare.columns.map(column => column.key)).toEqual(["volunteer", "role", "target", "localAuthority", "rightsOfWayGroup", "sector", "cover"]);
    expect(bare.rows.length).toEqual(4);
    expect(bare.rows[0].volunteer).toEqual("Ada Lovelace");
    expect(bare.rows[0].email).toEqual(undefined);

    const withContactColumns = volunteerReport(VolunteerReportType.ASSIGNMENT_DIRECTORY, {
      ...input,
      contacts: linkedContacts,
      directoryColumns: [VolunteerDirectoryColumn.EMAIL, VolunteerDirectoryColumn.COUNCIL_CONTACT]
    });
    expect(withContactColumns.columns.map(column => column.key)).toContain("email");
    expect(withContactColumns.columns.map(column => column.key)).toContain("councilContact");
    const adaRow = withContactColumns.rows.find(row => row.volunteer === "Ada Lovelace" && row.role === "Local Footpath Officer");
    expect(adaRow.email).toEqual("ada@example.org");
    expect(adaRow.councilContact).toEqual("Alpha Parish Council");
    expect(adaRow.councilContactEmail).toEqual("clerk@alpha-pc.gov.uk");
    const betaRow = withContactColumns.rows.find(row => row.target === "Beta" && row.volunteer === "Alan Turing");
    expect(betaRow.councilContact).toEqual("");
  });

  it("reports people who once held an assignment but hold none now", () => {
    const report = volunteerReport(VolunteerReportType.VOLUNTEERS_WITHOUT_ASSIGNMENTS, {...input, assignments: [assignment({id: "five", status: VolunteerAssignmentStatus.ENDED, effectiveTo: 9})]});
    expect(report.rows.map(row => row.volunteer)).toEqual(["Ada Lovelace"]);
    expect(report.rows[0].endedAssignmentCount).toEqual(1);
  });
});
