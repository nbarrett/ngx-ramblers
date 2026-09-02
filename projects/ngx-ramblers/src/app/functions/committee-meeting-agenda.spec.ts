import { describe, expect, it } from "vitest";
import { CommitteeFile, CommitteeMeetingFormat } from "../models/committee.model";
import {
  committeeFileMeetingTitle,
  committeeMeetingAgendaMarkdown,
  committeeMeetingHeading,
  committeeMeetingLocationLine,
  committeeMeetingMinutesBody,
  committeeMeetingMinutesMarkdown,
  displayMeetingTitle,
  numberedAgendaItemsFromGenerated,
  withCommitteeMeetingDateLine,
  withCommitteeMeetingLink,
  withCommitteeMeetingLocationLine
} from "./committee-meeting-agenda";

describe("committeeMeetingLocationLine", () => {

  it("describes online, hybrid and in-person meetings", () => {
    expect(committeeMeetingLocationLine(CommitteeMeetingFormat.ONLINE, "")).toEqual("Online");
    expect(committeeMeetingLocationLine(CommitteeMeetingFormat.HYBRID, "Village Hall")).toEqual("Online, and in person at Village Hall");
    expect(committeeMeetingLocationLine(CommitteeMeetingFormat.IN_PERSON, "Village Hall")).toEqual("Village Hall");
  });

});

describe("committeeMeetingHeading", () => {

  it("prefers the meeting type and otherwise uses the title before the date", () => {
    expect(committeeMeetingHeading("Committee Meeting, Sunday 30 August 2026", "Committee Meeting")).toEqual("Committee Meeting");
    expect(committeeMeetingHeading("Video call, Sunday 30 August 2026", null)).toEqual("Video call");
    expect(committeeMeetingHeading("Ramblers meeting", null)).toEqual("Committee meeting");
  });

});

describe("displayMeetingTitle", () => {

  it("treats the old Ramblers meeting default as empty", () => {
    expect(displayMeetingTitle("Ramblers meeting")).toEqual("");
    expect(displayMeetingTitle("Video call, Sunday 30 August 2026")).toEqual("Video call, Sunday 30 August 2026");
  });

});

describe("committeeFileMeetingTitle", () => {

  it("falls back to Unnamed meeting when the stored title is the old default", () => {
    expect(committeeFileMeetingTitle({
      fileType: "",
      meeting: {format: CommitteeMeetingFormat.ONLINE, title: "Ramblers meeting"}
    } as CommitteeFile)).toEqual("Unnamed meeting");
    expect(committeeFileMeetingTitle({
      fileType: "Agenda",
      document: {title: "August agenda"}
    } as CommitteeFile)).toEqual("August agenda");
  });

});

describe("committeeMeetingMinutesMarkdown", () => {

  it("wraps the written-up body in the same date and location header as an agenda", () => {
    expect(committeeMeetingMinutesMarkdown({
      heading: "Committee Meeting",
      dateLine: "Sunday 30 August 2026, 9:07 pm - 9:11 pm",
      location: "Online",
      bodyMarkdown: "## Discussion\n- The react button does not work."
    })).toEqual([
      "# Committee Meeting",
      "",
      "## Minutes",
      "",
      "**Date:** Sunday 30 August 2026, 9:07 pm - 9:11 pm",
      "",
      "**Location:** Online",
      "",
      "## Discussion",
      "- The react button does not work.",
      ""
    ].join("\n"));
  });

  it("does not wrap an already headed minutes document a second time", () => {
    const first = committeeMeetingMinutesMarkdown({
      heading: "Committee Meeting",
      dateLine: "Sunday 30 August 2026, 9:07 pm - 9:11 pm",
      location: "Online",
      bodyMarkdown: "## Discussion\n- One"
    });
    expect(committeeMeetingMinutesBody(first)).toEqual("## Discussion\n- One");
    expect(committeeMeetingMinutesMarkdown({
      heading: "Committee Meeting",
      dateLine: "Sunday 30 August 2026, 9:20 pm - 9:30 pm",
      location: "Online",
      bodyMarkdown: first
    })).toContain("**Date:** Sunday 30 August 2026, 9:20 pm - 9:30 pm");
    expect(committeeMeetingMinutesMarkdown({
      heading: "Committee Meeting",
      dateLine: "Sunday 30 August 2026, 9:20 pm - 9:30 pm",
      location: "Online",
      bodyMarkdown: first
    })).not.toContain("9:07 pm");
  });

});

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
