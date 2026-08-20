import { DateTime } from "luxon";
import { UIDateFormat } from "../models/date-format.model";
import {
  CalendarAttendee,
  CalendarInvite,
  CalendarMethod,
  CalendarPreviewEvent,
  CalendarRsvpStatus
} from "../models/inbox.model";

interface IcsLine {
  name: string;
  params: Record<string, string>;
  value: string;
}

export function unescapeIcsText(value: string): string {
  return (value || "")
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

export function unfoldIcsLines(source: string): string[] {
  return (source || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n")
    .reduce((lines: string[], line) => {
      return line.startsWith(" ") || line.startsWith("\t")
        ? lines.slice(0, -1).concat((lines[lines.length - 1] || "") + line.slice(1))
        : lines.concat(line);
    }, []);
}

function parseIcsLine(line: string): IcsLine | null {
  const colon = line.indexOf(":");
  if (colon < 0) {
    return null;
  } else {
    const meta = line.slice(0, colon);
    const parts = meta.split(";");
    const params = parts.slice(1).reduce((accumulator: Record<string, string>, part) => {
      const equals = part.indexOf("=");
      return equals < 0
        ? accumulator
        : {...accumulator, [part.slice(0, equals).toUpperCase()]: part.slice(equals + 1)};
    }, {});
    return {name: (parts[0] || "").toUpperCase(), params, value: unescapeIcsText(line.slice(colon + 1))};
  }
}

function splitVEvents(lines: string[]): string[][] {
  return lines.reduce((state: {events: string[][]; current: string[] | null}, line) => {
    const upper = line.trim().toUpperCase();
    if (upper === "BEGIN:VEVENT") {
      return {events: state.events, current: []};
    } else if (upper === "END:VEVENT") {
      return {events: state.current ? state.events.concat([state.current]) : state.events, current: null};
    } else if (state.current) {
      return {events: state.events, current: state.current.concat(line)};
    } else {
      return state;
    }
  }, {events: [], current: null}).events;
}

function icsDateMillis(value: string, valueType: string | null): {millis: number | null; allDay: boolean} {
  const compact = (value || "").trim();
  if (!compact) {
    return {millis: null, allDay: false};
  } else if (valueType === "DATE" || /^\d{8}$/.test(compact)) {
    const dateTime = DateTime.fromFormat(compact, UIDateFormat.YEAR_MONTH_DAY, {zone: "Europe/London"});
    return {millis: dateTime.isValid ? dateTime.toMillis() : null, allDay: true};
  } else if (compact.endsWith("Z")) {
    const dateTime = DateTime.fromFormat(compact, UIDateFormat.ICAL_UTC_TIMESTAMP, {zone: "utc"});
    return {millis: dateTime.isValid ? dateTime.setZone("Europe/London").toMillis() : null, allDay: false};
  } else {
    const dateTime = DateTime.fromFormat(compact, UIDateFormat.ICAL_LOCAL_TIMESTAMP, {zone: "Europe/London"});
    return {millis: dateTime.isValid ? dateTime.toMillis() : null, allDay: false};
  }
}

function mailtoEmail(value: string): string {
  return (value || "").replace(/^mailto:/i, "").trim();
}

function commonNameFrom(line: IcsLine): string | null {
  return line.params.CN ? unescapeIcsText(line.params.CN.replace(/^"|"$/g, "")) : null;
}

function organiserFrom(line: IcsLine): string | null {
  return commonNameFrom(line) || mailtoEmail(line.value) || null;
}

function calendarMethodFrom(value: string | null): CalendarMethod | null {
  if (value === CalendarMethod.REQUEST) {
    return CalendarMethod.REQUEST;
  } else if (value === CalendarMethod.PUBLISH) {
    return CalendarMethod.PUBLISH;
  } else if (value === CalendarMethod.REPLY) {
    return CalendarMethod.REPLY;
  } else if (value === CalendarMethod.CANCEL) {
    return CalendarMethod.CANCEL;
  } else if (value === CalendarMethod.COUNTER) {
    return CalendarMethod.COUNTER;
  } else {
    return null;
  }
}

function rsvpStatusFrom(value: string | null): CalendarRsvpStatus | null {
  const upper = (value || "").toUpperCase();
  if (upper === CalendarRsvpStatus.ACCEPTED) {
    return CalendarRsvpStatus.ACCEPTED;
  } else if (upper === CalendarRsvpStatus.TENTATIVE) {
    return CalendarRsvpStatus.TENTATIVE;
  } else if (upper === CalendarRsvpStatus.DECLINED) {
    return CalendarRsvpStatus.DECLINED;
  } else if (upper === CalendarRsvpStatus.NEEDS_ACTION) {
    return CalendarRsvpStatus.NEEDS_ACTION;
  } else {
    return null;
  }
}

function attendeeFrom(line: IcsLine): CalendarAttendee | null {
  const email = mailtoEmail(line.value);
  if (!email) {
    return null;
  } else {
    return {
      email,
      name: commonNameFrom(line),
      rsvp: (line.params.RSVP || "").toUpperCase() === "TRUE",
      partStat: rsvpStatusFrom(line.params.PARTSTAT || null)
    };
  }
}

function eventFromLines(lines: string[]): CalendarPreviewEvent {
  const properties = lines.map(parseIcsLine).filter(Boolean) as IcsLine[];
  const byName = (name: string) => properties.find(property => property.name === name) ?? null;
  const start = byName("DTSTART");
  const end = byName("DTEND");
  const startParsed = start ? icsDateMillis(start.value, start.params.VALUE || null) : {millis: null, allDay: false};
  const endParsed = end ? icsDateMillis(end.value, end.params.VALUE || null) : {millis: null, allDay: false};
  const organiser = byName("ORGANIZER");
  const sequenceValue = parseInt(byName("SEQUENCE")?.value || "0", 10);
  return {
    title: byName("SUMMARY")?.value || null,
    startsAt: startParsed.millis,
    endsAt: endParsed.millis,
    allDay: startParsed.allDay,
    location: byName("LOCATION")?.value || null,
    description: byName("DESCRIPTION")?.value || null,
    url: byName("URL")?.value || null,
    status: byName("STATUS")?.value || null,
    organiser: organiser ? organiserFrom(organiser) : null,
    organiserEmail: organiser ? mailtoEmail(organiser.value) || null : null,
    uid: byName("UID")?.value || null,
    sequence: Number.isFinite(sequenceValue) ? sequenceValue : 0,
    attendees: properties.map(property => property.name === "ATTENDEE" ? attendeeFrom(property) : null).filter(Boolean) as CalendarAttendee[]
  };
}

function methodFromSource(source: string): CalendarMethod | null {
  const methodLine = unfoldIcsLines(source)
    .map(parseIcsLine)
    .find(line => line?.name === "METHOD");
  return calendarMethodFrom(methodLine?.value?.toUpperCase() || null);
}

export function parseIcsCalendar(source: string): CalendarInvite {
  return {
    method: methodFromSource(source),
    events: splitVEvents(unfoldIcsLines(source)).map(eventFromLines)
  };
}

export function parseIcsEvents(source: string): CalendarPreviewEvent[] {
  return parseIcsCalendar(source).events;
}

export function isCalendarFile(filename: string, contentType?: string | null): boolean {
  const type = (contentType || "").toLowerCase();
  const name = (filename || "").toLowerCase();
  return type === "text/calendar" || type.includes("ics") || name.endsWith(".ics");
}

export function calendarInviteCanRsvp(invite: CalendarInvite): boolean {
  if (invite.method === CalendarMethod.CANCEL || invite.method === CalendarMethod.REPLY || invite.method === CalendarMethod.PUBLISH) {
    return false;
  } else if (invite.events.some(event => (event.status || "").toUpperCase() === "CANCELLED")) {
    return false;
  } else {
    return invite.method === CalendarMethod.REQUEST || invite.events.some(event => event.attendees.length > 0);
  }
}

function icsStamp(millis: number, allDay: boolean): string {
  if (allDay) {
    return DateTime.fromMillis(millis, {zone: "Europe/London"}).toFormat(UIDateFormat.YEAR_MONTH_DAY);
  } else {
    return DateTime.fromMillis(millis, {zone: "utc"}).toFormat(UIDateFormat.ICAL_UTC_TIMESTAMP);
  }
}

function foldIcsLine(line: string): string {
  const characters = [...line];
  const folded = characters.reduce((accumulator: {lines: string[]; current: string}, character) => {
    const limit = accumulator.lines.length === 0 ? 75 : 74;
    if ((accumulator.current + character).length > limit) {
      return {lines: accumulator.lines.concat(accumulator.current), current: character};
    } else {
      return {lines: accumulator.lines, current: accumulator.current + character};
    }
  }, {lines: [], current: ""});
  return folded.lines.concat(folded.current).join("\r\n ");
}

function escapeIcsText(value: string): string {
  return (value || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function calendarReplyDocument(
  event: CalendarPreviewEvent,
  attendee: {email: string; name: string | null},
  status: CalendarRsvpStatus,
  stampMillis: number
): string {
  const stamp = DateTime.fromMillis(stampMillis, {zone: "utc"}).toFormat(UIDateFormat.ICAL_UTC_TIMESTAMP);
  const attendeeName = attendee.name ? `;CN=${escapeIcsText(attendee.name)}` : "";
  const organiserName = event.organiser ? `;CN=${escapeIcsText(event.organiser)}` : "";
  const startLine = event.startsAt
    ? (event.allDay ? `DTSTART;VALUE=DATE:${icsStamp(event.startsAt, true)}` : `DTSTART:${icsStamp(event.startsAt, false)}`)
    : null;
  const endLine = event.endsAt
    ? (event.allDay ? `DTEND;VALUE=DATE:${icsStamp(event.endsAt, true)}` : `DTEND:${icsStamp(event.endsAt, false)}`)
    : null;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NGX Ramblers//Inbox//EN",
    "METHOD:REPLY",
    "BEGIN:VEVENT",
    event.uid ? `UID:${event.uid}` : null,
    `DTSTAMP:${stamp}`,
    startLine,
    endLine,
    `SUMMARY:${escapeIcsText(event.title || "Event")}`,
    event.organiserEmail ? `ORGANIZER${organiserName}:mailto:${event.organiserEmail}` : null,
    `ATTENDEE${attendeeName};PARTSTAT=${status}:mailto:${attendee.email}`,
    `SEQUENCE:${event.sequence || 0}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].filter(Boolean) as string[];
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}

export function calendarRsvpSubject(status: CalendarRsvpStatus, title: string | null): string {
  const name = title || "Event";
  if (status === CalendarRsvpStatus.ACCEPTED) {
    return `Accepted: ${name}`;
  } else if (status === CalendarRsvpStatus.TENTATIVE) {
    return `Tentative: ${name}`;
  } else if (status === CalendarRsvpStatus.DECLINED) {
    return `Declined: ${name}`;
  } else {
    return name;
  }
}
