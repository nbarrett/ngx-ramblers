import expect from "expect";
import { describe, it } from "mocha";
import { eventStructuredData } from "./event-structured-data";
import { ExtendedGroupEvent } from "../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { RamblersEventType, WalkStatus } from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import {
  SchemaOrgEventStatus,
  SchemaOrgOfferAvailability,
  SchemaOrgPerformerType
} from "../../../projects/ngx-ramblers/src/app/models/content-export.model";

describe("event-structured-data", () => {

  const config = {group: {href: "https://example.org", longName: "Canterbury Ramblers"}} as unknown as SystemConfig;

  function walk(overrides: any = {}, fields: any = null): ExtendedGroupEvent {
    return {
      id: "abc123",
      groupEvent: {
        title: "Chilham circular",
        description: "A gentle **loop** through the orchards",
        url: "chilham-circular",
        item_type: RamblersEventType.GROUP_WALK,
        status: WalkStatus.CONFIRMED,
        start_date_time: "2026-08-15T09:00:00Z",
        end_date_time: "2026-08-15T12:30:00Z",
        start_location: {description: "Chilham Square", postcode: "CT4 8BY", latitude: 51.24, longitude: 0.96},
        group_name: "Canterbury Ramblers",
        walk_leader: {name: "Jane Leader"},
        date_created: "2026-05-01T10:00:00Z",
        ...overrides
      },
      fields
    } as unknown as ExtendedGroupEvent;
  }

  it("describes a walk as a schema.org Event", () => {
    const data = eventStructuredData(walk(), config, "https://example.org", ["https://example.org/a.jpg"]);
    expect(data["@context"]).toEqual("https://schema.org");
    expect(data["@type"]).toEqual("Event");
    expect(data.name).toEqual("Chilham circular");
    expect(data.description).toEqual("A gentle loop through the orchards");
    expect(data.url).toEqual("https://example.org/walks/chilham-circular");
    expect(data.image).toEqual(["https://example.org/a.jpg"]);
    expect(data.eventStatus).toEqual(SchemaOrgEventStatus.SCHEDULED);
  });

  it("marks a cancelled walk as cancelled", () => {
    const data = eventStructuredData(walk({status: WalkStatus.CANCELLED}), config, "https://example.org", []);
    expect(data.eventStatus).toEqual(SchemaOrgEventStatus.CANCELLED);
  });

  it("includes the start location as a Place with coordinates", () => {
    const data = eventStructuredData(walk(), config, "https://example.org", []);
    expect(data.location["@type"]).toEqual("Place");
    expect(data.location.name).toEqual("Chilham Square");
    expect(data.location.address).toEqual("Chilham Square, CT4 8BY");
    expect(data.location.geo.latitude).toEqual(51.24);
  });

  it("leaves out the location when the event has none", () => {
    const data = eventStructuredData(walk({start_location: null, location: null}), config, "https://example.org", []);
    expect(data.location).toBeUndefined();
  });

  it("leaves out the image list when there are no images", () => {
    const data = eventStructuredData(walk(), config, "https://example.org", []);
    expect(data.image).toBeUndefined();
  });

  it("returns null for an event with no title", () => {
    expect(eventStructuredData(walk({title: null}), config, "https://example.org", [])).toBeNull();
  });

  it("names the organiser from the group", () => {
    const data = eventStructuredData(walk(), config, "https://example.org", []);
    expect(data.organizer.name).toEqual("Canterbury Ramblers");
  });

  it("names the performer from the walk leader", () => {
    const data = eventStructuredData(walk(), config, "https://example.org", []);
    expect(data.performer).toEqual({
      "@type": SchemaOrgPerformerType.PERSON,
      name: "Jane Leader"
    });
  });

  it("prefers the local contact name over the Walks Manager leader", () => {
    const data = eventStructuredData(
      walk({}, {contactDetails: {displayName: "Local Leader"}}),
      config,
      "https://example.org",
      []
    );
    expect(data.performer.name).toEqual("Local Leader");
  });

  it("names the performer from the social event organiser when there is no walk leader", () => {
    const data = eventStructuredData(
      walk({walk_leader: null, event_organiser: {name: "Sam Host"}}),
      config,
      "https://example.org",
      []
    );
    expect(data.performer).toEqual({
      "@type": SchemaOrgPerformerType.PERSON,
      name: "Sam Host"
    });
  });

  it("falls back to the group as the performing group when no person is named", () => {
    const data = eventStructuredData(walk({walk_leader: null, event_organiser: null}), config, "https://example.org", []);
    expect(data.performer).toEqual({
      "@type": SchemaOrgPerformerType.PERFORMING_GROUP,
      name: "Canterbury Ramblers"
    });
  });

  it("offers a free place on the event page", () => {
    const data = eventStructuredData(walk(), config, "https://example.org", []);
    expect(data.offers["@type"]).toEqual("Offer");
    expect(data.offers.price).toEqual(0);
    expect(data.offers.priceCurrency).toEqual("GBP");
    expect(data.offers.availability).toEqual(SchemaOrgOfferAvailability.IN_STOCK);
    expect(data.offers.url).toEqual("https://example.org/walks/chilham-circular");
    expect(data.offers.validFrom).toBeTruthy();
  });

  it("marks the offer as sold out when the event is cancelled", () => {
    const data = eventStructuredData(walk({status: WalkStatus.CANCELLED}), config, "https://example.org", []);
    expect(data.offers.availability).toEqual(SchemaOrgOfferAvailability.SOLD_OUT);
  });
});
