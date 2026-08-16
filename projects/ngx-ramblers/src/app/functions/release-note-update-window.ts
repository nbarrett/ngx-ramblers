import { DateTime } from "luxon";
import {
  DEFAULT_RELEASE_NOTE_UPDATE_PERIOD_AMOUNT,
  DEFAULT_RELEASE_NOTE_UPDATE_PERIOD_UNIT,
  NewsletterCadence,
  ReleaseNoteUpdateWindow
} from "../models/email-composer.model";
import { DateRangeUnit, RANGE_UNIT_OPTIONS } from "../models/search.model";

export function releaseNoteUpdatePeriodFromStored(stored: {
  periodAmount?: number | null;
  periodUnit?: DateRangeUnit | string | null;
  cadence?: NewsletterCadence | string | null;
} | null): { amount: number; unit: DateRangeUnit } {
  const amount = Number(stored?.periodAmount);
  const safeAmount = amount >= 1 ? amount : DEFAULT_RELEASE_NOTE_UPDATE_PERIOD_AMOUNT;
  const matchedUnit = RANGE_UNIT_OPTIONS.find(option => option.value === stored?.periodUnit);
  if (matchedUnit) {
    return {amount: safeAmount, unit: matchedUnit.value};
  } else if (stored?.cadence === NewsletterCadence.WEEKLY) {
    return {amount: 1, unit: DateRangeUnit.WEEKS};
  } else if (stored?.cadence === NewsletterCadence.MONTHLY) {
    return {amount: 1, unit: DateRangeUnit.MONTHS};
  } else {
    return {amount: DEFAULT_RELEASE_NOTE_UPDATE_PERIOD_AMOUNT, unit: DEFAULT_RELEASE_NOTE_UPDATE_PERIOD_UNIT};
  }
}

export function releaseNoteUpdateWindowFrom(periodAmount: number,
                                         periodUnit: DateRangeUnit,
                                         todayMillis: number): ReleaseNoteUpdateWindow {
  const startOfToday = DateTime.fromMillis(todayMillis).startOf("day");
  const endOfToday = DateTime.fromMillis(todayMillis).endOf("day");
  const safeAmount = periodAmount >= 1 ? periodAmount : DEFAULT_RELEASE_NOTE_UPDATE_PERIOD_AMOUNT;
  return {
    fromMillis: startOfToday.minus({[periodUnit]: safeAmount}).toMillis(),
    toMillis: endOfToday.toMillis(),
    continuesPreviousWindow: false
  };
}
