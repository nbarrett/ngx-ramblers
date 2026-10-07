import { DateTime } from "luxon";
import { GroupEventSummary } from "../models/committee.model";
import {
  NEWSLETTER_CADENCE_OPTIONS,
  NewsletterCadence,
  NewsletterWindow,
  PreviousNewsletter
} from "../models/email-composer.model";

const FALLBACK_CUSTOM_WINDOW_DAYS = 30;

export const PROGRAMME_LOOKAHEAD_YEARS = 3;

export function cadenceDays(cadence: NewsletterCadence): number | null {
  return NEWSLETTER_CADENCE_OPTIONS.find(option => option.key === cadence)?.days ?? null;
}

export function openEndedCadence(cadence: NewsletterCadence | null | undefined): boolean {
  return cadence === NewsletterCadence.PROGRAMME;
}

export function newsletterProgrammeLabel(hasWalks: boolean, hasSocials: boolean): string {
  return hasWalks && hasSocials ? "Walks and socials" : hasWalks ? "Walks" : hasSocials ? "Social events" : "What's coming up";
}

export function newsletterPeriodPhrase(cadence: NewsletterCadence | null | undefined, dateRange: string | undefined): string | null {
  const option = NEWSLETTER_CADENCE_OPTIONS.find(item => item.key === cadence);
  return option && option.days !== null ? option.periodLabel : (dateRange ?? null);
}

export function newsletterSubjectFromSelection(hasWalks: boolean, hasSocials: boolean, cadence: NewsletterCadence | null | undefined, dateRange: string | undefined): string {
  const programme = newsletterProgrammeLabel(hasWalks, hasSocials);
  const period = newsletterPeriodPhrase(cadence, dateRange);
  return period && period.startsWith("the ") ? `${programme} for ${period}` : period ? `${programme}, ${period}` : programme;
}

export function newsletterWindowFrom(previous: PreviousNewsletter | null,
                                     cadence: NewsletterCadence,
                                     todayMillis: number,
                                     existingWindow?: NewsletterWindow | null): NewsletterWindow {
  const startOfToday = DateTime.fromMillis(todayMillis).startOf("day");
  const days = cadenceDays(cadence);
  const previousEnd = previous?.windowEnd ? DateTime.fromMillis(previous.windowEnd).startOf("day") : null;
  const continuesPreviousWindow = days !== null && !!previousEnd && previousEnd > startOfToday;
  const from = continuesPreviousWindow ? previousEnd : startOfToday;
  return openEndedCadence(cadence) ? {
    fromMillis: startOfToday.toMillis(),
    toMillis: startOfToday.plus({years: PROGRAMME_LOOKAHEAD_YEARS}).endOf("year").toMillis(),
    continuesPreviousWindow: false
  } : days === null ? {
    fromMillis: existingWindow?.fromMillis ?? startOfToday.toMillis(),
    toMillis: existingWindow?.toMillis ?? startOfToday.plus({ days: FALLBACK_CUSTOM_WINDOW_DAYS }).endOf("day").toMillis(),
    continuesPreviousWindow: false
  } : {
    fromMillis: from.toMillis(),
    toMillis: from.plus({ days }).endOf("day").toMillis(),
    continuesPreviousWindow
  };
}

export function markEventsNewSinceLastNewsletter(events: GroupEventSummary[],
                                                 previouslyAnnouncedEventIds: string[] | null): GroupEventSummary[] {
  const announced = previouslyAnnouncedEventIds ? new Set(previouslyAnnouncedEventIds) : null;
  return (events ?? []).map(event => ({
    ...event,
    newSinceLastNewsletter: !!announced && !!event.id && !announced.has(event.id)
  }));
}

export function newEventCount(events: GroupEventSummary[]): number {
  return (events ?? []).filter(event => event.newSinceLastNewsletter).length;
}
