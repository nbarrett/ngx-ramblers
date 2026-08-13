import expect from "expect";
import { describe, it } from "mocha";
import { eventBasePathFor, eventPathFor, eventSlugFrom, eventUrlFor } from "./event-url";
import { ExtendedGroupEvent } from "../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { Organisation } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { RamblersEventType } from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";

describe("event-url", () => {

  const group = {} as Organisation;

  function event(url: string, itemType = RamblersEventType.GROUP_WALK, id = "abc123"): ExtendedGroupEvent {
    return {id, groupEvent: {url, item_type: itemType}} as unknown as ExtendedGroupEvent;
  }

  it("takes the slug from a locally created event whose url is just the slug", () => {
    expect(eventSlugFrom(event("chilham-circular"))).toEqual("chilham-circular");
  });

  it("takes the last segment of a Walks Manager url as the slug", () => {
    expect(eventSlugFrom(event("https://walks-manager.ramblers.org.uk/walks-manager/walk/coastal-path")))
      .toEqual("coastal-path");
  });

  it("ignores a query string and trailing slash when working out the slug", () => {
    expect(eventSlugFrom(event("https://example.org/walks/coastal-path/?utm_source=x"))).toEqual("coastal-path");
  });

  it("falls back to the event id when there is no url", () => {
    expect(eventSlugFrom(event(null))).toEqual("abc123");
  });

  it("puts walks under the walks path and social events under the social path", () => {
    expect(eventBasePathFor(event("x", RamblersEventType.GROUP_WALK), group)).toEqual("walks");
    expect(eventBasePathFor(event("x", RamblersEventType.WELLBEING_WALK), group)).toEqual("walks");
    expect(eventBasePathFor(event("x", RamblersEventType.GROUP_EVENT), group)).toEqual("social");
  });

  it("honours configured base paths and trims any slashes", () => {
    const configured = {walksBasePath: "/our-walks/", socialEventsBasePath: "events"} as Organisation;
    expect(eventBasePathFor(event("x", RamblersEventType.GROUP_WALK), configured)).toEqual("our-walks");
    expect(eventBasePathFor(event("x", RamblersEventType.GROUP_EVENT), configured)).toEqual("events");
  });

  it("builds the site path for an event", () => {
    expect(eventPathFor(event("chilham-circular"), group)).toEqual("/walks/chilham-circular");
  });

  it("builds an absolute url from the site base", () => {
    expect(eventUrlFor(event("chilham-circular"), group, "https://example.org/"))
      .toEqual("https://example.org/walks/chilham-circular");
  });

  it("returns null when there is no base url to build from", () => {
    expect(eventUrlFor(event("chilham-circular"), group, null)).toBeNull();
  });
});
