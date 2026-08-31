import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { CalendarMethod, CalendarRsvpStatus } from "../models/inbox.model";
import {
  calendarInviteCanRsvp,
  calendarReplyDocument,
  calendarReplyResponses,
  calendarRsvpSubject,
  committeeFileIdFromMeetingUid,
  isCalendarFile,
  meetingRoomFromCalendarEvent,
  parseIcsCalendar,
  parseIcsEvents,
  unescapeIcsText,
  unfoldIcsLines
} from "./ics-calendar";

describe("unescapeIcsText", () => {

  it("turns escaped commas, semicolons and newlines back into ordinary text", () => {
    expect(unescapeIcsText("Chilham Square\\, CT4 8BY\\nBring boots"))
      .toEqual("Chilham Square, CT4 8BY\nBring boots");
  });

});

describe("unfoldIcsLines", () => {

  it("joins a folded continuation onto the previous line", () => {
    const lines = unfoldIcsLines("SUMMARY:Chilham \r\n circular\r\nDTSTART:20260815T090000Z\r\n");
    expect(lines).toEqual(["SUMMARY:Chilham circular", "DTSTART:20260815T090000Z", ""]);
  });

});

describe("parseIcsEvents", () => {

  const walkCalendar = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    "UID:abc123@example.org",
    "DTSTART:20260815T090000Z",
    "DTEND:20260815T123000Z",
    "SUMMARY:Chilham circular",
    "DESCRIPTION:A gentle loop",
    "LOCATION:Chilham Square\\, CT4 8BY",
    "URL:https://example.org/walks/chilham-circular",
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");

  it("reads the title, place and times from a walk calendar", () => {
    const events = parseIcsEvents(walkCalendar);
    expect(events.length).toEqual(1);
    expect(events[0].title).toEqual("Chilham circular");
    expect(events[0].location).toEqual("Chilham Square, CT4 8BY");
    expect(events[0].description).toEqual("A gentle loop");
    expect(events[0].url).toEqual("https://example.org/walks/chilham-circular");
    expect(events[0].status).toEqual("CONFIRMED");
    expect(events[0].allDay).toEqual(false);
    expect(events[0].startsAt).toEqual(DateTime.fromISO("2026-08-15T09:00:00Z", {zone: "utc"}).toMillis());
    expect(events[0].endsAt).toEqual(DateTime.fromISO("2026-08-15T12:30:00Z", {zone: "utc"}).toMillis());
  });

  it("marks an all-day event when the start is a date only", () => {
    const events = parseIcsEvents([
      "BEGIN:VEVENT",
      "DTSTART;VALUE=DATE:20260819",
      "SUMMARY:Committee day",
      "END:VEVENT"
    ].join("\n"));
    expect(events[0].allDay).toEqual(true);
    expect(events[0].title).toEqual("Committee day");
    expect(events[0].startsAt).not.toBeNull();
  });

  it("uses the common name on an organiser line", () => {
    const events = parseIcsEvents([
      "BEGIN:VEVENT",
      "SUMMARY:Committee meeting",
      "ORGANIZER;CN=Nick Barrett:mailto:nick@example.org",
      "END:VEVENT"
    ].join("\n"));
    expect(events[0].organiser).toEqual("Nick Barrett");
  });

  it("returns nothing when the file has no events", () => {
    expect(parseIcsEvents("BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR")).toEqual([]);
  });

});

