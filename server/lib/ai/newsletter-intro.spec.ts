import expect from "expect";
import { describe, it } from "mocha";
import { NewsletterIntroDetail, NewsletterIntroEvent, NewsletterIntroPurpose, WalkTimeOfDay } from "../../../projects/ngx-ramblers/src/app/models/ai.model";
import {
  buildNewsletterIntroInput,
  collapsedDescription,
  closingDetailsPhrase,
  describeEvent,
  describeListedChange,
  eventNamedForLeader,
  eventsByType,
  eventsForPurpose,
  introShouldNameEachWalk,
  introStyleLine,
  leaderFirstName,
  MAX_EVENTS_IN_PROMPT,
  milesOnlyDistance,
  NEWSLETTER_INTRO_SYSTEM_PROMPT,
  periodSpanDays,
  socialEventsSummary,
  systemPromptFor,
  WALK_LEADER_REQUEST_SYSTEM_PROMPT,
  walkPatternSummary
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

  describe("collapsedDescription", () => {
    it("returns null for nothing usable", () => {
      expect(collapsedDescription(undefined)).toEqual(null);
      expect(collapsedDescription("   ")).toEqual(null);
    });

    it("collapses whitespace", () => {
      expect(collapsedDescription("a  long\n\nway   round")).toEqual("a long way round");
    });

    it("leaves a description in full", () => {
      const description = "We will travel on the first train to Paddington and then on the next available train to Farringdon.";
      expect(collapsedDescription(description)).toEqual(description);
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

    it("keeps a long walk description in full", () => {
      const description = "Meet by the escalators to platforms 10/11 on the footbridge in Reading station at 9:15 with a travel card ticket or equivalent. We will travel on the first train to Paddington and then on the next available train to Farringdon.";
      expect(describeEvent(walk({ description }))).toContain(description);
      expect(describeEvent(walk({ description }))).not.toContain("…");
    });

    it("appends listed field changes", () => {
      expect(describeEvent(walk({
        changes: [{field: "groupEvent.distance_miles", label: "Distance in miles", from: "7", to: "8"}]
      }))).toContain("Changes: Distance in miles: 7 to 8");
    });

    it("names the walk as the leader's when a first name is listed", () => {
      expect(describeEvent(walk({leaderName: "Alex Reed"})))
        .toEqual("- Sat 2 Aug, Alex's Chilham circular, 8 miles, from Chilham");
    });

    it("includes morning or evening when that is listed", () => {
      expect(describeEvent(walk({timeOfDay: WalkTimeOfDay.EVENING})))
        .toEqual("- Sat 2 Aug, evening, Chilham circular, 8 miles, from Chilham");
    });

    it("keeps miles and drops kilometres from the distance", () => {
      expect(describeEvent(walk({distance: "10 miles / 16.09 km"})))
        .toEqual("- Sat 2 Aug, Chilham circular, 10 miles, from Chilham");
    });

    it("says finish times without repeating the date when only the time changed", () => {
      expect(describeEvent(walk({
        changes: [{
          field: "groupEvent.end_date_time",
          label: "End date & time",
          from: "Sunday, 11 October 2026, 2:30:00 pm",
          to: "Sunday, 11 October 2026, 2:45:00 pm"
        }]
      }))).toContain("Changes: Finish time: 2:30 pm to 2:45 pm");
    });

    it("drops kilometre distance changes", () => {
      expect(describeEvent(walk({
        changes: [
          {field: "groupEvent.distance_miles", label: "Distance in miles", from: "9.5", to: "10"},
          {field: "groupEvent.distance_km", label: "Distance in kilometres", from: "15.29", to: "16.09"}
        ]
      }))).toEqual("- Sat 2 Aug, Chilham circular, 8 miles, from Chilham. Changes: Distance in miles: 9.5 to 10");
    });
  });

  describe("milesOnlyDistance", () => {
    it("strips the kilometre half of a dual distance", () => {
      expect(milesOnlyDistance("9.5 miles / 15.29 km")).toEqual("9.5 miles");
    });
  });

  describe("describeListedChange", () => {
    it("keeps the dates when the day itself changed", () => {
      expect(describeListedChange({
        field: "groupEvent.end_date_time",
        label: "End date & time",
        from: "Sunday, 11 October 2026, 2:30:00 pm",
        to: "Monday, 12 October 2026, 2:30:00 pm"
      })).toEqual("End date & time: Sunday, 11 October 2026 at 2:30 pm to Monday, 12 October 2026 at 2:30 pm");
    });
  });

  describe("periodSpanDays", () => {
    it("counts inclusive days from a display-date range", () => {
      expect(periodSpanDays("Tuesday, 6 October 2026 to Monday, 12 October 2026")).toEqual(7);
      expect(periodSpanDays("6 October 2026 to 12 October 2026")).toEqual(7);
    });

    it("is empty when the period is not two dates", () => {
      expect(periodSpanDays("this week")).toEqual(null);
      expect(periodSpanDays(undefined)).toEqual(null);
    });
  });

  describe("introShouldNameEachWalk", () => {
    it("names each walk for a one-week range", () => {
      expect(introShouldNameEachWalk(
        Array.from({length: 10}, (_value, index) => walk({title: `Walk ${index}`})),
        "Tuesday, 6 October 2026 to Monday, 12 October 2026"
      )).toEqual(true);
    });

    it("names each walk when there are only a handful, even over a longer period", () => {
      expect(introShouldNameEachWalk([walk(), walk({title: "Two"})], "1 August to 31 August 2026")).toEqual(true);
    });

    it("summarises the pattern when a longer programme has many walks", () => {
      expect(introShouldNameEachWalk(
        Array.from({length: 10}, (_value, index) => walk({title: `Walk ${index}`})),
        "Saturday, 1 August 2026 to Monday, 31 August 2026"
      )).toEqual(false);
    });

    it("never names each walk when less detail is asked for", () => {
      expect(introShouldNameEachWalk(
        [walk(), walk({title: "Two"})],
        "Tuesday, 6 October 2026 to Monday, 12 October 2026",
        NewsletterIntroDetail.LESS
      )).toEqual(false);
    });

    it("names each walk when more detail is asked for, even on a longer programme", () => {
      expect(introShouldNameEachWalk(
        Array.from({length: 10}, (_value, index) => walk({title: `Walk ${index}`})),
        "Saturday, 1 August 2026 to Monday, 31 August 2026",
        NewsletterIntroDetail.MORE
      )).toEqual(true);
    });
  });

  describe("walkPatternSummary", () => {
    it("collapses walks that share a weekday and time of day", () => {
      expect(walkPatternSummary([
        walk({weekday: "Sunday", timeOfDay: WalkTimeOfDay.MORNING, title: "One"}),
        walk({weekday: "Sunday", timeOfDay: WalkTimeOfDay.MORNING, title: "Two"}),
        walk({weekday: "Wednesday", timeOfDay: WalkTimeOfDay.EVENING, title: "Three"})
      ])).toEqual("Sunday morning walks; Wednesday evening walks");
    });

    it("is empty when there are no walks", () => {
      expect(walkPatternSummary([walk({eventType: "Social Event"})])).toEqual(null);
    });
  });

  describe("socialEventsSummary", () => {
    it("names each social with its date", () => {
      expect(socialEventsSummary([
        walk(),
        walk({eventType: "Social Event", title: "Christmas meal", dateDescription: "Fri 12 Dec"})
      ])).toEqual("Christmas meal on Fri 12 Dec");
    });
  });

  describe("leaderFirstName", () => {
    it("takes the first word of a full name", () => {
      expect(leaderFirstName("Alex Reed")).toEqual("Alex");
    });

    it("skips a single-letter Walks Manager initial", () => {
      expect(leaderFirstName("A Reed")).toEqual(null);
    });
  });

  describe("eventNamedForLeader", () => {
    it("prefixes the title with the leader's first name", () => {
      expect(eventNamedForLeader(walk({leaderName: "Alex Reed"}))).toEqual("Alex's Chilham circular");
    });

    it("leaves the title alone when there is no leader name", () => {
      expect(eventNamedForLeader(walk())).toEqual("Chilham circular");
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

  describe("closingDetailsPhrase", () => {
    it("names a single walk in the singular", () => {
      expect(closingDetailsPhrase([walk()])).toEqual("the walk");
    });

    it("names several walks in the plural", () => {
      expect(closingDetailsPhrase([walk(), walk({title: "Chartham"})])).toEqual("the walks");
    });

    it("names a single social event in the singular", () => {
      expect(closingDetailsPhrase([walk({eventType: "Social Event"})])).toEqual("the social event");
    });

    it("names several social events in the plural", () => {
      expect(closingDetailsPhrase([
        walk({eventType: "Social Event", title: "Meal"}),
        walk({eventType: "Social Event", title: "Quiz"})
      ])).toEqual("the social events");
    });

    it("names both when walks and social events are listed", () => {
      expect(closingDetailsPhrase([walk(), walk({eventType: "Social Event", title: "Meal"})]))
        .toEqual("the walk and the social event");
    });

    it("pluralises each type from its own count", () => {
      expect(closingDetailsPhrase([
        walk(),
        walk({title: "Chartham"}),
        walk({eventType: "Social Event", title: "Meal"})
      ])).toEqual("the walks and the social event");
    });

    it("is empty when there are no events", () => {
      expect(closingDetailsPhrase([])).toEqual(null);
    });
  });

  describe("systemPromptFor", () => {
    it("asks for an appeal when the purpose is a walk leader request", () => {
      expect(systemPromptFor(NewsletterIntroPurpose.WALK_LEADER_REQUEST)).toEqual(WALK_LEADER_REQUEST_SYSTEM_PROMPT);
    });

    it("asks for an overview for upcoming events", () => {
      expect(systemPromptFor(NewsletterIntroPurpose.UPCOMING_EVENTS)).toEqual(NEWSLETTER_INTRO_SYSTEM_PROMPT);
      expect(NEWSLETTER_INTRO_SYSTEM_PROMPT).toContain("Follow the Style line in the source");
      expect(NEWSLETTER_INTRO_SYSTEM_PROMPT).toContain("Closing sentence supplied in the source");
      expect(NEWSLETTER_INTRO_SYSTEM_PROMPT).toContain("Mention every listed change for a walk");
      expect(NEWSLETTER_INTRO_SYSTEM_PROMPT).toContain("Give distances in miles only");
      expect(NEWSLETTER_INTRO_SYSTEM_PROMPT).toContain("say the times only");
      expect(NEWSLETTER_INTRO_SYSTEM_PROMPT).toContain("Open with a light, human line");
      expect(NEWSLETTER_INTRO_SYSTEM_PROMPT).toContain("do not call the walks enjoyable");
      expect(NEWSLETTER_INTRO_SYSTEM_PROMPT).toContain("do not add that the walks are spread across the week, the fortnight or the month");
      expect(NEWSLETTER_INTRO_SYSTEM_PROMPT).toContain("name every walk with its day");
      expect(NEWSLETTER_INTRO_SYSTEM_PROMPT).toContain("Do not collapse a handful of walks into a weekday pattern");
      expect(NEWSLETTER_INTRO_SYSTEM_PROMPT).toContain("Always say the old value and the new value");
      expect(NEWSLETTER_INTRO_SYSTEM_PROMPT).toContain("Do not open with how many events there are");
      expect(NEWSLETTER_INTRO_SYSTEM_PROMPT).toContain("no Hello, Hi everyone, or Dear members");
      expect(NEWSLETTER_INTRO_SYSTEM_PROMPT).toContain("Never cut a word or sentence short, and never use an ellipsis");
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

    it("keeps the whole programme for upcoming events and notes which walks have changed", () => {
      const input = buildNewsletterIntroInput({
        events: [
          walk(),
          walk({
            title: "Chartham and the Stour",
            changes: [{field: "groupEvent.start_location", label: "Starting location", from: "Fordwich", to: "Chartham"}]
          })
        ],
        purpose: NewsletterIntroPurpose.UPCOMING_EVENTS
      });

      expect(input).toContain("Total events: 2");
      expect(input).toContain("Walks with recent changes: 1");
      expect(input).toContain("Chilham circular");
      expect(input).toContain("Chartham and the Stour");
      expect(input).toContain("Starting location: Fordwich to Chartham");
    });


    it("heads the input with the group, period and totals", () => {
      const input = buildNewsletterIntroInput({
        events: [walk()],
        groupName: "Hillside Park Ramblers",
        periodDescription: "1 August to 31 August 2026"
      });

      expect(input).toContain("Group: Hillside Park Ramblers");
      expect(input).toContain("Period covered: 1 August to 31 August 2026");
      expect(input).toContain("Total events: 1");
      expect(input).toContain("Closing sentence: See below for full details of the walk.");
    });

    it("asks a short period to name each walk rather than a weekday pattern", () => {
      const input = buildNewsletterIntroInput({
        events: [
          walk({weekday: "Sunday", timeOfDay: WalkTimeOfDay.MORNING, leaderName: "Alex Reed"}),
          walk({weekday: "Wednesday", timeOfDay: WalkTimeOfDay.EVENING, title: "Midweek stroll"})
        ],
        periodDescription: "Tuesday, 6 October 2026 to Monday, 12 October 2026"
      });

      expect(input).toContain("Style: a short period. Name each walk with its day");
      expect(input).not.toContain("Walk pattern:");
      expect(input).toContain("Alex's Chilham circular");
    });

    it("heads a longer programme with the walk pattern and named socials", () => {
      const walks = Array.from({length: 8}, (_value, index) => walk({
        title: `Walk ${index}`,
        weekday: "Sunday",
        timeOfDay: WalkTimeOfDay.MORNING
      }));
      const input = buildNewsletterIntroInput({
        events: [
          ...walks,
          walk({
            eventType: "Social Event",
            title: "Christmas meal",
            dateDescription: "Fri 12 Dec"
          })
        ],
        periodDescription: "Saturday, 1 August 2026 to Monday, 31 August 2026"
      });

      expect(input).toContain("Walk pattern: Sunday morning walks");
      expect(input).toContain("Social events: Christmas meal on Fri 12 Dec");
      expect(input).not.toContain("Style: a short period");
      expect(input).toContain("Style: set the scene in two or three sentences");
    });

    it("asks for a short overview when less detail is selected", () => {
      const input = buildNewsletterIntroInput({
        events: Array.from({length: 8}, (_value, index) => walk({title: `Walk ${index}`})),
        periodDescription: "Tuesday, 6 October 2026 to Monday, 12 October 2026",
        detail: NewsletterIntroDetail.LESS
      });

      expect(input).toContain("Style: less detail");
      expect(input).not.toContain("Style: a short period");
      expect(introStyleLine(NewsletterIntroPurpose.UPCOMING_EVENTS, false, NewsletterIntroDetail.LESS)).toContain("Two sentences at most");
    });

    it("asks to name each walk when more detail is selected", () => {
      const input = buildNewsletterIntroInput({
        events: Array.from({length: 8}, (_value, index) => walk({
          title: `Walk ${index}`,
          weekday: "Sunday",
          timeOfDay: WalkTimeOfDay.MORNING
        })),
        periodDescription: "Saturday, 1 August 2026 to Monday, 31 August 2026",
        detail: NewsletterIntroDetail.MORE
      });

      expect(input).toContain("Style: more detail");
      expect(input).not.toContain("Walk pattern:");
    });

    it("asks the intro to close with walks and social events when both are included", () => {
      const input = buildNewsletterIntroInput({
        events: [walk(), walk({eventType: "Social Event", title: "Christmas meal"})]
      });

      expect(input).toContain("Closing sentence: See below for full details of the walk and the social event.");
    });

    it("does not ask a walk leader request to close with programme details", () => {
      const input = buildNewsletterIntroInput({
        events: [walk({awaitingDetails: true})],
        purpose: NewsletterIntroPurpose.WALK_LEADER_REQUEST
      });

      expect(input).not.toContain("See below for full details");
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
