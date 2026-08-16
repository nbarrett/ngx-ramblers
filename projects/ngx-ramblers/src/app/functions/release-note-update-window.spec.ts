import { DateTime } from "luxon";
import { NewsletterCadence } from "../models/email-composer.model";
import { DateRangeUnit } from "../models/search.model";
import { releaseNoteUpdatePeriodFromStored, releaseNoteUpdateWindowFrom } from "./release-note-update-window";

const today = DateTime.fromISO("2026-08-16T09:30:00");

describe("release-note-update-window", () => {

  describe("releaseNoteUpdatePeriodFromStored", () => {
    it("uses a stored amount and DateRangeUnit", () => {
      expect(releaseNoteUpdatePeriodFromStored({
        periodAmount: 2,
        periodUnit: DateRangeUnit.WEEKS
      })).toEqual({amount: 2, unit: DateRangeUnit.WEEKS});
    });

    it("maps an older weekly cadence", () => {
      expect(releaseNoteUpdatePeriodFromStored({cadence: NewsletterCadence.WEEKLY}))
        .toEqual({amount: 1, unit: DateRangeUnit.WEEKS});
    });

    it("maps an older monthly cadence", () => {
      expect(releaseNoteUpdatePeriodFromStored({cadence: NewsletterCadence.MONTHLY}))
        .toEqual({amount: 1, unit: DateRangeUnit.MONTHS});
    });

    it("defaults to one month", () => {
      expect(releaseNoteUpdatePeriodFromStored(null))
        .toEqual({amount: 1, unit: DateRangeUnit.MONTHS});
    });
  });

  describe("releaseNoteUpdateWindowFrom", () => {

    it("looks back one month", () => {
      const window = releaseNoteUpdateWindowFrom(1, DateRangeUnit.MONTHS, today.toMillis());

      expect(window.fromMillis).toBe(today.startOf("day").minus({months: 1}).toMillis());
      expect(window.toMillis).toBe(today.endOf("day").toMillis());
    });

    it("looks back six months when that is the chosen period", () => {
      const window = releaseNoteUpdateWindowFrom(6, DateRangeUnit.MONTHS, today.toMillis());

      expect(window.fromMillis).toBe(today.startOf("day").minus({months: 6}).toMillis());
      expect(window.toMillis).toBe(today.endOf("day").toMillis());
    });

    it("looks back the chosen number of weeks", () => {
      const window = releaseNoteUpdateWindowFrom(2, DateRangeUnit.WEEKS, today.toMillis());

      expect(window.fromMillis).toBe(today.startOf("day").minus({weeks: 2}).toMillis());
    });
  });
});
