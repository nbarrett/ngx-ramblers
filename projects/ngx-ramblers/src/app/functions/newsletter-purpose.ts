import { NewsletterIntroEvent, NewsletterIntroPurpose } from "../models/ai.model";

export function eventsForPurpose(events: NewsletterIntroEvent[], purpose: NewsletterIntroPurpose | undefined): NewsletterIntroEvent[] {
  return (events ?? []).filter(event => purpose === NewsletterIntroPurpose.WALK_LEADER_REQUEST
    ? !!event.awaitingDetails
    : !event.awaitingDetails);
}
