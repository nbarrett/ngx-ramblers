import { DateTime } from "luxon";
import { CalendarApp, CalendarClientHints, CalendarPreviewEvent, DeviceKind } from "../models/inbox.model";
import { UIDateFormat } from "../models/date-format.model";
import { ExtendedGroupEvent } from "../models/group-event.model";
import { WalkStatus } from "../models/ramblers-walks-manager";

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
      organiserEmail: null,
      uid: event.id || null,
      sequence: 0,
      attendees: []
    };
  }
}

function isSafari(userAgent: string): boolean {
  const ua = (userAgent || "").toLowerCase();
  return ua.includes("safari") && !ua.includes("chrome") && !ua.includes("chromium") && !ua.includes("android") && !ua.includes("crios") && !ua.includes("fxios") && !ua.includes("edg");
}

function isAppleDesktop(userAgent: string): boolean {
  const ua = (userAgent || "").toLowerCase();
  return (ua.includes("mac os") || ua.includes("macintosh")) && !ua.includes("mobile") && !ua.includes("iphone") && !ua.includes("ipad");
}

function absoluteFileUrl(fileUrl: string, origin: string | null): string {
  if (/^https?:\/\//i.test(fileUrl) || /^webcal:/i.test(fileUrl)) {
    return fileUrl;
  } else if (!origin) {
    return fileUrl;
  } else {
    return `${origin.replace(/\/+$/, "")}/${(fileUrl || "").replace(/^\/+/, "")}`;
  }
}

export function localCalendarHref(fileUrl: string, hints?: CalendarClientHints | null): string {
  const absolute = absoluteFileUrl(fileUrl, hints?.origin || null);
  if (isAppleDesktop(hints?.userAgent || "") && !isSafari(hints?.userAgent || "") && /^https?:\/\//i.test(absolute)) {
    return absolute.replace(/^https:/i, "webcal:").replace(/^http:/i, "webcal:");
  } else {
    return absolute;
  }
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

export function googleCalendarUrl(event: CalendarPreviewEvent): string | null {
  const dates = googleDates(event);
  if (!dates) {
    return null;
  } else {
    const params = new URLSearchParams();
    params.set("action", "TEMPLATE");
    params.set("text", event.title || "Event");
    params.set("dates", dates);
    if (event.description) {
      params.set("details", event.description);
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
    if (event.description) {
      params.set("body", event.description);
    }
    if (event.location) {
      params.set("location", event.location);
    }
    return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
  }
}
