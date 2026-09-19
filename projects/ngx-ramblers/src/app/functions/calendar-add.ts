import { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { faGoogle, faMicrosoft } from "@fortawesome/free-brands-svg-icons";
import { faCalendarDay } from "@fortawesome/free-solid-svg-icons";
import { isBrowser } from "es-toolkit";
import { DateTime } from "luxon";
import { CalendarApp, CalendarClientHints, CalendarPreviewEvent, DeviceKind, OrganiserLabel } from "../models/inbox.model";
import { UIDateFormat } from "../models/date-format.model";
import { ExtendedGroupEvent } from "../models/group-event.model";
import { RamblersEventType, WalkStatus } from "../models/ramblers-walks-manager";
import { escapeHtml, stripTrailingSlash } from "./strings";

const DEFAULT_WALK_DURATION_HOURS = 3;

export function deviceKindFromUserAgent(userAgent: string, platform?: string | null): DeviceKind {
  const hint = (platform || "").toLowerCase();
  if (hint.includes("ios") || hint.includes("mac")) {
    return DeviceKind.APPLE;
  } else if (hint.includes("android")) {
    return DeviceKind.ANDROID;
  } else if (hint.includes("win")) {
    return DeviceKind.WINDOWS;
  } else {
    const ua = (userAgent || "").toLowerCase();
    if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ipod") || (ua.includes("mac os") && !ua.includes("mobile"))) {
      return DeviceKind.APPLE;
    } else if (ua.includes("android")) {
      return DeviceKind.ANDROID;
    } else if (ua.includes("windows")) {
      return DeviceKind.WINDOWS;
    } else {
      return DeviceKind.OTHER;
    }
  }
}

export function browserDeviceKind(): DeviceKind {
  return deviceKindFromUserAgent(isBrowser() ? navigator.userAgent : "", isBrowser() ? navigator.platform : null);
}

export function browserCalendarApps(): CalendarApp[] {
  return calendarAppsForDevice(browserDeviceKind());
}

export function browserCalendarClientHints(): CalendarClientHints {
  return {
    userAgent: isBrowser() ? navigator.userAgent : "",
    origin: isBrowser() ? window.location.origin : null
  };
}

export function calendarAppIcon(app: CalendarApp): IconDefinition {
  if (app === CalendarApp.GOOGLE) {
    return faGoogle;
  } else if (app === CalendarApp.OUTLOOK) {
    return faMicrosoft;
  } else {
    return faCalendarDay;
  }
}

export function organiserLabelFor(itemType: string | null | undefined): OrganiserLabel {
  if (!itemType || itemType === RamblersEventType.GROUP_WALK) {
    return OrganiserLabel.WALK_LEADER;
  } else {
    return OrganiserLabel.ORGANISER;
  }
}

export function calendarAppsForDevice(kind: DeviceKind): CalendarApp[] {
  if (kind === DeviceKind.ANDROID) {
    return [CalendarApp.GOOGLE, CalendarApp.LOCAL, CalendarApp.OUTLOOK];
  } else if (kind === DeviceKind.OTHER) {
    return [CalendarApp.GOOGLE, CalendarApp.OUTLOOK, CalendarApp.LOCAL];
  } else {
    return [CalendarApp.LOCAL, CalendarApp.GOOGLE, CalendarApp.OUTLOOK];
  }
}

export function calendarAppLabel(app: CalendarApp): string {
  if (app === CalendarApp.GOOGLE) {
    return "Add to Google Calendar";
  } else if (app === CalendarApp.OUTLOOK) {
    return "Add to Outlook";
  } else {
    return "Add to Calendar";
  }
}

function millisFromIso(value: string | null): number | null {
  if (!value) {
    return null;
  } else {
    const dateTime = DateTime.fromISO(value, {zone: "Europe/London"});
    return dateTime.isValid ? dateTime.toMillis() : null;
  }
}

function walkLocation(event: ExtendedGroupEvent): string | null {
  const location = event?.groupEvent?.start_location || event?.groupEvent?.location;
  const text = [location?.description, location?.postcode].filter(Boolean).join(", ");
  return text || null;
}

