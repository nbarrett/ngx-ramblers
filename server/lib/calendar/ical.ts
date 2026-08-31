import { ExtendedGroupEvent } from "../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { WalkStatus } from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { UIDateFormat } from "../../../projects/ngx-ramblers/src/app/models/date-format.model";
import { eventUrlFor } from "../shared/event-url";
import { dateTimeFromIsoWithZone, dateTimeFromMillis, dateTimeNow, formatDateTime } from "../shared/dates";

const DEFAULT_EVENT_DURATION_HOURS = 3;
const MAXIMUM_LINE_OCTETS = 75;

export function escapeIcalText(value: string): string {
  return (value || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function foldIcalLine(line: string): string {
  const characters = [...line];
  const folded = characters.reduce((accumulator: { lines: string[]; current: string }, character) => {
    const limit = accumulator.lines.length === 0 ? MAXIMUM_LINE_OCTETS : MAXIMUM_LINE_OCTETS - 1;
    if (Buffer.byteLength(accumulator.current + character, "utf8") > limit) {
      return {lines: accumulator.lines.concat(accumulator.current), current: character};
    } else {
      return {lines: accumulator.lines, current: accumulator.current + character};
    }
  }, {lines: [], current: ""});
  return folded.lines.concat(folded.current).join("\r\n ");
}

function icalTimestamp(isoDateTime: string): string {
  const dateTime = isoDateTime ? dateTimeFromIsoWithZone(isoDateTime) : null;
  return dateTime?.isValid ? formatDateTime(dateTime.toUTC(), UIDateFormat.ICAL_UTC_TIMESTAMP) : null;
}

function endTimestampFor(event: ExtendedGroupEvent): string {
  const explicitEnd = icalTimestamp(event?.groupEvent?.end_date_time);
  if (explicitEnd) {
    return explicitEnd;
  } else {
    const start = event?.groupEvent?.start_date_time ? dateTimeFromIsoWithZone(event.groupEvent.start_date_time) : null;
    return start?.isValid
      ? formatDateTime(start.plus({hours: DEFAULT_EVENT_DURATION_HOURS}).toUTC(), UIDateFormat.ICAL_UTC_TIMESTAMP)
      : null;
  }
}

function plainTextDescription(event: ExtendedGroupEvent): string {
  return (event?.groupEvent?.description || "")
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)]\([^)]*\)/g, "$1")
    .replace(/[*_`>#]/g, "")
    .trim();
}

function locationDescription(event: ExtendedGroupEvent): string {
  const location = event?.groupEvent?.start_location || event?.groupEvent?.location;
  return [location?.description, location?.postcode].filter(Boolean).join(", ");
}

export function eventUid(event: ExtendedGroupEvent, baseUrl: string): string {
  const host = (baseUrl || "").replace(/^https?:\/\//, "").replace(/\/+$/, "") || "ngx-ramblers";
  return `${event?.id || (event as any)?._id?.toString()}@${host}`;
}

function sequenceFor(event: ExtendedGroupEvent): number {
  const updated = event?.groupEvent?.date_updated ? dateTimeFromIsoWithZone(event.groupEvent.date_updated) : null;
  return updated?.isValid ? Math.floor(updated.toSeconds()) : 0;
}

export function vEventFor(event: ExtendedGroupEvent, config: SystemConfig, baseUrl: string, stamp: string): string[] {
  const start = icalTimestamp(event?.groupEvent?.start_date_time);
  const end = endTimestampFor(event);
  const location = locationDescription(event);
  const url = eventUrlFor(event, config?.group, baseUrl);
  const geoLocation = event?.groupEvent?.start_location || event?.groupEvent?.location;
  return [
    "BEGIN:VEVENT",
    `UID:${eventUid(event, baseUrl)}`,
    `DTSTAMP:${stamp}`,
    start ? `DTSTART:${start}` : null,
    end ? `DTEND:${end}` : null,
    `SUMMARY:${escapeIcalText(event?.groupEvent?.title)}`,
    plainTextDescription(event) ? `DESCRIPTION:${escapeIcalText(plainTextDescription(event))}` : null,
    location ? `LOCATION:${escapeIcalText(location)}` : null,
    geoLocation?.latitude && geoLocation?.longitude ? `GEO:${geoLocation.latitude};${geoLocation.longitude}` : null,
    url ? `URL:${escapeIcalText(url)}` : null,
    `STATUS:${event?.groupEvent?.status === WalkStatus.CANCELLED ? "CANCELLED" : "CONFIRMED"}`,
    `SEQUENCE:${sequenceFor(event)}`,
    "END:VEVENT"
  ].filter(Boolean);
}

export interface MeetingInviteAttendee {
  email: string;
  name?: string;
}

export interface MeetingInvite {
  uid: string;
  title: string;
  startTime: number;
  durationMinutes?: number;
  description?: string;
  location?: string;
  url?: string;
  organiserName?: string;
  organiserEmail?: string;
  attendees?: MeetingInviteAttendee[];
}

const DEFAULT_MEETING_DURATION_MINUTES = 60;

function icalTimestampFromMillis(millis: number): string {
  const dateTime = millis ? dateTimeFromMillis(millis) : null;
  return dateTime?.isValid ? formatDateTime(dateTime.toUTC(), UIDateFormat.ICAL_UTC_TIMESTAMP) : null;
}

export function meetingIcalDocument(meeting: MeetingInvite, calendarName: string): string {
  const stamp = formatDateTime(dateTimeNow().toUTC(), UIDateFormat.ICAL_UTC_TIMESTAMP);
  const durationMinutes = meeting.durationMinutes || DEFAULT_MEETING_DURATION_MINUTES;
  const start = icalTimestampFromMillis(meeting.startTime);
  const end = icalTimestampFromMillis(meeting.startTime + durationMinutes * 60000);
  const organiserLabel = escapeIcalText(meeting.organiserName || meeting.organiserEmail);
  const organiser = meeting.organiserEmail ? `ORGANIZER;CN=${organiserLabel}:mailto:${meeting.organiserEmail}` : null;
  const invitees = (meeting.attendees || []).filter(attendee => !!attendee?.email);
  const attendeeLines = invitees.length
    ? invitees.map(attendee => {
      const label = escapeIcalText(attendee.name || attendee.email);
      return `ATTENDEE;CN=${label};RSVP=TRUE;PARTSTAT=NEEDS-ACTION:mailto:${attendee.email}`;
    })
    : (meeting.organiserEmail ? [`ATTENDEE;CN=${organiserLabel};RSVP=FALSE:mailto:${meeting.organiserEmail}`] : []);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NGX Ramblers//Video Meetings//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${meeting.organiserEmail ? "REQUEST" : "PUBLISH"}`,
    `X-WR-CALNAME:${escapeIcalText(calendarName)}`,
    "BEGIN:VEVENT",
    `UID:${escapeIcalText(meeting.uid)}`,
    `DTSTAMP:${stamp}`,
    start ? `DTSTART:${start}` : null,
    end ? `DTEND:${end}` : null,
    `SUMMARY:${escapeIcalText(meeting.title)}`,
    meeting.description ? `DESCRIPTION:${escapeIcalText(meeting.description)}` : null,
    (meeting.location || meeting.url) ? `LOCATION:${escapeIcalText(meeting.location || meeting.url)}` : null,
    meeting.url ? `URL:${escapeIcalText(meeting.url)}` : null,
    organiser,
    ...attendeeLines,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "END:VEVENT",
    "END:VCALENDAR"
  ].filter(Boolean);
  return lines.map(foldIcalLine).join("\r\n") + "\r\n";
}

export function icalDocument(events: ExtendedGroupEvent[], config: SystemConfig, baseUrl: string, calendarName: string): string {
  const stamp = formatDateTime(dateTimeNow().toUTC(), UIDateFormat.ICAL_UTC_TIMESTAMP);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NGX Ramblers//Walks and Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcalText(calendarName)}`,
    "X-PUBLISHED-TTL:PT6H"
  ]
    .concat(events.flatMap(event => vEventFor(event, config, baseUrl, stamp)))
    .concat("END:VCALENDAR");
  return lines.map(foldIcalLine).join("\r\n") + "\r\n";
}
