import {
  DEFAULT_NEWSLETTER_INTRO_DETAIL,
  DEFAULT_NEWSLETTER_INTRO_PURPOSE,
  NewsletterIntroDetail,
  NewsletterIntroEvent,
  NewsletterIntroFieldChange,
  NewsletterIntroPurpose,
  NewsletterIntroRequest
} from "../../../projects/ngx-ramblers/src/app/models/ai.model";
import { eventsForPurpose } from "../../../projects/ngx-ramblers/src/app/functions/newsletter-purpose";
import { uniq } from "es-toolkit/compat";
import { givenName } from "../../../projects/ngx-ramblers/src/app/functions/meeting-speaker-names";
import { UIDateFormat } from "../../../projects/ngx-ramblers/src/app/models/date-format.model";
import { dateTimeInTimezone, formatDateTime } from "../shared/dates";
import { pluralise } from "../shared/string-utils";
import { DateTime } from "luxon";

export { eventsForPurpose };

export const NEWSLETTER_INTRO_SYSTEM_PROMPT = [
  "Write a short introduction for a walking group's newsletter, summarising what is coming up.",
  "Write in the first person plural as the group speaking to its members (we, our, us).",
  "Set the scene from the period covered and the walks and social events in the source.",
  "If the source says the period is short, or asks you to name each walk, name every walk with its day and, where a leader first name is listed, as that person's walk (Alex's Chilham circular on Saturday 2 August). Do not collapse a handful of walks into a weekday pattern such as Sunday morning walks.",
  "If the source gives a walk pattern for a longer programme, say the day and whether walks are morning or evening once (Sunday morning walks, Wednesday evening walks) and do not list every walk. Name each social with its date.",
  "Do not open with how many events there are.",
  "Do not say the programme continues, and do not invent a weekly series from a single walk.",
  "Once dates are stated, do not add that the walks are spread across the week, the fortnight or the month.",
  "Follow the Style line in the source for how much detail to include.",
  "The full details follow immediately underneath, so the introduction only needs to set the scene.",
  "If any walks have listed changes, mention those differences in the same introduction, naming the walk as the leader's walk when a first name is listed (Alex's Chilham circular, not The Chilham circular) and saying what changed from the old value to the new value.",
  "Never write that a walk has seen some changes, has been updated, or differs from its original listing. Always say the old value and the new value.",
  "Mention every listed change for a walk. Do not drop a listed field because another change on the same walk looks more important.",
  "Give distances in miles only. Do not mention kilometres.",
  "When a listed change is a finish or start time on the same day, say the times only (2:30 pm to 2:45 pm). Do not repeat the date, and do not mention seconds.",
  "Write listed changes as a person would say them. Do not copy the Changes line word for word.",
  "Do not mention a change unless it is listed, and do not mention walks with no listed changes when talking about differences.",
  "If several walks have changed, a short markdown bullet list of those changes is fine after the overview.",
  "Two or three sentences is usually enough for the overview unless the Style line asks for more, and never more than four before any change list unless the Style line asks you to name each walk.",
  "The last sentence must be the Closing sentence supplied in the source, word for word.",
  "Use only the facts supplied. Do not invent walks, places, distances, dates, weather, people or anything else that is not in the source.",
  "If you mention a fact from the source, include it in full. Never cut a word or sentence short, and never use an ellipsis.",
  "If some events are marked as new since the last newsletter, mention in passing that there are new additions, without listing them.",
  "Where the sender has given guidance, follow it for emphasis and tone, but still invent nothing that is not in the source.",
  "Open with a light, human line in the voice of a volunteer writing to members, then get on with the facts. For a short period that line should still name the week or the walks, not a generic look at the programme. Dry humour is fine when it comes from something in the source. Do not strain for jokes, do not be chirpy, and do not call the walks enjoyable, wonderful, exciting or similar.",
  "Do not use em dashes and do not use exclamation marks.",
  "Do not greet the reader (no Hello, Hi everyone, or Dear members) and do not sign off, because both are added separately.",
  "Return the introduction only, as markdown, with no heading."
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
export const NEWSLETTER_INTRO_MAX_TOKENS = 4096;

export function collapsedDescription(description: string | undefined): string | null {
  const trimmed = (description ?? "").replace(/\s+/g, " ").trim();
  return trimmed ? trimmed : null;
}

export function leaderFirstName(name: string | undefined): string | null {
  const first = givenName(name || "");
  return first.length > 1 ? first : null;
}

export function eventNamedForLeader(event: NewsletterIntroEvent): string {
  const leader = event.awaitingDetails ? null : leaderFirstName(event.leaderName);
  return leader ? `${leader}'s ${event.title}` : event.title;
}

export function walkPatternSummary(events: NewsletterIntroEvent[]): string | null {
  const walks = (events ?? []).filter(event => (event.eventType || "").toLowerCase().includes("walk"));
  const slots = uniq(walks.map(event => [event.weekday, event.timeOfDay].filter(Boolean).join(" ")).filter(Boolean));
  return slots.length ? slots.map(slot => `${slot} walks`).join("; ") : null;
}

const SHORT_PERIOD_DAYS = 8;
const NAME_EACH_WALK_LIMIT = 6;

function parsePeriodDate(value: string): DateTime | null {
  const trimmed = (value || "").trim();
  const withoutWeekday = trimmed.replace(/^[A-Za-z]+,?\s+/, "");
  const parsed = [trimmed, withoutWeekday]
    .flatMap(candidate => [
      dateTimeInTimezone(candidate, UIDateFormat.DISPLAY_DATE),
      dateTimeInTimezone(candidate, UIDateFormat.DISPLAY_DATE_NO_COMMA),
      dateTimeInTimezone(candidate, UIDateFormat.DISPLAY_DATE_NO_DAY)
    ])
    .find(date => date.isValid);
  return parsed ?? null;
}

export function periodSpanDays(periodDescription: string | undefined): number | null {
  const parts = (periodDescription || "").split(/\s+to\s+/i);
  if (parts.length !== 2) {
    return null;
  } else {
    const from = parsePeriodDate(parts[0]);
    const to = parsePeriodDate(parts[1]);
    if (!from || !to) {
      return null;
    } else {
      const days = Math.round(to.diff(from, "days").days);
      return days >= 0 ? days + 1 : null;
    }
  }
}

export function introShouldNameEachWalk(
  events: NewsletterIntroEvent[],
  periodDescription?: string,
  detail?: NewsletterIntroDetail
): boolean {
  if (detail === NewsletterIntroDetail.LESS) {
    return false;
  } else if (detail === NewsletterIntroDetail.MORE) {
    return (events ?? []).length > 0;
  } else {
    const span = periodSpanDays(periodDescription);
    if (span !== null && span <= SHORT_PERIOD_DAYS) {
      return true;
    } else if (/\b(this|next|one)\s+week\b/i.test(periodDescription || "")) {
      return true;
    } else {
      const count = (events ?? []).length;
      return count > 0 && count <= NAME_EACH_WALK_LIMIT;
    }
  }
}

export function introStyleLine(
  purpose: NewsletterIntroPurpose,
  nameEachWalk: boolean,
  detail: NewsletterIntroDetail
): string | null {
  if (purpose === NewsletterIntroPurpose.WALK_LEADER_REQUEST) {
    return null;
  } else if (detail === NewsletterIntroDetail.LESS) {
    return "Style: less detail. Two sentences at most. Do not list walks. Mention at most one or two highlights by name.";
  } else if (detail === NewsletterIntroDetail.MORE) {
    return "Style: more detail. Name each walk with its day and, where listed, the leader's first name. A markdown bullet list of the walks is fine after a short overview.";
  } else if (nameEachWalk) {
    return "Style: a short period. Name each walk with its day and, where listed, the leader's first name. Do not collapse them into a weekday pattern.";
  } else {
    return "Style: set the scene in two or three sentences. Name a few highlights. Do not list every walk.";
  }
}

export function socialEventsSummary(events: NewsletterIntroEvent[]): string | null {
  const socials = (events ?? []).filter(event => (event.eventType || "").toLowerCase().includes("social"));
  return socials.length
    ? socials.map(event => event.dateDescription ? `${event.title} on ${event.dateDescription}` : event.title).join("; ")
    : null;
}

export function milesOnlyDistance(value: string | undefined): string | null {
  const trimmed = (value ?? "").replace(/\s*\/\s*\d+(?:\.\d+)?\s*k(?:m|ilometres?)\b/gi, "").trim();
  return trimmed ? trimmed : null;
}

function parseDisplayDateAndTime(value: string): DateTime | null {
  const normalised = (value ?? "").replace(/\bam\b/gi, "AM").replace(/\bpm\b/gi, "PM").trim();
  const parsed = dateTimeInTimezone(normalised, UIDateFormat.DISPLAY_DATE_AND_TIME);
  return parsed.isValid ? parsed : null;
}

function timeOnlyChangeLabel(label: string): string {
  return /end/i.test(label) ? "Finish time"
    : /start/i.test(label) ? "Start time"
    : /meeting/i.test(label) ? "Meeting time"
    : label;
}

export function describeListedChange(change: NewsletterIntroFieldChange): string {
  const fromDate = parseDisplayDateAndTime(change.from);
  const toDate = parseDisplayDateAndTime(change.to);
  if (fromDate && toDate) {
    const sameDay = fromDate.hasSame(toDate, "day");
    const fromText = formatDateTime(fromDate, sameDay ? UIDateFormat.DISPLAY_TIME : UIDateFormat.DISPLAY_DATE_AT_TIME);
    const toText = formatDateTime(toDate, sameDay ? UIDateFormat.DISPLAY_TIME : UIDateFormat.DISPLAY_DATE_AT_TIME);
    const label = sameDay ? timeOnlyChangeLabel(change.label) : change.label;
    return `${label}: ${fromText} to ${toText}`;
  } else {
    return `${change.label}: ${milesOnlyDistance(change.from) ?? change.from} to ${milesOnlyDistance(change.to) ?? change.to}`;
  }
}

function introChanges(event: NewsletterIntroEvent): NewsletterIntroFieldChange[] {
  return (event.changes ?? []).filter(change => !/kilometre/i.test(change.label) && !/distance_km/i.test(change.field));
}

export function describeEvent(event: NewsletterIntroEvent): string {
  const parts = [
    event.dateDescription,
    event.timeOfDay,
    eventNamedForLeader(event),
    milesOnlyDistance(event.distance),
    event.location ? `from ${event.location}` : null,
    event.cancelled ? "(cancelled)" : null,
    event.newSinceLastNewsletter ? "(new since the last newsletter)" : null
  ].filter(Boolean);
  const description = collapsedDescription(event.description);
  const line = description ? `- ${parts.join(", ")}. ${description}` : `- ${parts.join(", ")}`;
  const changeSummary = introChanges(event).map(describeListedChange).join("; ");
  return changeSummary ? `${line}. Changes: ${changeSummary}` : line;
}

export function closingDetailsPhrase(events: NewsletterIntroEvent[]): string | null {
  const listed = events ?? [];
  const types = listed.map(event => (event.eventType || "").toLowerCase());
  const walkCount = types.filter(type => type.includes("walk")).length;
  const socialCount = types.filter(type => type.includes("social")).length;
  const otherCount = listed.length - walkCount - socialCount;
  const parts = [
    walkCount > 0 ? `the ${pluralise(walkCount, "walk")}` : null,
    socialCount > 0 ? `the ${pluralise(socialCount, "social event")}` : null,
    otherCount > 0 ? `the ${pluralise(otherCount, "event")}` : null
  ].filter(Boolean);
  return listed.length ? parts.join(" and ") : null;
}

export function eventsByType(events: NewsletterIntroEvent[]): Map<string, NewsletterIntroEvent[]> {
  return (events ?? []).reduce((byType, event) => {
    const key = event.eventType || "Events";
    return byType.set(key, [...(byType.get(key) ?? []), event]);
  }, new Map<string, NewsletterIntroEvent[]>());
}

export function buildNewsletterIntroInput(request: NewsletterIntroRequest): string {
  const purpose = request?.purpose ?? DEFAULT_NEWSLETTER_INTRO_PURPOSE;
  const detail = request?.detail ?? DEFAULT_NEWSLETTER_INTRO_DETAIL;
  const allEvents = eventsForPurpose(request?.events, purpose);
  const events = allEvents.slice(0, MAX_EVENTS_IN_PROMPT);
  const newCount = events.filter(event => event.newSinceLastNewsletter).length;
  const changedCount = events.filter(event => (event.changes?.length ?? 0) > 0).length;
  const detailsPhrase = purpose === NewsletterIntroPurpose.WALK_LEADER_REQUEST ? null : closingDetailsPhrase(events);
  const nameEachWalk = purpose !== NewsletterIntroPurpose.WALK_LEADER_REQUEST
    && introShouldNameEachWalk(events, request?.periodDescription, detail);
  const walkPattern = purpose === NewsletterIntroPurpose.WALK_LEADER_REQUEST || nameEachWalk ? null : walkPatternSummary(events);
  const socials = purpose === NewsletterIntroPurpose.WALK_LEADER_REQUEST ? null : socialEventsSummary(events);
  const guidance = collapsedDescription(request?.guidance);
  const heading = [
    request?.groupName ? `Group: ${request.groupName}` : null,
    request?.periodDescription ? `Period covered: ${request.periodDescription}` : null,
    allEvents.length ? introStyleLine(purpose, nameEachWalk, detail) : null,
    walkPattern ? `Walk pattern: ${walkPattern}` : null,
    socials ? `Social events: ${socials}` : null,
    guidance ? `Guidance from the sender: ${guidance}` : null,
    purpose === NewsletterIntroPurpose.WALK_LEADER_REQUEST
      ? `Empty slots still needing a leader: ${allEvents.length}`
      : `Total events: ${allEvents.length}`,
    newCount > 0 ? `New since the last newsletter: ${newCount}` : null,
    purpose !== NewsletterIntroPurpose.WALK_LEADER_REQUEST && changedCount > 0
      ? `Walks with recent changes: ${changedCount}`
      : null,
    detailsPhrase ? `Closing sentence: See below for full details of ${detailsPhrase}.` : null,
    allEvents.length > events.length ? `Only the first ${events.length} are listed below.` : null
  ].filter(Boolean).join("\n");
  const sections = Array.from(eventsByType(events).entries())
    .map(([eventType, eventsOfType]) => [`${eventType} (${eventsOfType.length}):`, ...eventsOfType.map(describeEvent)].join("\n"));
  return [heading, ...sections].join("\n\n");
}
