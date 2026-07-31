import { DateTime } from "luxon";
import { GroupEventSummary } from "../models/committee.model";
import {
  NEWSLETTER_CADENCE_OPTIONS,
  NewsletterCadence,
  NewsletterWindow,
  PreviousNewsletter
} from "../models/email-composer.model";

const FALLBACK_CUSTOM_WINDOW_DAYS = 30;

export function cadenceDays(cadence: NewsletterCadence): number | null {
  return NEWSLETTER_CADENCE_OPTIONS.find(option => option.key === cadence)?.days ?? null;
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
  return days === null ? {
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
