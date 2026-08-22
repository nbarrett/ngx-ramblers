import { toPairs, values } from "es-toolkit/compat";
import {
  DEFAULT_SOCIAL_EVENT_CAPTION_TEMPLATE,
  DEFAULT_WALK_CAPTION_TEMPLATE,
  EventCaptionInput,
  EventCaptionToken
} from "../../../projects/ngx-ramblers/src/app/models/social-publish.model";
import { ExtendedGroupEvent } from "../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { RamblersEventType } from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { UIDateFormat } from "../../../projects/ngx-ramblers/src/app/models/date-format.model";
import { dateTimeFromIsoWithZone, formatDateTime } from "../shared/dates";
import { withLink } from "./caption-builder";

const TOKEN_PATTERN = /\{([a-zA-Z]+)}/g;

function isWalk(event: ExtendedGroupEvent): boolean {
  return event?.groupEvent?.item_type !== RamblersEventType.GROUP_EVENT;
}

function distanceDescription(event: ExtendedGroupEvent): string {
  const miles = event?.groupEvent?.distance_miles;
  return isWalk(event) && miles > 0 ? `${Number(miles.toFixed(1))} miles` : "";
}

function gradeDescription(event: ExtendedGroupEvent): string {
  return isWalk(event) ? (event?.groupEvent?.difficulty?.description || "") : "";
}

function leaderDescription(event: ExtendedGroupEvent): string {
  return event?.fields?.contactDetails?.displayName || event?.groupEvent?.walk_leader?.name || "";
}

function startLocationDescription(event: ExtendedGroupEvent): string {
  const startLocation = event?.groupEvent?.start_location || event?.groupEvent?.location;
  return [startLocation?.description, startLocation?.postcode].filter(Boolean).join(", ");
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_whole, code) => String.fromCharCode(Number(code)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function plainTextDescription(event: ExtendedGroupEvent): string {
  return decodeHtmlEntities(
    (event?.groupEvent?.description || "")
      .replace(/!\[[^\]]*]\([^)]*\)/g, "")
      .replace(/\[([^\]]*)]\([^)]*\)/g, "$1")
      .replace(/[*_`>#]/g, "")
      .replace(/\n{3,}/g, "\n\n")
  ).trim();
}

export function defaultTemplateForEvent(event: ExtendedGroupEvent): string {
  return isWalk(event) ? DEFAULT_WALK_CAPTION_TEMPLATE : DEFAULT_SOCIAL_EVENT_CAPTION_TEMPLATE;
}

export function eventCaptionInputFrom(event: ExtendedGroupEvent, eventUrl: string): EventCaptionInput {
  const startDateTime = event?.groupEvent?.start_date_time;
  const dateTime = startDateTime ? dateTimeFromIsoWithZone(startDateTime) : null;
  return {
    title: event?.groupEvent?.title || "",
    description: plainTextDescription(event),
    date: dateTime?.isValid ? formatDateTime(dateTime, UIDateFormat.DISPLAY_DATE) : "",
    time: dateTime?.isValid ? formatDateTime(dateTime, UIDateFormat.DISPLAY_TIME) : "",
    startLocation: startLocationDescription(event),
    distance: distanceDescription(event),
    grade: gradeDescription(event),
    leader: leaderDescription(event),
    url: eventUrl || ""
  };
}

function valueForToken(input: EventCaptionInput, token: string): string {
  const matched = toPairs(input).find(([key]) => key === token);
  return matched ? (matched[1] as string) || "" : "";
}

function isKnownToken(token: string): boolean {
  return values(EventCaptionToken).includes(token as EventCaptionToken);
}

function substituteLine(line: string, input: EventCaptionInput): string | null {
  const tokens = [...line.matchAll(TOKEN_PATTERN)].map(match => match[1]).filter(isKnownToken);
  const substituted = line.replace(TOKEN_PATTERN, (whole, token) =>
    isKnownToken(token) ? valueForToken(input, token) : whole);
  const allTokensEmpty = tokens.length > 0 && tokens.every(token => !valueForToken(input, token));
  return allTokensEmpty ? null : substituted.replace(/\s+·\s+·\s+/g, " · ").replace(/^\s*·\s*|\s*·\s*$/g, "").trimEnd();
}

export function buildEventCaption(input: EventCaptionInput, template?: string): string {
  const lines = (template?.trim() ? template : DEFAULT_WALK_CAPTION_TEMPLATE).split("\n");
  const caption = lines
    .map(line => substituteLine(line, input))
    .filter(line => line !== null)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return withLink(caption, input.url, "Full details:");
}

export function captionFingerprint(caption: string): string {
  return [...caption].reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) % 2147483647, 7).toString(36);
}
