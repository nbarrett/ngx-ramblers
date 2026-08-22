import { committeeMeetingAgendaMarkdown, numberedAgendaItemsFromGenerated, withCommitteeMeetingDateLine, withCommitteeMeetingLink, withCommitteeMeetingLocationLine } from "./committee-meeting-agenda";

describe("committeeMeetingAgendaMarkdown", () => {

  it("puts date, location and the meeting link above the agenda items for an online meeting", () => {
    expect(committeeMeetingAgendaMarkdown({
      heading: "Committee Meeting",
      dateLine: "Thursday 20 August 2026, 7:00 pm",
      location: "Online",
      joinUrl: "http://localhost:4200/video-meetings/guest/ngx-room",
      itemsMarkdown: "1. Apologies for absence\n2. Minutes of the previous meeting"
    })).toEqual([
      "# Committee Meeting",
      "",
      "## Agenda",
      "",
      "**Date:** Thursday 20 August 2026, 7:00 pm",
      "",
      "**Location:** Online",
      "",
      "**Meeting link:** [http://localhost:4200/video-meetings/guest/ngx-room](http://localhost:4200/video-meetings/guest/ngx-room)",
      "",
      "1. Apologies for absence",
      "2. Minutes of the previous meeting",
      ""
    ].join("\n"));
  });

  it("omits the meeting link line for an in-person meeting with a venue", () => {
    const markdown = committeeMeetingAgendaMarkdown({
      heading: "Committee Meeting",
      dateLine: "Thursday 20 August 2026, 7:00 pm",
      location: "Village Hall, High Street",
      itemsMarkdown: "1. Apologies for absence"
    });
    expect(markdown).toContain("**Location:** Village Hall, High Street");
    expect(markdown).not.toContain("Meeting link");
  });

});

describe("numberedAgendaItemsFromGenerated", () => {

  it("keeps the numbered list and drops a generated title", () => {
    expect(numberedAgendaItemsFromGenerated([
      "## Committee Meeting meeting — Thursday 20 August 2026",
      "",
      "1. Apologies for absence",
      "2. Treasurer's report"
    ].join("\n"))).toEqual("1. Apologies for absence\n2. Treasurer's report");
  });

  it("returns null when there is no numbered list", () => {
    expect(numberedAgendaItemsFromGenerated("Just a heading")).toBeNull();
  });

});

describe("withCommitteeMeetingDateLine", () => {

  it("replaces the date line and leaves the rest of the agenda", () => {
    const markdown = committeeMeetingAgendaMarkdown({
      heading: "Committee Meeting",
      dateLine: "Thursday 20 August 2026, 7:00 pm",
      location: "Online",
      joinUrl: "http://localhost:4200/video-meetings/guest/ngx-room",
      itemsMarkdown: "1. Apologies for absence"
    });
    const updated = withCommitteeMeetingDateLine(markdown, "Friday 18 September 2026, 7:30 pm");
    expect(updated).toContain("**Date:** Friday 18 September 2026, 7:30 pm");
    expect(updated).toContain("1. Apologies for absence");
    expect(updated).not.toContain("Thursday 20 August 2026, 7:00 pm");
  });

});

describe("withCommitteeMeetingLocationLine and withCommitteeMeetingLink", () => {

  it("switches an online agenda to in-person: updates location and removes the link", () => {
    const online = committeeMeetingAgendaMarkdown({
      heading: "Committee Meeting",
      dateLine: "Thursday 20 August 2026, 7:00 pm",
      location: "Online",
      joinUrl: "http://localhost:4200/video-meetings/guest/ngx-room",
      itemsMarkdown: "1. Apologies for absence"
    });
    const relocated = withCommitteeMeetingLocationLine(online, "Village Hall");
    const inPerson = withCommitteeMeetingLink(relocated, "");
    expect(inPerson).toContain("**Location:** Village Hall");
    expect(inPerson).not.toContain("Meeting link");
    expect(inPerson).toContain("1. Apologies for absence");
  });

});
