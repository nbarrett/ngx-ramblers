import expect from "expect";
import { describe, it } from "mocha";
import { NewsletterIntroEvent, NewsletterIntroPurpose } from "../../../projects/ngx-ramblers/src/app/models/ai.model";
import {
  buildNewsletterIntroInput,
  describeEvent,
  eventsByType,
  eventsForPurpose,
  MAX_EVENTS_IN_PROMPT,
  NEWSLETTER_INTRO_SYSTEM_PROMPT,
  systemPromptFor,
  truncateDescription,
  WALK_LEADER_REQUEST_SYSTEM_PROMPT
} from "./newsletter-intro";

function walk(overrides: Partial<NewsletterIntroEvent> = {}): NewsletterIntroEvent {
  return {
    title: "Chilham circular",
    eventType: "Walk",
    dateDescription: "Sat 2 Aug",
    distance: "8 miles",
    location: "Chilham",
    ...overrides
  };
}

describe("newsletter-intro", () => {

  describe("truncateDescription", () => {
    it("returns null for nothing usable", () => {
      expect(truncateDescription(undefined)).toEqual(null);
      expect(truncateDescription("   ")).toEqual(null);
    });

    it("collapses whitespace", () => {
      expect(truncateDescription("a  long\n\nway   round")).toEqual("a long way round");
    });

    it("leaves a short description alone", () => {
      expect(truncateDescription("A gentle stroll", 50)).toEqual("A gentle stroll");
    });

    it("truncates a long description", () => {
      const truncated = truncateDescription("x".repeat(300), 10);
      expect(truncated).toEqual(`${"x".repeat(10)}…`);
    });
  });

  describe("describeEvent", () => {
    it("puts the facts on one line", () => {
      expect(describeEvent(walk())).toEqual("- Sat 2 Aug, Chilham circular, 8 miles, from Chilham");
    });

    it("omits absent fields rather than leaving gaps", () => {
      expect(describeEvent(walk({ distance: undefined, location: undefined })))
        .toEqual("- Sat 2 Aug, Chilham circular");
    });

    it("flags an event that is new since the last newsletter", () => {
      expect(describeEvent(walk({ newSinceLastNewsletter: true })))
        .toContain("(new since the last newsletter)");
    });

    it("appends a description when there is one", () => {
      expect(describeEvent(walk({ description: "Through the orchards" })))
        .toEqual("- Sat 2 Aug, Chilham circular, 8 miles, from Chilham. Through the orchards");
    });
  });

  describe("eventsByType", () => {
    it("groups by event type in first-seen order", () => {
      const grouped = eventsByType([
        walk({ eventType: "Walk", title: "One" }),
        walk({ eventType: "Social Event", title: "Two" }),
        walk({ eventType: "Walk", title: "Three" })
      ]);
      expect(Array.from(grouped.keys())).toEqual(["Walk", "Social Event"]);
      expect(grouped.get("Walk").map(event => event.title)).toEqual(["One", "Three"]);
    });

    it("falls back to a generic type when one is missing", () => {
      expect(Array.from(eventsByType([walk({ eventType: "" })]).keys())).toEqual(["Events"]);
    });
  });

  describe("systemPromptFor", () => {
    it("asks for an appeal when the purpose is a walk leader request", () => {
      expect(systemPromptFor(NewsletterIntroPurpose.WALK_LEADER_REQUEST)).toEqual(WALK_LEADER_REQUEST_SYSTEM_PROMPT);
    });

    it("asks for an overview for upcoming events", () => {
      expect(systemPromptFor(NewsletterIntroPurpose.UPCOMING_EVENTS)).toEqual(NEWSLETTER_INTRO_SYSTEM_PROMPT);
    });

    it("falls back to the overview when no purpose is given", () => {
      expect(systemPromptFor(undefined)).toEqual(NEWSLETTER_INTRO_SYSTEM_PROMPT);
    });
  });

  describe("eventsForPurpose", () => {
    const complete = walk({title: "Chilham circular"});
    const emptySlot = walk({title: "Untitled walk slot", awaitingDetails: true, distance: undefined});

    it("keeps only complete events for upcoming events", () => {
      expect(eventsForPurpose([complete, emptySlot], NewsletterIntroPurpose.UPCOMING_EVENTS)).toEqual([complete]);
    });

    it("keeps only the empty slots for a walk leader request", () => {
      expect(eventsForPurpose([complete, emptySlot], NewsletterIntroPurpose.WALK_LEADER_REQUEST)).toEqual([emptySlot]);
    });

    it("treats an unspecified purpose as upcoming events", () => {
      expect(eventsForPurpose([complete, emptySlot], undefined)).toEqual([complete]);
    });

    it("copes with no events", () => {
      expect(eventsForPurpose([], NewsletterIntroPurpose.WALK_LEADER_REQUEST)).toEqual([]);
    });
  });

  describe("buildNewsletterIntroInput", () => {

    it("excludes events awaiting details from an upcoming events summary", () => {
      const input = buildNewsletterIntroInput({
        events: [walk(), walk({title: "Untitled walk slot", awaitingDetails: true})],
        purpose: NewsletterIntroPurpose.UPCOMING_EVENTS
      });

      expect(input).toContain("Total events: 1");
      expect(input).not.toContain("Untitled walk slot");
    });

    it("lists only the empty slots for a walk leader request, and counts them as such", () => {
      const input = buildNewsletterIntroInput({
        events: [walk(), walk({title: "Untitled walk slot", awaitingDetails: true, dateDescription: "Sun 24 Aug"})],
        purpose: NewsletterIntroPurpose.WALK_LEADER_REQUEST
      });

      expect(input).toContain("Empty slots still needing a leader: 1");
      expect(input).toContain("Sun 24 Aug");
      expect(input).not.toContain("Chilham circular");
    });


    it("heads the input with the group, period and totals", () => {
      const input = buildNewsletterIntroInput({
        events: [walk()],
        groupName: "Canterbury Ramblers",
        periodDescription: "1 August to 31 August 2026"
      });

      expect(input).toContain("Group: Canterbury Ramblers");
      expect(input).toContain("Period covered: 1 August to 31 August 2026");
      expect(input).toContain("Total events: 1");
    });

    it("counts what is new since the last newsletter", () => {
      const input = buildNewsletterIntroInput({
        events: [walk({ newSinceLastNewsletter: true }), walk({ title: "Old" })]
      });

      expect(input).toContain("New since the last newsletter: 1");
    });

    it("says nothing about new events when none are new", () => {
      expect(buildNewsletterIntroInput({ events: [walk()] })).not.toContain("New since the last newsletter");
    });

    it("groups the listing under a heading per event type with counts", () => {
      const input = buildNewsletterIntroInput({
        events: [walk(), walk({ eventType: "Social Event", title: "Christmas meal" })]
      });

      expect(input).toContain("Walk (1):");
      expect(input).toContain("Social Event (1):");
      expect(input).toContain("Christmas meal");
    });

    it("caps the events sent and says that it has done so", () => {
      const events = Array.from({ length: MAX_EVENTS_IN_PROMPT + 5 }, (_value, index) => walk({ title: `Walk ${index}` }));
      const input = buildNewsletterIntroInput({ events });

      expect(input).toContain(`Total events: ${MAX_EVENTS_IN_PROMPT + 5}`);
      expect(input).toContain(`Only the first ${MAX_EVENTS_IN_PROMPT} are listed below.`);
      expect(input).not.toContain(`Walk ${MAX_EVENTS_IN_PROMPT + 1}`);
    });

    it("still produces a total when there are no events", () => {
      expect(buildNewsletterIntroInput({ events: [] })).toEqual("Total events: 0");
    });
  });
});
