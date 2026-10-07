import { isNumber } from "es-toolkit/compat";
import {
  DEFAULT_NEWSLETTER_INTRO_PURPOSE,
  NewsletterIntroEvent,
  NewsletterIntroPurpose,
  WalkTimeOfDay
} from "../models/ai.model";

export function walkTimeOfDayFromHour(hour: number | null | undefined): WalkTimeOfDay | null {
  return !isNumber(hour) ? null
    : hour < 12 ? WalkTimeOfDay.MORNING
    : hour < 17 ? WalkTimeOfDay.AFTERNOON
    : WalkTimeOfDay.EVENING;
}

export function introPurposeFrom(drafting: {introPurpose?: NewsletterIntroPurpose} | null | undefined): NewsletterIntroPurpose {
  return drafting?.introPurpose === NewsletterIntroPurpose.WALK_LEADER_REQUEST
    ? NewsletterIntroPurpose.WALK_LEADER_REQUEST
    : DEFAULT_NEWSLETTER_INTRO_PURPOSE;
}

export function eventsForPurpose(events: NewsletterIntroEvent[], purpose: NewsletterIntroPurpose | undefined): NewsletterIntroEvent[] {
  return (events ?? []).filter(event => purpose === NewsletterIntroPurpose.WALK_LEADER_REQUEST
    ? !!event.awaitingDetails
    : !event.awaitingDetails);
}

export function eventsMatchingDraftPurpose(
  events: NewsletterIntroEvent[],
  purpose: NewsletterIntroPurpose | undefined,
  onlyApprovedWalks: boolean
): NewsletterIntroEvent[] {
  return purpose === NewsletterIntroPurpose.WALK_LEADER_REQUEST
    ? eventsForPurpose(events, purpose)
    : onlyApprovedWalks
      ? (events ?? []).filter(event => event.approvedForMembers ?? !event.awaitingDetails)
      : (events ?? []);
}
