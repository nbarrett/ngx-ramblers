import { mapRamblersEventToExtendedGroupEvent, defaultDisplayName } from "./ramblers-event.mapper";
import { GroupEvent, InputSource } from "../../models/group-event.model";
import { RamblersEventType } from "../../models/ramblers-walks-manager";
import { LinkSource } from "../../models/walk.model";

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
      inputSource: InputSource.WALKS_MANAGER_IMPORT,
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
      inputSource: InputSource.WALKS_MANAGER_IMPORT
    });

    expect(result.fields.contactDetails.displayName).toEqual(defaultDisplayName("Bob Example"));
    expect(result.fields.links[result.fields.links.length - 1]).toEqual({
      title: event.title,
      href: event.url,
      source: LinkSource.RAMBLERS
    });
  });
});
