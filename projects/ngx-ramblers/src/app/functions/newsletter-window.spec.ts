import { DateTime } from "luxon";
import { GroupEventSummary } from "../models/committee.model";
import { NewsletterCadence, PreviousNewsletter } from "../models/email-composer.model";
import {
  cadenceDays,
  markEventsNewSinceLastNewsletter,
  newEventCount,
  newsletterSubjectFromSelection,
  newsletterWindowFrom
} from "./newsletter-window";

const today = DateTime.fromISO("2026-07-31T09:30:00");

function previousNewsletter(overrides: Partial<PreviousNewsletter>): PreviousNewsletter {
  return {
    id: "previous-id",
    title: "July newsletter",
    sentAt: today.minus({ days: 30 }).toMillis(),
    windowEnd: null,
    announcedEventIds: [],
    selectedListId: 4,
    cadence: null,
    ...overrides
  };
}

function groupEvent(id: string): GroupEventSummary {
  return {
    id,
    slug: id,
    selected: true,
    eventType: null,
    eventDate: today.toMillis(),
    location: "Canterbury",
    postcode: "CT1 1AA",
    title: `Walk ${id}`,
    description: "A walk",
    contactName: "Someone",
    contactEmail: "someone@example.com"
  } as GroupEventSummary;
}

describe("newsletter-window", () => {

  describe("cadenceDays", () => {
    it("resolves a span for each fixed cadence", () => {
      expect(cadenceDays(NewsletterCadence.WEEKLY)).toBe(7);
      expect(cadenceDays(NewsletterCadence.FORTNIGHTLY)).toBe(14);
      expect(cadenceDays(NewsletterCadence.THREE_WEEKS)).toBe(21);
      expect(cadenceDays(NewsletterCadence.MONTHLY)).toBe(30);
      expect(cadenceDays(NewsletterCadence.QUARTERLY)).toBe(91);
      expect(cadenceDays(NewsletterCadence.PROGRAMME)).toBeNull();
    });

    it("has no span for custom dates", () => {
      expect(cadenceDays(NewsletterCadence.CUSTOM)).toBeNull();
    });
  });

  describe("newsletterWindowFrom", () => {

    it("starts today when there is no previous newsletter", () => {
      const window = newsletterWindowFrom(null, NewsletterCadence.MONTHLY, today.toMillis());

      expect(window.fromMillis).toBe(today.startOf("day").toMillis());
      expect(window.toMillis).toBe(today.startOf("day").plus({ days: 30 }).endOf("day").toMillis());
      expect(window.continuesPreviousWindow).toBe(false);
    });

    it("continues from the previous window when it has not yet run out", () => {
      const previousEnd = today.plus({ days: 10 }).startOf("day");
      const window = newsletterWindowFrom(previousNewsletter({ windowEnd: previousEnd.toMillis() }), NewsletterCadence.MONTHLY, today.toMillis());

      expect(window.fromMillis).toBe(previousEnd.toMillis());
      expect(window.toMillis).toBe(previousEnd.plus({ days: 30 }).endOf("day").toMillis());
      expect(window.continuesPreviousWindow).toBe(true);
    });

    it("starts today when the previous window has already run out", () => {
      const window = newsletterWindowFrom(previousNewsletter({ windowEnd: today.minus({ days: 5 }).toMillis() }), NewsletterCadence.MONTHLY, today.toMillis());

      expect(window.fromMillis).toBe(today.startOf("day").toMillis());
      expect(window.continuesPreviousWindow).toBe(false);
    });

    it("starts today when a previous newsletter exists but recorded no window", () => {
      const window = newsletterWindowFrom(previousNewsletter({ windowEnd: null }), NewsletterCadence.MONTHLY, today.toMillis());

      expect(window.fromMillis).toBe(today.startOf("day").toMillis());
      expect(window.continuesPreviousWindow).toBe(false);
    });

    it("keeps the dates already chosen when the cadence is custom", () => {
      const existing = { fromMillis: 1000, toMillis: 2000, continuesPreviousWindow: false };
      const window = newsletterWindowFrom(previousNewsletter({}), NewsletterCadence.CUSTOM, today.toMillis(), existing);

      expect(window.fromMillis).toBe(1000);
      expect(window.toMillis).toBe(2000);
    });

    it("covers from today to the end of the programme lookahead for all future walks", () => {
      const window = newsletterWindowFrom(null, NewsletterCadence.PROGRAMME, today.toMillis());
      expect(window.continuesPreviousWindow).toBe(false);
      expect(DateTime.fromMillis(window.fromMillis).toISODate()).toBe("2026-07-31");
      expect(DateTime.fromMillis(window.toMillis).year).toBe(2029);
    });

    it("falls back to a month of dates when custom is chosen with nothing set yet", () => {
      const window = newsletterWindowFrom(null, NewsletterCadence.CUSTOM, today.toMillis());

      expect(window.fromMillis).toBe(today.startOf("day").toMillis());
      expect(window.toMillis).toBe(today.startOf("day").plus({ days: 30 }).endOf("day").toMillis());
    });

    it("keeps a full cadence span when the start is pushed forward", () => {
      const previousEnd = today.plus({ days: 3 }).startOf("day");
      const window = newsletterWindowFrom(previousNewsletter({ windowEnd: previousEnd.toMillis() }), NewsletterCadence.WEEKLY, today.toMillis());

      expect(window.toMillis).toBe(previousEnd.plus({ days: 7 }).endOf("day").toMillis());
    });
  });

  describe("markEventsNewSinceLastNewsletter", () => {

    it("marks nothing as new when there was no previous newsletter", () => {
      const events = markEventsNewSinceLastNewsletter([groupEvent("a"), groupEvent("b")], null);

      expect(events.map(event => event.newSinceLastNewsletter)).toEqual([false, false]);
    });

    it("marks only events the previous newsletter did not announce", () => {
      const events = markEventsNewSinceLastNewsletter([groupEvent("a"), groupEvent("b"), groupEvent("c")], ["a", "c"]);

      expect(events.map(event => event.newSinceLastNewsletter)).toEqual([false, true, false]);
    });

    it("marks everything as new when the previous newsletter announced nothing", () => {
      const events = markEventsNewSinceLastNewsletter([groupEvent("a"), groupEvent("b")], []);

      expect(events.map(event => event.newSinceLastNewsletter)).toEqual([true, true]);
    });

    it("leaves the source events untouched", () => {
      const source = [groupEvent("a")];
      markEventsNewSinceLastNewsletter(source, []);

      expect(source[0].newSinceLastNewsletter).toBeUndefined();
    });

    it("copes with no events at all", () => {
      expect(markEventsNewSinceLastNewsletter([], ["a"])).toEqual([]);
    });
  });

  describe("newEventCount", () => {
    it("counts only the events marked as new", () => {
      expect(newEventCount(markEventsNewSinceLastNewsletter([groupEvent("a"), groupEvent("b"), groupEvent("c")], ["a"]))).toBe(2);
    });

    it("counts nothing when there are no events", () => {
      expect(newEventCount([])).toBe(0);
    });
  });

  describe("newsletterSubjectFromSelection", () => {
    it("names walks and socials for the chosen period", () => {
      expect(newsletterSubjectFromSelection(true, true, NewsletterCadence.FORTNIGHTLY, "7 October to 21 October 2026"))
        .toEqual("Walks and socials for the next fortnight");
      expect(newsletterSubjectFromSelection(true, true, NewsletterCadence.THREE_WEEKS, "7 October to 28 October 2026"))
        .toEqual("Walks and socials for the next three weeks");
    });

    it("names walks only when there are no socials", () => {
      expect(newsletterSubjectFromSelection(true, false, NewsletterCadence.MONTHLY, undefined))
        .toEqual("Walks for the next month");
    });

    it("uses the date range when the period is custom", () => {
      expect(newsletterSubjectFromSelection(true, false, NewsletterCadence.CUSTOM, "1 August to 31 August 2026"))
        .toEqual("Walks, 1 August to 31 August 2026");
    });

    it("falls back when nothing is selected yet", () => {
      expect(newsletterSubjectFromSelection(false, false, NewsletterCadence.WEEKLY, undefined))
        .toEqual("What's coming up for the next week");
    });
  });
});
