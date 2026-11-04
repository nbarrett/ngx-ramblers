import { NewsletterIntroEvent, NewsletterIntroPurpose, WalkTimeOfDay } from "../models/ai.model";
import { composerIncludesEvent, emptyDraftPurposeCopy, emptyDraftPurposeMessage, eventsMatchingDraftPurpose, introPurposeFrom, RESEND_WITHIN_PERIOD_LABEL, walkTimeOfDayFromHour } from "./newsletter-purpose";
import { ProgrammeOverviewStatus } from "../models/walk-programme.model";
import { RamblersEventType } from "../models/ramblers-walks-manager";

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
  it("preserves the configured platform update purpose", () => {
    expect(introPurposeFrom({introPurpose: NewsletterIntroPurpose.PLATFORM_UPDATE})).toBe(NewsletterIntroPurpose.PLATFORM_UPDATE);
  });

  it("uses the stored purpose when it is a walk-leader request", () => {
    expect(introPurposeFrom({introPurpose: NewsletterIntroPurpose.WALK_LEADER_REQUEST}))
      .toEqual(NewsletterIntroPurpose.WALK_LEADER_REQUEST);
  });

  it("falls back to upcoming events", () => {
    expect(introPurposeFrom({})).toEqual(NewsletterIntroPurpose.UPCOMING_EVENTS);
  });
});

describe("composerIncludesEvent", () => {
  it("hides walks still awaiting details when only approved walks is on", () => {
    expect(composerIncludesEvent({
      programmeStatus: ProgrammeOverviewStatus.AWAITING_WALK_DETAILS,
      ramblersEventType: RamblersEventType.GROUP_WALK
    }, true, NewsletterIntroPurpose.UPCOMING_EVENTS)).toBe(false);
    expect(composerIncludesEvent({
      programmeStatus: ProgrammeOverviewStatus.APPROVED,
      ramblersEventType: RamblersEventType.GROUP_WALK
    }, true, NewsletterIntroPurpose.UPCOMING_EVENTS)).toBe(true);
    expect(composerIncludesEvent({
      ramblersEventType: RamblersEventType.GROUP_EVENT
    }, true, NewsletterIntroPurpose.UPCOMING_EVENTS)).toBe(true);
  });

  it("keeps awaiting walks when the flag is off or the purpose is a leader request", () => {
    const awaiting = {
      programmeStatus: ProgrammeOverviewStatus.AWAITING_LEADER,
      ramblersEventType: RamblersEventType.GROUP_WALK
    };
    expect(composerIncludesEvent(awaiting, false, NewsletterIntroPurpose.UPCOMING_EVENTS)).toBe(true);
    expect(composerIncludesEvent(awaiting, true, NewsletterIntroPurpose.WALK_LEADER_REQUEST)).toBe(true);
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

describe("emptyDraftPurposeMessage", () => {

  it("explains when no events are selected for an upcoming intro", () => {
    expect(emptyDraftPurposeMessage({
      purpose: NewsletterIntroPurpose.UPCOMING_EVENTS,
      selectedEventCount: 0
    })).toEqual("No events are selected on the Events step, so there is nothing to write an intro from. Choose events, or widen the dates.");
  });

  it("explains when selected events are not ready for an upcoming intro", () => {
    expect(emptyDraftPurposeMessage({
      purpose: NewsletterIntroPurpose.UPCOMING_EVENTS,
      selectedEventCount: 4
    })).toEqual("None of the selected events have their details filled in yet, so there is nothing to write an intro from. Choose walks that are ready on the Events step.");
  });

  it("explains when no empty slots are selected for a walk-leader request", () => {
    expect(emptyDraftPurposeMessage({
      purpose: NewsletterIntroPurpose.WALK_LEADER_REQUEST,
      selectedEventCount: 3
    })).toEqual("None of the selected dates are empty slots, so there is nothing to ask for leaders for. Widen the dates on the Events step.");
  });

  it("offers a resend when the period starts after the last newsletter", () => {
    expect(emptyDraftPurposeCopy({
      purpose: NewsletterIntroPurpose.UPCOMING_EVENTS,
      selectedEventCount: 0,
      carryingOnFromLastNewsletter: true
    })).toEqual({
      before: "No events are selected because this period starts after the last newsletter.",
      after: " to include those dates, or choose events on the Events step."
    });
    expect(emptyDraftPurposeMessage({
      purpose: NewsletterIntroPurpose.UPCOMING_EVENTS,
      selectedEventCount: 0,
      carryingOnFromLastNewsletter: true
    })).toEqual(`No events are selected because this period starts after the last newsletter. ${RESEND_WITHIN_PERIOD_LABEL} to include those dates, or choose events on the Events step.`);
  });
});
