import {
  DEFAULT_NEWSLETTER_INTRO_PURPOSE,
  NewsletterIntroEvent,
  NewsletterIntroPurpose,
  NewsletterIntroRequest
} from "../../../projects/ngx-ramblers/src/app/models/ai.model";
import { eventsForPurpose } from "../../../projects/ngx-ramblers/src/app/functions/newsletter-purpose";

export { eventsForPurpose };

export const NEWSLETTER_INTRO_SYSTEM_PROMPT = [
  "Write a short introduction for a walking group's newsletter, summarising what is coming up.",
  "Write in the first person plural as the group speaking to its members (we, our, us).",
  "Give a high-level overview: roughly how many walks and social events there are, the spread of dates, and the range of distances or the more notable outings.",
  "Do not list the events one by one. Their full details follow immediately underneath, so the introduction only needs to set the scene.",
  "Two or three sentences is usually enough, and never more than four.",
  "Use only the facts supplied. Do not invent walks, places, distances, dates, weather, people or anything else that is not in the source.",
  "If some events are marked as new since the last newsletter, mention in passing that there are new additions, without listing them.",
  "Where the sender has given guidance, follow it for emphasis and tone, but still invent nothing that is not in the source.",
  "Write in British English, in the plain warm prose a volunteer would write.",
  "Do not use em dashes and do not use exclamation marks.",
  "Do not greet the reader and do not sign off, because both are added separately.",
  "Return the introduction only, as plain markdown paragraphs, with no heading and no bullet points."
].join(" ");

export const WALK_LEADER_REQUEST_SYSTEM_PROMPT = [
  "Write a short appeal for a walking group's newsletter, asking members to lead the walks that have nobody down for them yet.",
  "Write in the first person plural as the group speaking to its members (we, our, us).",
  "Open with a sentence or two explaining that these dates have no leader yet and that the programme depends on members offering to lead.",
  "Then list the empty dates briefly, one per line as a markdown bullet, giving the date and anything else supplied about the slot.",
  "Keep the list plain and short. Do not pad each line with encouragement.",
  "Use only the facts supplied. Do not invent dates, places, distances, people or walks that are not in the source.",
  "Do not imply a walk already has a route, a distance or a leader when the source does not say so.",
  "Close with one short sentence on how to offer, without inventing a contact name, an email address or a deadline.",
  "Where the sender has given guidance, follow it for emphasis and tone, but still invent nothing that is not in the source.",
  "Write in British English, in the plain warm prose a volunteer would write.",
  "Do not use em dashes and do not use exclamation marks.",
  "Do not greet the reader and do not sign off, because both are added separately.",
  "Return the appeal only, as markdown, with no heading."
].join(" ");

export function systemPromptFor(purpose: NewsletterIntroPurpose | undefined): string {
  return purpose === NewsletterIntroPurpose.WALK_LEADER_REQUEST
    ? WALK_LEADER_REQUEST_SYSTEM_PROMPT
    : NEWSLETTER_INTRO_SYSTEM_PROMPT;
}

export const MAX_EVENTS_IN_PROMPT = 60;
export const MAX_DESCRIPTION_CHARS = 200;
export const MAX_GUIDANCE_CHARS = 500;

export function truncateDescription(description: string | undefined, maxChars: number = MAX_DESCRIPTION_CHARS): string | null {
  const trimmed = (description ?? "").replace(/\s+/g, " ").trim();
  const truncated = trimmed.length <= maxChars ? trimmed : `${trimmed.slice(0, maxChars).trimEnd()}…`;
  return trimmed ? truncated : null;
}

export function describeEvent(event: NewsletterIntroEvent): string {
  const parts = [
    event.dateDescription,
    event.title,
    event.distance,
    event.location ? `from ${event.location}` : null,
    event.newSinceLastNewsletter ? "(new since the last newsletter)" : null
  ].filter(Boolean);
  const description = truncateDescription(event.description);
  return description ? `- ${parts.join(", ")}. ${description}` : `- ${parts.join(", ")}`;
}

export function eventsByType(events: NewsletterIntroEvent[]): Map<string, NewsletterIntroEvent[]> {
  return (events ?? []).reduce((byType, event) => {
    const key = event.eventType || "Events";
    return byType.set(key, [...(byType.get(key) ?? []), event]);
  }, new Map<string, NewsletterIntroEvent[]>());
}

export function buildNewsletterIntroInput(request: NewsletterIntroRequest): string {
  const purpose = request?.purpose ?? DEFAULT_NEWSLETTER_INTRO_PURPOSE;
  const allEvents = eventsForPurpose(request?.events, purpose);
  const events = allEvents.slice(0, MAX_EVENTS_IN_PROMPT);
  const newCount = events.filter(event => event.newSinceLastNewsletter).length;
  const guidance = truncateDescription(request?.guidance, MAX_GUIDANCE_CHARS);
  const heading = [
    request?.groupName ? `Group: ${request.groupName}` : null,
    request?.periodDescription ? `Period covered: ${request.periodDescription}` : null,
    guidance ? `Guidance from the sender: ${guidance}` : null,
    purpose === NewsletterIntroPurpose.WALK_LEADER_REQUEST
      ? `Empty slots still needing a leader: ${allEvents.length}`
      : `Total events: ${allEvents.length}`,
    newCount > 0 ? `New since the last newsletter: ${newCount}` : null,
    allEvents.length > events.length ? `Only the first ${events.length} are listed below.` : null
  ].filter(Boolean).join("\n");
  const sections = Array.from(eventsByType(events).entries())
    .map(([eventType, eventsOfType]) => [`${eventType} (${eventsOfType.length}):`, ...eventsOfType.map(describeEvent)].join("\n"));
  return [heading, ...sections].join("\n\n");
}
