import { mapRamblersEventToExtendedGroupEvent, defaultDisplayName, mergeLinksOnSync, mergeFieldsOnSync } from "./ramblers-event.mapper";
import { ExtendedFields, GroupEvent, InputSource } from "../../models/group-event.model";
import { RamblersEventType } from "../../models/ramblers-walks-manager";
import { LinkSource, LinkWithSource } from "../../models/walk.model";

describe("mapRamblersEventToExtendedGroupEvent", () => {
  function baseEvent(overrides: Partial<GroupEvent> = {}): GroupEvent {
    return {
      id: "123",
      area_code: "KT",
      group_code: "KT01",
      group_name: "Kent",
      item_type: RamblersEventType.GROUP_WALK,
      title: "Morning Walk",
      description: "Along the coast",
      additional_details: "",
      start_date_time: "2026-01-04T10:00:00Z",
      end_date_time: "2026-01-04T12:00:00Z",
      meeting_date_time: "2026-01-04T09:30:00Z",
      event_organiser: null,
      location: null,
      start_location: { latitude: 0, longitude: 0, grid_reference_6: "", grid_reference_8: "", grid_reference_10: "", postcode: "", description: "", w3w: "" },
      meeting_location: null,
      end_location: null,
      distance_km: 10,
      distance_miles: 6.2,
      ascent_feet: 0,
      ascent_metres: 0,
      difficulty: null,
      shape: "",
      duration: 2,
      walk_leader: { id: "leader-1", name: "Lee P", telephone: "07700 900000", has_email: true, email_form: "mailto:lee@example.com", is_overridden: false },
      url: "https://ramblers.org/walk",
      external_url: "https://meetup.com/walk",
      status: null,
      cancellation_reason: "",
      accessibility: [],
      facilities: [],
      transport: [],
      media: [],
      linked_event: "",
      date_created: "",
      date_updated: "",
      ...overrides
    };
  }

  it("populates contact details and links when helpers provided", () => {
    const event = baseEvent();
    const result = mapRamblersEventToExtendedGroupEvent(event, {
      inputSource: InputSource.WALKS_MANAGER_CACHE,
      migratedFromId: "legacy-42",
      displayNameBuilder: name => `Leader ${name}`,
      localLinkBuilder: () => "/walks/morning",
      additionalLinksBuilder: groupEvent => [{
        source: LinkSource.MEETUP,
        href: groupEvent.external_url,
        title: "Meetup listing"
      }]
    });

    expect(result.fields.contactDetails.displayName).toEqual("Leader Lee P");
    expect(result.fields.contactDetails.email).toEqual("mailto:lee@example.com");
    expect(result.fields.contactDetails.phone).toEqual("07700 900000");
    expect(result.fields.contactDetails.contactId).toEqual("leader-1");
    expect(result.fields.migratedFromId).toEqual("legacy-42");
    expect(result.fields.links).toEqual([
      { title: "this walk", href: "/walks/morning", source: LinkSource.LOCAL },
      { title: "Meetup listing", href: "https://meetup.com/walk", source: LinkSource.MEETUP },
      { title: "Morning Walk", href: "https://ramblers.org/walk", source: LinkSource.RAMBLERS }
    ]);
  });

  it("falls back to default display name when helper missing", () => {
    const event = baseEvent({ walk_leader: { ...baseEvent().walk_leader, name: "Bob Example" } });
    const result = mapRamblersEventToExtendedGroupEvent(event, {
      inputSource: InputSource.WALKS_MANAGER_CACHE
    });

    expect(result.fields.contactDetails.displayName).toEqual(defaultDisplayName("Bob Example"));
    expect(result.fields.links[result.fields.links.length - 1]).toEqual({
      title: event.title,
      href: event.url,
      source: LinkSource.RAMBLERS
    });
  });
});

