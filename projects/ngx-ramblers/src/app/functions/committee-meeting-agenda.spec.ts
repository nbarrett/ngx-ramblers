import { committeeMeetingAgendaMarkdown, numberedAgendaItemsFromGenerated } from "./committee-meeting-agenda";

describe("committeeMeetingAgendaMarkdown", () => {

  it("puts date, location and the meeting link above the agenda items", () => {
    expect(committeeMeetingAgendaMarkdown({
      heading: "Committee Meeting",
      dateLine: "Thursday 20 August 2026, 7:00 pm",
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