describe("parseIcsCalendar", () => {

  const teamsInvite = [
    "BEGIN:VCALENDAR",
    "METHOD:REQUEST",
    "PRODID:Microsoft Exchange Server",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    "UID:315409108105984@teams.microsoft.com",
    "DTSTART:20260826T100000Z",
    "DTEND:20260826T110000Z",
    "SUMMARY:Microsoft Teams Meeting",
    "ORGANIZER;CN=Ciaran Evans:mailto:Ciaran.Evans@ramblers.org.uk",
    "ATTENDEE;CN=Nick Barrett;RSVP=TRUE;PARTSTAT=NEEDS-ACTION:mailto:nick.barrett@ngx-ramblers.org.uk",
    "SEQUENCE:0",
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");

  it("reads the method, organiser email and attendees from a meeting request", () => {
    const invite = parseIcsCalendar(teamsInvite);
    expect(invite.method).toEqual(CalendarMethod.REQUEST);
    expect(invite.events[0].organiser).toEqual("Ciaran Evans");
    expect(invite.events[0].organiserEmail).toEqual("Ciaran.Evans@ramblers.org.uk");
    expect(invite.events[0].uid).toEqual("315409108105984@teams.microsoft.com");
    expect(invite.events[0].attendees).toEqual([{
      email: "nick.barrett@ngx-ramblers.org.uk",
      name: "Nick Barrett",
      rsvp: true,
      partStat: CalendarRsvpStatus.NEEDS_ACTION
    }]);
    expect(calendarInviteCanRsvp(invite)).toEqual(true);
  });

  it("does not offer RSVP on a published calendar or a cancellation", () => {
    expect(calendarInviteCanRsvp(parseIcsCalendar("BEGIN:VCALENDAR\nMETHOD:PUBLISH\nBEGIN:VEVENT\nSUMMARY:Walks\nEND:VEVENT\nEND:VCALENDAR"))).toEqual(false);
    expect(calendarInviteCanRsvp(parseIcsCalendar("BEGIN:VCALENDAR\nMETHOD:CANCEL\nBEGIN:VEVENT\nSUMMARY:Meeting\nEND:VEVENT\nEND:VCALENDAR"))).toEqual(false);
  });

});

describe("isCalendarFile", () => {

  it("recognises an ICS attachment by name or type", () => {
    expect(isCalendarFile("invite.ics", "application/octet-stream")).toEqual(true);
    expect(isCalendarFile("meeting", "text/calendar")).toEqual(true);
    expect(isCalendarFile("notes.pdf", "application/pdf")).toEqual(false);
  });

});

describe("calendarReplyDocument", () => {

  it("builds a METHOD:REPLY with the chosen part-stat", () => {
    const event = parseIcsEvents([
      "BEGIN:VEVENT",
      "UID:abc123@example.org",
      "DTSTART:20260826T100000Z",
      "DTEND:20260826T110000Z",
      "SUMMARY:Microsoft Teams Meeting",
      "ORGANIZER;CN=Ciaran Evans:mailto:Ciaran.Evans@ramblers.org.uk",
      "END:VEVENT"
    ].join("\n"))[0];
    const document = calendarReplyDocument(
      event,
      {email: "nick.barrett@ngx-ramblers.org.uk", name: "Nick Barrett"},
      CalendarRsvpStatus.ACCEPTED,
      DateTime.fromISO("2026-08-19T16:13:00Z", {zone: "utc"}).toMillis()
    );
    const unfolded = document.replace(/\r\n /g, "");
    expect(unfolded).toContain("METHOD:REPLY");
    expect(unfolded).toContain("UID:abc123@example.org");
    expect(unfolded).toContain("PARTSTAT=ACCEPTED");
    expect(unfolded).toContain("mailto:nick.barrett@ngx-ramblers.org.uk");
    expect(unfolded).toContain("ORGANIZER;CN=Ciaran Evans:mailto:Ciaran.Evans@ramblers.org.uk");
    expect(calendarRsvpSubject(CalendarRsvpStatus.ACCEPTED, "Microsoft Teams Meeting")).toEqual("Accepted: Microsoft Teams Meeting");
    expect(calendarRsvpSubject(CalendarRsvpStatus.DECLINED, "Microsoft Teams Meeting")).toEqual("Declined: Microsoft Teams Meeting");
  });

});

describe("calendarReplyResponses", () => {

  it("reads Accept, Decline and Maybe from a METHOD:REPLY", () => {
    const invite = parseIcsCalendar([
      "BEGIN:VCALENDAR",
      "METHOD:REPLY",
      "BEGIN:VEVENT",
      "UID:meeting-507f1f77bcf86cd799439011@ekwg.co.uk",
      "ATTENDEE;CN=Jordan Guest;PARTSTAT=ACCEPTED:mailto:guest@example.com",
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n"));
    expect(calendarReplyResponses(invite)).toEqual([{
      email: "guest@example.com",
      name: "Jordan Guest",
      status: CalendarRsvpStatus.ACCEPTED
    }]);
  });

  it("ignores a meeting request that is not a reply", () => {
    const invite = parseIcsCalendar([
      "BEGIN:VCALENDAR",
      "METHOD:REQUEST",
      "BEGIN:VEVENT",
      "UID:meeting-507f1f77bcf86cd799439011@ekwg.co.uk",
      "ATTENDEE;PARTSTAT=NEEDS-ACTION:mailto:guest@example.com",
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n"));
    expect(calendarReplyResponses(invite)).toEqual([]);
  });

});

describe("committeeFileIdFromMeetingUid", () => {

  it("reads the committee file id from a meeting UID", () => {
    expect(committeeFileIdFromMeetingUid("meeting-507f1f77bcf86cd799439011@ekwg.co.uk"))
      .toEqual("507f1f77bcf86cd799439011");
    expect(committeeFileIdFromMeetingUid("315409108105984@teams.microsoft.com")).toBeNull();
  });

});

describe("meetingRoomFromCalendarEvent", () => {

  it("reads the guest room from the join URL", () => {
    expect(meetingRoomFromCalendarEvent({
      title: "Committee meeting",
      startsAt: null,
      endsAt: null,
      allDay: false,
      location: null,
      description: null,
      url: "https://www.ekwg.co.uk/video-meetings/guest/committee-meeting-18-august-2026",
      status: null,
      organiser: null,
      organiserEmail: null,
      uid: null,
      sequence: 0,
      attendees: []
    })).toEqual("committee-meeting-18-august-2026");
  });

});
