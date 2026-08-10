import expect from "expect";
import { describe, it } from "mocha";
import {
  externalContactDisplayName,
  externalContactDuplicates,
  externalContactRows,
  filterExternalContacts
} from "../../../projects/ngx-ramblers/src/app/functions/external-contacts";
import {
  externalContactLastActivity,
  externalContactRetentionConfigured,
  externalContactRetentionReviews,
  staleExternalContacts
} from "../../../projects/ngx-ramblers/src/app/functions/external-contact-retention";
import {
  ExternalContactRetentionStatus,
  ExternalContactType,
  ExternalRecipient
} from "../../../projects/ngx-ramblers/src/app/models/external-recipient.model";
import { VolunteerParish, VolunteerParishEligibility, VolunteerSupporterIdentity } from "../../../projects/ngx-ramblers/src/app/models/volunteer-management.model";

describe("external contacts", () => {
  const parishes = [
    {groupCode: "EK", parishCode: "A", parishName: "Alpha", eligibility: VolunteerParishEligibility.ACTIVE},
    {groupCode: "EK", parishCode: "B", parishName: "Beta", eligibility: VolunteerParishEligibility.ACTIVE}
  ] as VolunteerParish[];
  const members: VolunteerSupporterIdentity[] = [{id: "supporter-1", firstName: "Ada", lastName: "Lovelace", email: "ada@example.org"}];
  const contact = (overrides: Partial<ExternalRecipient>): ExternalRecipient => ({
    id: "contact-1",
    email: "clerk@alpha-pc.gov.uk",
    createdBy: "test",
    createdAt: 1,
    ...overrides
  });

  it("names a contact by organisation, contact name, saved name or email in that order", () => {
    expect(externalContactDisplayName(contact({organisationName: "Alpha Parish Council", contactName: "Jo Bloggs"}))).toEqual("Alpha Parish Council (Jo Bloggs)");
    expect(externalContactDisplayName(contact({organisationName: "Alpha Parish Council"}))).toEqual("Alpha Parish Council");
    expect(externalContactDisplayName(contact({contactName: "Jo Bloggs"}))).toEqual("Jo Bloggs");
    expect(externalContactDisplayName(contact({name: "Saved name"}))).toEqual("Saved name");
    expect(externalContactDisplayName(contact({}))).toEqual("clerk@alpha-pc.gov.uk");
  });

  it("resolves linked parish names and any linked supporter", () => {
    const rows = externalContactRows([
      contact({organisationName: "Alpha Parish Council", contactType: ExternalContactType.PARISH_COUNCIL, parishCodes: ["A", "B"], supporterId: "supporter-1"}),
      contact({id: "contact-2", email: "other@example.org", parishCodes: ["missing-code"]})
    ], parishes, members);

    expect(rows[0].linkedParishCount).toEqual(2);
    expect(rows[0].linkedParishNames).toEqual("Alpha, Beta");
    expect(rows[0].contactTypeLabel).toEqual("Parish council");
    expect(rows[0].supporterName).toEqual("Ada Lovelace");
    expect(rows[1].linkedParishNames).toEqual("missing-code");
    expect(rows[1].contactTypeLabel).toEqual("Unclassified");
    expect(rows[1].supporterName).toEqual("");
  });

  it("filters contacts by search text and contact type", () => {
    const rows = externalContactRows([
      contact({organisationName: "Alpha Parish Council", contactType: ExternalContactType.PARISH_COUNCIL, parishCodes: ["A"]}),
      contact({id: "contact-2", email: "rights@county.gov.uk", organisationName: "County Highways", contactType: ExternalContactType.LOCAL_AUTHORITY})
    ], parishes, members);
    const noFilters = {searchText: "", contactType: null, parishCode: null};

    expect(filterExternalContacts(rows, noFilters).length).toEqual(2);
    expect(filterExternalContacts(rows, {...noFilters, searchText: "county"}).map(row => row.displayName)).toEqual(["County Highways"]);
    expect(filterExternalContacts(rows, {...noFilters, searchText: "alpha"}).map(row => row.displayName)).toEqual(["Alpha Parish Council"]);
    expect(filterExternalContacts(rows, {...noFilters, contactType: ExternalContactType.LOCAL_AUTHORITY}).map(row => row.displayName)).toEqual(["County Highways"]);
    expect(filterExternalContacts(rows, {...noFilters, parishCode: "A"}).map(row => row.displayName)).toEqual(["Alpha Parish Council"]);
  });

  it("detects likely duplicates without matching a record against itself", () => {
    const existing = [
      contact({id: "contact-1", email: "clerk@alpha-pc.gov.uk", organisationName: "Alpha Parish Council", contactName: "Jo Bloggs"}),
      contact({id: "contact-2", email: "other@example.org", organisationName: "Beta Parish Council"})
    ];

    const sameEmail = externalContactDuplicates(contact({id: "new", email: "CLERK@alpha-pc.gov.uk"}), existing);
    expect(sameEmail.map(duplicate => duplicate.reason)).toEqual(["Same email address"]);

    const sameOrganisationAndName = externalContactDuplicates(contact({id: "new", email: "different@example.org", organisationName: "alpha parish council", contactName: "jo bloggs"}), existing);
    expect(sameOrganisationAndName.map(duplicate => duplicate.id)).toEqual(["contact-1"]);

    const sameOrganisationOnly = externalContactDuplicates(contact({id: "new", email: "clerk2@beta-pc.gov.uk", organisationName: "Beta Parish Council"}), existing);
    expect(sameOrganisationOnly.map(duplicate => duplicate.reason)).toEqual(["Same organisation"]);

    expect(externalContactDuplicates(existing[0], existing)).toEqual([]);
    expect(externalContactDuplicates(contact({id: "new", email: "brand-new@example.org", organisationName: "Gamma Parish Council"}), existing)).toEqual([]);
  });

  describe("retention classification", () => {
    const DAY = 24 * 60 * 60 * 1000;
    const now = 1000 * DAY;

    it("knows whether a retention window is configured", () => {
      expect(externalContactRetentionConfigured(365)).toEqual(true);
      expect(externalContactRetentionConfigured(0)).toEqual(false);
      expect(externalContactRetentionConfigured(-1)).toEqual(false);
      expect(externalContactRetentionConfigured(null)).toEqual(false);
      expect(externalContactRetentionConfigured(undefined)).toEqual(false);
    });

    it("takes the most recent of created, updated and last used as the last activity", () => {
      expect(externalContactLastActivity(contact({createdAt: 5}))).toEqual(5);
      expect(externalContactLastActivity(contact({createdAt: 5, updatedAt: 9}))).toEqual(9);
      expect(externalContactLastActivity(contact({createdAt: 5, updatedAt: 9, lastUsedAt: 12}))).toEqual(12);
    });

    it("classifies a contact with a supporter link as linked to a supporter regardless of age", () => {
      const reviews = externalContactRetentionReviews([contact({supporterId: "supporter-1", createdAt: 1})], 30, now);
      expect(reviews[0].status).toEqual(ExternalContactRetentionStatus.LINKED_TO_SUPPORTER);
      expect(reviews[0].reason).toEqual("Linked to a supporter record");
    });

    it("retains a contact with parish, authority, sector or group links regardless of age", () => {
      const linked = [
        contact({id: "parish", parishCodes: ["A"], createdAt: 1}),
        contact({id: "authority", localAuthorityCodes: ["AD"], createdAt: 1}),
        contact({id: "sector", sectorCodes: ["S1"], createdAt: 1}),
        contact({id: "group", rightsOfWayGroupCodes: ["G1"], createdAt: 1})
      ];
      const reviews = externalContactRetentionReviews(linked, 30, now);
      expect(reviews.map(review => review.status)).toEqual([
        ExternalContactRetentionStatus.RETAINED,
        ExternalContactRetentionStatus.RETAINED,
        ExternalContactRetentionStatus.RETAINED,
        ExternalContactRetentionStatus.RETAINED
      ]);
      expect(reviews[0].reason).toEqual("Has parish, authority, sector or group links");
    });

    it("classifies an unlinked contact outside the retention window as stale", () => {
      const reviews = externalContactRetentionReviews([contact({createdAt: now - 31 * DAY})], 30, now);
      expect(reviews[0].status).toEqual(ExternalContactRetentionStatus.STALE);
      expect(reviews[0].reason).toEqual("No parish, authority or group links and not updated within the retention window of 30 days");
    });

    it("retains an unlinked contact updated within the retention window", () => {
      const reviews = externalContactRetentionReviews([contact({createdAt: now - 60 * DAY, updatedAt: now - 5 * DAY})], 30, now);
      expect(reviews[0].status).toEqual(ExternalContactRetentionStatus.RETAINED);
      expect(reviews[0].reason).toEqual("Updated within the retention window");
    });

    it("retains everything when no retention window is configured", () => {
      const reviews = externalContactRetentionReviews([contact({createdAt: 1})], 0, now);
      expect(reviews[0].status).toEqual(ExternalContactRetentionStatus.RETAINED);
    });

    it("lists only the stale contacts for the data quality report", () => {
      const stale = staleExternalContacts([
        contact({id: "stale", createdAt: now - 31 * DAY}),
        contact({id: "recent", createdAt: now - 1 * DAY}),
        contact({id: "linked", parishCodes: ["A"], createdAt: 1}),
        contact({id: "supporter", supporterId: "supporter-1", createdAt: 1})
      ], 30, now);
      expect(stale.map(entry => entry.id)).toEqual(["stale"]);
    });
  });
});