describe("mergeLinksOnSync", () => {
  it("preserves LOCAL links from existing and replaces RAMBLERS link from fresh", () => {
    const existingLinks: LinkWithSource[] = [
      { title: "this walk", href: "/walks/local", source: LinkSource.LOCAL },
      { title: "Old Ramblers", href: "https://ramblers.org/old", source: LinkSource.RAMBLERS }
    ];
    const freshLinks: LinkWithSource[] = [
      { title: "New Ramblers", href: "https://ramblers.org/new", source: LinkSource.RAMBLERS }
    ];

    const result = mergeLinksOnSync(existingLinks, freshLinks);

    expect(result).toEqual([
      { title: "this walk", href: "/walks/local", source: LinkSource.LOCAL },
      { title: "New Ramblers", href: "https://ramblers.org/new", source: LinkSource.RAMBLERS }
    ]);
  });

  it("preserves LOCAL links and replaces MEETUP link from fresh", () => {
    const existingLinks: LinkWithSource[] = [
      { title: "this walk", href: "/walks/local", source: LinkSource.LOCAL },
      { title: "Old Meetup", href: "https://meetup.com/old", source: LinkSource.MEETUP }
    ];
    const freshLinks: LinkWithSource[] = [
      { title: "New Meetup", href: "https://meetup.com/new", source: LinkSource.MEETUP }
    ];

    const result = mergeLinksOnSync(existingLinks, freshLinks);

    expect(result).toEqual([
      { title: "this walk", href: "/walks/local", source: LinkSource.LOCAL },
      { title: "New Meetup", href: "https://meetup.com/new", source: LinkSource.MEETUP }
    ]);
  });

  it("handles null or empty existing links gracefully", () => {
    const freshLinks: LinkWithSource[] = [
      { title: "Ramblers", href: "https://ramblers.org/walk", source: LinkSource.RAMBLERS }
    ];

    expect(mergeLinksOnSync(null, freshLinks)).toEqual([
      { title: "Ramblers", href: "https://ramblers.org/walk", source: LinkSource.RAMBLERS }
    ]);
    expect(mergeLinksOnSync([], freshLinks)).toEqual([
      { title: "Ramblers", href: "https://ramblers.org/walk", source: LinkSource.RAMBLERS }
    ]);
  });
});

describe("mergeFieldsOnSync", () => {
  function baseFields(overrides: Partial<ExtendedFields> = {}): ExtendedFields {
    return {
      inputSource: InputSource.WALKS_MANAGER_CACHE,
      migratedFromId: null,
      attachment: null,
      attendees: [],
      contactDetails: {
        contactId: "contact-1",
        memberId: "member-1",
        displayName: "Lee P",
        email: "lee@example.com",
        phone: "07700 900000"
      },
      imageConfig: null,
      links: [{ title: "this walk", href: "/walks/local", source: LinkSource.LOCAL }],
      meetup: null,
      milesPerHour: 0,
      notifications: [],
      publishing: { ramblers: { publish: true, contactName: "Lee P" }, meetup: { publish: false, contactName: null } },
      riskAssessment: [],
      venue: null,
      ...overrides
    };
  }

  it("preserves local fields and updates inputSource", () => {
    const existing = baseFields({ venue: { name: "Car park", postcode: "TN1 1AA", url: null } });
    const fresh = baseFields({ inputSource: InputSource.WALKS_MANAGER_CACHE });

    const result = mergeFieldsOnSync(existing, fresh);

    expect(result.venue).toEqual({ name: "Car park", postcode: "TN1 1AA", url: null });
    expect(result.inputSource).toEqual(InputSource.WALKS_MANAGER_CACHE);
  });

  it("preserves memberId when WM contactId is unchanged", () => {
    const existing = baseFields();
    const fresh = baseFields({ contactDetails: { contactId: "contact-1", memberId: null, displayName: "Lee Updated", email: "lee-new@example.com", phone: "07700 900001" } });

    const result = mergeFieldsOnSync(existing, fresh);

    expect(result.contactDetails.memberId).toEqual("member-1");
    expect(result.contactDetails.displayName).toEqual("Lee Updated");
    expect(result.contactDetails.email).toEqual("lee-new@example.com");
  });

  it("clears memberId when WM contactId changes", () => {
    const existing = baseFields();
    const fresh = baseFields({ contactDetails: { contactId: "contact-2", memberId: null, displayName: "New Leader", email: "new@example.com", phone: null } });

    const result = mergeFieldsOnSync(existing, fresh);

    expect(result.contactDetails.contactId).toEqual("contact-2");
    expect(result.contactDetails.memberId).toBeNull();
    expect(result.contactDetails.displayName).toEqual("New Leader");
  });

  it("uses mergeLinksOnSync for links field", () => {
    const existing = baseFields({
      links: [
        { title: "this walk", href: "/walks/local", source: LinkSource.LOCAL },
        { title: "Old Ramblers", href: "https://ramblers.org/old", source: LinkSource.RAMBLERS }
      ]
    });
    const fresh = baseFields({
      links: [{ title: "New Ramblers", href: "https://ramblers.org/new", source: LinkSource.RAMBLERS }]
    });

    const result = mergeFieldsOnSync(existing, fresh);

    expect(result.links).toEqual([
      { title: "this walk", href: "/walks/local", source: LinkSource.LOCAL },
      { title: "New Ramblers", href: "https://ramblers.org/new", source: LinkSource.RAMBLERS }
    ]);
  });
});
