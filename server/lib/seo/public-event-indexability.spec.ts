import expect from "expect";
import { describe, it } from "mocha";
import { ExtendedGroupEvent } from "../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { WalkStatus } from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import {
  eventHasNonIndexableStatus,
  eventHasNonIndexableTitleOrSlug,
  eventIsPubliclyIndexable,
  eventShouldNoindex
} from "./public-event-indexability";

function event(partial: { title?: string; status?: string; url?: string }): ExtendedGroupEvent {
  return {
    groupEvent: {
      title: partial.title ?? "Coastal walk from Deal",
      status: partial.status as WalkStatus,
      url: partial.url ?? "https://www.example.co.uk/walks/coastal-walk-from-deal"
    }
  } as ExtendedGroupEvent;
}

describe("public-event-indexability", () => {
  it("treats cancelled, draft and deleted statuses as non-indexable", () => {
    expect(eventHasNonIndexableStatus(WalkStatus.CANCELLED)).toBe(true);
    expect(eventHasNonIndexableStatus(WalkStatus.DRAFT)).toBe(true);
    expect(eventHasNonIndexableStatus("deleted")).toBe(true);
    expect(eventHasNonIndexableStatus(WalkStatus.CONFIRMED)).toBe(false);
  });

  it("detects cancelled and fully-booked wording in titles and slugs", () => {
    expect(eventHasNonIndexableTitleOrSlug("Walk cancelled due to weather", "")).toBe(true);
    expect(eventHasNonIndexableTitleOrSlug("", "walk-fully-booked-margate")).toBe(true);
    expect(eventHasNonIndexableTitleOrSlug("Christmas party fully booked", "")).toBe(true);
    expect(eventHasNonIndexableTitleOrSlug("We regret this walk cannot go ahead", "")).toBe(true);
    expect(eventHasNonIndexableTitleOrSlug("Lunch booked at the Spitfire pub", "lunch-booked-at-spitfire")).toBe(false);
  });

  it("allows confirmed walks with ordinary titles into the public sitemap", () => {
    expect(eventIsPubliclyIndexable(event({status: WalkStatus.CONFIRMED}))).toBe(true);
  });

  it("excludes cancelled status and cancelled wording from the public sitemap", () => {
    expect(eventIsPubliclyIndexable(event({status: WalkStatus.CANCELLED}))).toBe(false);
    expect(eventIsPubliclyIndexable(event({
      status: WalkStatus.CONFIRMED,
      title: "Walk cancelled due to coronavirus",
      url: "https://example.org/walks/walk-cancelled-due-to-coronavirus"
    }))).toBe(false);
  });

  it("asks crawlers not to index cancelled events", () => {
    expect(eventShouldNoindex(event({status: WalkStatus.CANCELLED}))).toBe(true);
    expect(eventShouldNoindex(event({
      status: WalkStatus.CONFIRMED,
      title: "Cancelled ABBA night",
      url: "https://example.org/walks/cancelled-abba-night"
    }))).toBe(true);
    expect(eventShouldNoindex(event({
      status: WalkStatus.CONFIRMED,
      title: "Christmas party fully booked",
      url: "https://example.org/walks/christmas-party-fully-booked"
    }))).toBe(false);
  });
});
