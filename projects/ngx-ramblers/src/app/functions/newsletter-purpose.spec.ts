import { NewsletterIntroEvent, NewsletterIntroPurpose, WalkTimeOfDay } from "../models/ai.model";
import { eventsMatchingDraftPurpose, introPurposeFrom, walkTimeOfDayFromHour } from "./newsletter-purpose";

describe("walkTimeOfDayFromHour", () => {
  it("treats hours before midday as morning", () => {
    expect(walkTimeOfDayFromHour(0)).toEqual(WalkTimeOfDay.MORNING);
    expect(walkTimeOfDayFromHour(11)).toEqual(WalkTimeOfDay.MORNING);
  });

  it("treats hours from midday until 5 pm as afternoon", () => {
    expect(walkTimeOfDayFromHour(12)).toEqual(WalkTimeOfDay.AFTERNOON);
    expect(walkTimeOfDayFromHour(16)).toEqual(WalkTimeOfDay.AFTERNOON);
  });

  it("treats 5 pm onwards as evening", () => {
    expect(walkTimeOfDayFromHour(17)).toEqual(WalkTimeOfDay.EVENING);
    expect(walkTimeOfDayFromHour(21)).toEqual(WalkTimeOfDay.EVENING);
  });

  it("is empty when there is no hour", () => {
    expect(walkTimeOfDayFromHour(null)).toEqual(null);
    expect(walkTimeOfDayFromHour(undefined)).toEqual(null);
  });
});

describe("introPurposeFrom", () => {
  it("uses the stored purpose when it is a walk-leader request", () => {
    expect(introPurposeFrom({introPurpose: NewsletterIntroPurpose.WALK_LEADER_REQUEST}))
      .toEqual(NewsletterIntroPurpose.WALK_LEADER_REQUEST);
  });

  it("falls back to upcoming events", () => {
    expect(introPurposeFrom({})).toEqual(NewsletterIntroPurpose.UPCOMING_EVENTS);
  });
});

describe("eventsMatchingDraftPurpose", () => {
  const complete: NewsletterIntroEvent = {
    title: "Chilham circular",
    eventType: "Walk",
    dateDescription: "Sat 2 Aug"
  };
  const emptySlot: NewsletterIntroEvent = {
    title: "Awaiting walk details",
    eventType: "Walk",
    dateDescription: "Sun 3 Aug",
    awaitingDetails: true
  };

  it("keeps empty slots for a walk-leader request even when only approved walks is on", () => {
    expect(eventsMatchingDraftPurpose(
      [complete, emptySlot],
      NewsletterIntroPurpose.WALK_LEADER_REQUEST,
      true
    )).toEqual([emptySlot]);
  });

  it("drops empty slots from an upcoming-events intro when only approved walks is on", () => {
    expect(eventsMatchingDraftPurpose(
      [complete, emptySlot],
      NewsletterIntroPurpose.UPCOMING_EVENTS,
      true
    )).toEqual([complete]);
  });
});
