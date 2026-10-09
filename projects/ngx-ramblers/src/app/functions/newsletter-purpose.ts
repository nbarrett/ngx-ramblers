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

export const RESEND_WITHIN_PERIOD_LABEL = "Resend within this time period";

export function emptyDraftPurposeCopy(options: {
  purpose: NewsletterIntroPurpose;
  selectedEventCount: number;
  carryingOnFromLastNewsletter?: boolean;
}): {before: string; after: string | null} {
  if (options.carryingOnFromLastNewsletter) {
    if (options.purpose === NewsletterIntroPurpose.WALK_LEADER_REQUEST) {
      return options.selectedEventCount === 0
        ? {
          before: "No dates are selected because this period starts after the last newsletter.",
          after: " to include those dates, or choose empty slots on the Events step."
        }
        : {
          before: "None of the selected dates are empty slots, so there is nothing to ask for leaders for.",
          after: " to include dates already covered, or widen the dates on the Events step."
        };
    } else {
      return options.selectedEventCount === 0
        ? {
          before: "No events are selected because this period starts after the last newsletter.",
          after: " to include those dates, or choose events on the Events step."
        }
        : {
          before: "None of the selected events have their details filled in yet, so there is nothing to write an intro from.",
          after: " to include dates already covered, or choose walks that are ready on the Events step."
        };
    }
  } else if (options.purpose === NewsletterIntroPurpose.WALK_LEADER_REQUEST) {
    return {
      before: options.selectedEventCount === 0
        ? "No dates are selected on the Events step, so there is nothing to ask for leaders for. Widen the dates, or choose empty slots."
        : "None of the selected dates are empty slots, so there is nothing to ask for leaders for. Widen the dates on the Events step.",
      after: null
    };
  } else {
    return {
      before: options.selectedEventCount === 0
        ? "No events are selected on the Events step, so there is nothing to write an intro from. Choose events, or widen the dates."
        : "None of the selected events have their details filled in yet, so there is nothing to write an intro from. Choose walks that are ready on the Events step.",
      after: null
    };
  }
}

export function emptyDraftPurposeMessage(options: {
  purpose: NewsletterIntroPurpose;
  selectedEventCount: number;
  carryingOnFromLastNewsletter?: boolean;
}): string {
  const copy = emptyDraftPurposeCopy(options);
  return copy.after === null ? copy.before : `${copy.before} ${RESEND_WITHIN_PERIOD_LABEL}${copy.after}`;
}
