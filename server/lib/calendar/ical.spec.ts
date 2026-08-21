import expect from "expect";
import { describe, it } from "mocha";
import { escapeIcalText, foldIcalLine, icalDocument, meetingIcalDocument } from "./ical";
import { ExtendedGroupEvent } from "../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { RamblersEventType, WalkStatus } from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";

describe("ical", () => {

  const config = {group: {href: "https://example.org", shortName: "Canterbury"}} as unknown as SystemConfig;

  function walk(overrides: any = {}): ExtendedGroupEvent {
    return {
      id: "abc123",
      groupEvent: {
        title: "Chilham circular",
        description: "A gentle loop",
        url: "chilham-circular",
        item_type: RamblersEventType.GROUP_WALK,
        status: WalkStatus.CONFIRMED,
        start_date_time: "2026-08-15T09:00:00Z",
        end_date_time: "2026-08-15T12:30:00Z",
        start_location: {description: "Chilham Square", postcode: "CT4 8BY", latitude: 51.24, longitude: 0.96},
        ...overrides
      }
    } as unknown as ExtendedGroupEvent;
  }

  it("escapes the characters the iCalendar format reserves", () => {
    expect(escapeIcalText("Meet at the Woolpack; bring boots, please\nSee you there"))
      .toEqual("Meet at the Woolpack\\; bring boots\\, please\\nSee you there");
  });

  it("folds a long line onto continuation lines starting with a space", () => {
    const folded = foldIcalLine(`SUMMARY:${"a".repeat(200)}`);
    const lines = folded.split("\r\n");
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[0].length).toBeLessThanOrEqual(75);
    expect(lines[1].startsWith(" ")).toEqual(true);
  });

  it("leaves a short line unfolded", () => {
    expect(foldIcalLine("VERSION:2.0")).toEqual("VERSION:2.0");
  });

  it("produces a calendar with the expected envelope and event", () => {
    const document = icalDocument([walk()], config, "https://example.org", "Canterbury walks and events");
    expect(document).toContain("BEGIN:VCALENDAR");
    expect(document).toContain("VERSION:2.0");
    expect(document).toContain("X-WR-CALNAME:Canterbury walks and events");
    expect(document).toContain("BEGIN:VEVENT");
    expect(document).toContain("UID:abc123@example.org");
    expect(document).toContain("DTSTART:20260815T090000Z");
    expect(document).toContain("DTEND:20260815T123000Z");
    expect(document).toContain("SUMMARY:Chilham circular");
    expect(document).toContain("LOCATION:Chilham Square\\, CT4 8BY");
    expect(document).toContain("GEO:51.24;0.96");
    expect(document).toContain("URL:https://example.org/walks/chilham-circular");
    expect(document).toContain("STATUS:CONFIRMED");
    expect(document).toContain("END:VCALENDAR");
  });

  it("marks a cancelled walk as cancelled so subscribers see the change", () => {
    const document = icalDocument([walk({status: WalkStatus.CANCELLED})], config, "https://example.org", "Calendar");
    expect(document).toContain("STATUS:CANCELLED");
  });

  it("defaults the end time when the event has none", () => {
    const document = icalDocument([walk({end_date_time: null})], config, "https://example.org", "Calendar");
    expect(document).toContain("DTEND:20260815T120000Z");
  });

  it("separates lines with CRLF as the format requires", () => {
    const document = icalDocument([walk()], config, "https://example.org", "Calendar");
    expect(document.includes("\r\n")).toEqual(true);
    expect(document.endsWith("\r\n")).toEqual(true);
  });

  it("uses the social events path for a group event", () => {
    const socialEvent = walk({item_type: RamblersEventType.GROUP_EVENT, url: "summer-barbecue"});
    const document = icalDocument([socialEvent], config, "https://example.org", "Calendar");
    expect(document).toContain("URL:https://example.org/social/summer-barbecue");
  });
});

describe("meetingIcalDocument", () => {

  const START = 1789900800000;
  const JOIN = "https://example.org/video-meetings/guest/r";

  it("wraps a single VEVENT in a VCALENDAR with the meeting summary and uid", () => {
    const ics = meetingIcalDocument({uid: "meeting-r@example.org", title: "Committee Meeting", startTime: START, url: JOIN}, "EKWG meetings");
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("SUMMARY:Committee Meeting");
    expect(ics).toContain("UID:meeting-r@example.org");
  });

  it("uses METHOD:REQUEST with an organiser and a non-RSVP attendee when an organiser email is given", () => {
    const ics = meetingIcalDocument({
      uid: "u", title: "AGM", startTime: START, url: JOIN,
      organiserName: "The Secretary", organiserEmail: "secretary@example.com"
    }, "cal");
    expect(ics).toContain("METHOD:REQUEST");
    expect(ics).toContain("ORGANIZER;CN=The Secretary:mailto:secretary@example.com");
    expect(ics).toContain("ATTENDEE;CN=The Secretary;RSVP=FALSE:mailto:secretary@example.com");
  });

  it("falls back to METHOD:PUBLISH with no organiser when no organiser email is given", () => {
    const ics = meetingIcalDocument({uid: "u", title: "Open call", startTime: START, url: JOIN}, "cal");
    expect(ics).toContain("METHOD:PUBLISH");
    expect(ics).not.toContain("ORGANIZER");
    expect(ics).not.toContain("ATTENDEE");
  });

  it("includes the join link and a UTC start and end time", () => {
    const ics = meetingIcalDocument({uid: "u", title: "Call", startTime: START, url: JOIN}, "cal");
    expect(ics).toContain(`URL:${JOIN}`);
    expect(ics).toMatch(/DTSTART:\d{8}T\d{6}Z/);
    expect(ics).toMatch(/DTEND:\d{8}T\d{6}Z/);
  });

});
