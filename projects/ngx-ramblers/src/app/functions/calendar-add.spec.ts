import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { CalendarApp, CalendarPreviewEvent, DeviceKind } from "../models/inbox.model";
import { ExtendedGroupEvent } from "../models/group-event.model";
import { WalkStatus } from "../models/ramblers-walks-manager";
import { calendarAppLabel, calendarAppsForDevice, calendarEventFromGroupEvent, calendarHrefFor, deviceKindFromUserAgent, localCalendarHref, googleCalendarUrl, outlookCalendarUrl } from "./calendar-add";

function event(overrides: Partial<CalendarPreviewEvent> = {}): CalendarPreviewEvent {
  return {
    title: "Chilham circular",
    startsAt: DateTimeMillis.START,
    endsAt: DateTimeMillis.END,
    allDay: false,
    location: "Chilham Square, CT4 8BY",
    description: "A gentle loop",
    url: null,
    status: "CONFIRMED",
    organiser: null,
    organiserEmail: null,
    uid: "abc123@example.org",
    sequence: 0,
    attendees: [],
    ...overrides
  };
}

const DateTimeMillis = {
  START: 1786770000000,
  END: 1786782600000
};

describe("deviceKindFromUserAgent", () => {

  it("treats iPhone and Mac as Apple", () => {
    expect(deviceKindFromUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toEqual(DeviceKind.APPLE);
    expect(deviceKindFromUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toEqual(DeviceKind.APPLE);
  });

  it("treats Windows as Windows", () => {
    expect(deviceKindFromUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toEqual(DeviceKind.WINDOWS);
  });

  it("treats Android as Android", () => {
    expect(deviceKindFromUserAgent("Mozilla/5.0 (Linux; Android 14)")).toEqual(DeviceKind.ANDROID);
  });

  it("prefers the platform hint when the user agent disagrees", () => {
    expect(deviceKindFromUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "Windows")).toEqual(DeviceKind.WINDOWS);
    expect(deviceKindFromUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "macOS")).toEqual(DeviceKind.APPLE);
    expect(deviceKindFromUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "iOS")).toEqual(DeviceKind.APPLE);
  });

});

describe("calendarAppsForDevice", () => {

  it("puts the local calendar first on Apple and Windows, and offers Google and Outlook after it", () => {
    expect(calendarAppsForDevice(DeviceKind.APPLE)).toEqual([CalendarApp.LOCAL, CalendarApp.GOOGLE, CalendarApp.OUTLOOK]);
    expect(calendarAppsForDevice(DeviceKind.WINDOWS)).toEqual([CalendarApp.LOCAL, CalendarApp.GOOGLE, CalendarApp.OUTLOOK]);
  });

  it("puts Google first on Android", () => {
    expect(calendarAppsForDevice(DeviceKind.ANDROID)).toEqual([CalendarApp.GOOGLE, CalendarApp.LOCAL, CalendarApp.OUTLOOK]);
  });

});

describe("calendarAppLabel", () => {

  it("names the local app Calendar and the web calendars by product", () => {
    expect(calendarAppLabel(CalendarApp.LOCAL)).toEqual("Add to Calendar");
    expect(calendarAppLabel(CalendarApp.GOOGLE)).toEqual("Add to Google Calendar");
    expect(calendarAppLabel(CalendarApp.OUTLOOK)).toEqual("Add to Outlook");
  });

});

describe("googleCalendarUrl", () => {

  it("builds a template link with UTC start and end", () => {
    const url = googleCalendarUrl(event());
    expect(url).toContain("https://calendar.google.com/calendar/render?");
    expect(url).toContain("action=TEMPLATE");
    expect(url).toContain("text=Chilham+circular");
    expect(url).toContain("location=Chilham+Square%2C+CT4+8BY");
  });

  it("uses an exclusive date range for an all-day event", () => {
    const url = googleCalendarUrl(event({
      allDay: true,
      startsAt: DateTimeMillis.START,
      endsAt: null
    }));
    expect(url).toContain("dates=20260815%2F20260816");
  });

});

describe("outlookCalendarUrl", () => {

  it("builds an Outlook compose link", () => {
    const url = outlookCalendarUrl(event());
    expect(url).toContain("https://outlook.live.com/calendar/0/deeplink/compose?");
    expect(url).toContain("rru=addevent");
    expect(url).toContain("subject=Chilham+circular");
  });

});

describe("calendarEventFromGroupEvent", () => {

  it("maps a walk into a calendar event with a three-hour default when there is no end", () => {
    const walk = {
      id: "walk-1",
      groupEvent: {
        title: "Chilham circular",
        start_date_time: "2026-08-15T10:00:00+01:00",
        end_date_time: "",
        description: "A gentle loop",
        start_location: {description: "Chilham Square", postcode: "CT4 8BY"},
        url: "https://example.org/walks/chilham-circular",
        status: WalkStatus.CONFIRMED,
        walk_leader: {name: "Nick Barrett"}
      }
    } as ExtendedGroupEvent;
    const mapped = calendarEventFromGroupEvent(walk);
    expect(mapped?.title).toEqual("Chilham circular");
    expect(mapped?.location).toEqual("Chilham Square, CT4 8BY");
    expect(mapped?.description).toEqual("A gentle loop");
    expect(mapped?.startsAt).toEqual(DateTime.fromISO("2026-08-15T10:00:00+01:00").toMillis());
    expect(mapped?.endsAt).toEqual(DateTime.fromISO("2026-08-15T13:00:00+01:00").toMillis());
    expect(mapped?.organiser).toEqual("Nick Barrett");
    expect(mapped?.url).toEqual("https://example.org/walks/chilham-circular");
  });

});

describe("localCalendarHref", () => {

  const chromeMac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
  const safariMac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
  const origin = "https://www.ekwg.co.uk";

  it("hands Chrome on a Mac a webcal link so Calendar.app opens instead of a download", () => {
    expect(localCalendarHref("/api/calendar/event/walk-1", {userAgent: chromeMac, origin}))
      .toEqual("webcal://www.ekwg.co.uk/api/calendar/event/walk-1");
  });

  it("keeps an https link in Safari so Calendar.app can import the event", () => {
    expect(localCalendarHref("/api/calendar/event/walk-1", {userAgent: safariMac, origin}))
      .toEqual("https://www.ekwg.co.uk/api/calendar/event/walk-1");
  });

});

describe("calendarHrefFor", () => {

  it("uses the file for the local calendar and a web template for Google and Outlook", () => {
    const fileUrl = "https://example.org/meeting.ics";
    expect(calendarHrefFor(CalendarApp.LOCAL, event(), fileUrl)).toEqual(fileUrl);
    expect(calendarHrefFor(CalendarApp.GOOGLE, event(), fileUrl)).toContain("calendar.google.com");
    expect(calendarHrefFor(CalendarApp.OUTLOOK, event(), fileUrl)).toContain("outlook.live.com");
  });

  it("hides Google and Outlook when the file has no dated event", () => {
    expect(calendarHrefFor(CalendarApp.GOOGLE, null, "https://example.org/meeting.ics")).toBeNull();
    expect(calendarHrefFor(CalendarApp.OUTLOOK, null, "https://example.org/meeting.ics")).toBeNull();
    expect(calendarHrefFor(CalendarApp.LOCAL, null, "https://example.org/meeting.ics")).toEqual("https://example.org/meeting.ics");
  });

});