function walkDescription(event: ExtendedGroupEvent): string | null {
  const text = (event?.groupEvent?.description || "")
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)]\([^)]*\)/g, "$1")
    .replace(/[*_`>#]/g, "")
    .trim();
  return text || null;
}

export function calendarEventFromGroupEvent(event: ExtendedGroupEvent | null): CalendarPreviewEvent | null {
  if (!event?.groupEvent) {
    return null;
  } else {
    const startsAt = millisFromIso(event.groupEvent.start_date_time);
    const explicitEnd = millisFromIso(event.groupEvent.end_date_time);
    const endsAt = explicitEnd || (startsAt ? startsAt + DEFAULT_WALK_DURATION_HOURS * 60 * 60 * 1000 : null);
    const organiser = event.groupEvent.walk_leader?.name || event.groupEvent.event_organiser?.name || null;
    return {
      title: event.groupEvent.title || null,
      startsAt,
      endsAt,
      allDay: false,
      location: walkLocation(event),
      description: walkDescription(event),
      url: event.groupEvent.url || null,
      status: event.groupEvent.status === WalkStatus.CANCELLED ? "CANCELLED" : "CONFIRMED",
      organiser,
      organiserLabel: organiserLabelFor(event.groupEvent.item_type),
      organiserEmail: null,
      organiserPhone: null,
      uid: event.id || null,
      sequence: 0,
      attendees: []
    };
  }
}

function absoluteFileUrl(fileUrl: string, origin: string | null): string {
  if (/^https?:\/\//i.test(fileUrl) || /^webcal:/i.test(fileUrl)) {
    return fileUrl;
  } else if (!origin) {
    return fileUrl;
  } else {
    return `${stripTrailingSlash(origin)}/${(fileUrl || "").replace(/^\/+/, "")}`;
  }
}

export function localCalendarHref(fileUrl: string, hints?: CalendarClientHints | null): string {
  return absoluteFileUrl(fileUrl, hints?.origin || null);
}

export function calendarHrefFor(app: CalendarApp, event: CalendarPreviewEvent | null, fileUrl: string | null, hints?: CalendarClientHints | null): string | null {
  if (app === CalendarApp.GOOGLE && event) {
    return googleCalendarUrl(event);
  } else if (app === CalendarApp.OUTLOOK && event) {
    return outlookCalendarUrl(event);
  } else if (app === CalendarApp.LOCAL && fileUrl) {
    return localCalendarHref(fileUrl, hints);
  } else {
    return null;
  }
}

function utcStamp(millis: number): string {
  return DateTime.fromMillis(millis, {zone: "utc"}).toFormat(UIDateFormat.ICAL_UTC_TIMESTAMP);
}

function londonDate(millis: number): string {
  return DateTime.fromMillis(millis, {zone: "Europe/London"}).toFormat(UIDateFormat.YEAR_MONTH_DAY);
}

function googleDates(event: CalendarPreviewEvent): string | null {
  if (!event.startsAt) {
    return null;
  } else if (event.allDay) {
    const start = londonDate(event.startsAt);
    const end = event.endsAt
      ? londonDate(event.endsAt)
      : DateTime.fromMillis(event.startsAt, {zone: "Europe/London"}).plus({days: 1}).toFormat(UIDateFormat.YEAR_MONTH_DAY);
    return `${start}/${end}`;
  } else {
    const end = event.endsAt || event.startsAt;
    return `${utcStamp(event.startsAt)}/${utcStamp(end)}`;
  }
}

function calendarBody(event: CalendarPreviewEvent): string | null {
  const organiser = [event.organiser, event.organiserPhone, event.organiserEmail].filter(Boolean).map(escapeHtml).join(" ");
  const rows = [
    event.description ? `<strong>Description:</strong> ${escapeHtml(event.description)}` : null,
    organiser ? `<strong>${event.organiserLabel}:</strong> ${organiser}` : null,
    event.url ? `<strong>Website:</strong> <a href="${escapeHtml(event.url)}">${escapeHtml(event.url)}</a>` : null
  ].filter(Boolean);
  return rows.length ? rows.join("<br>") : null;
}

export function googleCalendarUrl(event: CalendarPreviewEvent): string | null {
  const dates = googleDates(event);
  if (!dates) {
    return null;
  } else {
    const params = new URLSearchParams();
    params.set("action", "TEMPLATE");
    params.set("text", event.title || "Event");
    params.set("dates", dates);
    const body = calendarBody(event);
    if (body) {
      params.set("details", body);
    }
    if (event.location) {
      params.set("location", event.location);
    }
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }
}

function outlookIso(millis: number): string {
  return DateTime.fromMillis(millis, {zone: "utc"}).toISO({suppressMilliseconds: true});
}

export function outlookCalendarUrl(event: CalendarPreviewEvent): string | null {
  if (!event.startsAt) {
    return null;
  } else {
    const params = new URLSearchParams();
    params.set("path", "/calendar/action/compose");
    params.set("rru", "addevent");
    params.set("subject", event.title || "Event");
    params.set("startdt", outlookIso(event.startsAt));
    params.set("enddt", outlookIso(event.endsAt || event.startsAt));
    const body = calendarBody(event);
    if (body) {
      params.set("body", body);
    }
    if (event.location) {
      params.set("location", event.location);
    }
    return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
  }
}
