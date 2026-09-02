import { describe, expect, it } from "vitest";
import { CommitteeFile, CommitteeFileMeetingRole, CommitteeFileType, CommitteeMeetingFormat, OTHER_MEETING_CATEGORY } from "../models/committee.model";
import { lastMeetingEventDate, recentVideoCalls, upcomingBookedMeetings } from "./upcoming-booked-meetings";

const fileTypes: CommitteeFileType[] = [
  {description: "Agenda", meetingRole: CommitteeFileMeetingRole.AGENDA, meetingCategory: "Committee Meeting"},
  {description: "Minutes", meetingRole: CommitteeFileMeetingRole.MINUTES, meetingCategory: "Committee Meeting"},
  {description: "AGM Agenda", meetingRole: CommitteeFileMeetingRole.AGENDA, meetingCategory: "AGM"},
  {description: "AGM Minutes", meetingRole: CommitteeFileMeetingRole.MINUTES, meetingCategory: "AGM"},
  {description: "Import Template"}
];

describe("upcomingBookedMeetings", () => {

  it("keeps future agendas and drops past ones, minutes and non-meeting files", () => {
    const files = [
      {id: "past", eventDate: 100, fileType: "Agenda", document: {title: "Past agenda"}} as CommitteeFile,
      {id: "aug", eventDate: 200, fileType: "Agenda", document: {title: "August agenda"}} as CommitteeFile,
      {id: "nov", eventDate: 500, fileType: "Agenda", document: {title: "November agenda"}} as CommitteeFile,
      {id: "mins", eventDate: 600, fileType: "Minutes", document: {title: "Future minutes"}} as CommitteeFile,
      {id: "import", eventDate: 700, fileType: "Import Template"} as CommitteeFile
    ];
    const upcoming = upcomingBookedMeetings(files, 150, fileTypes);
    expect(upcoming.map(item => item.title)).toEqual(["August agenda", "November agenda"]);
  });

  it("uses the latest agenda or minutes as the last meeting, not other file types", () => {
    const files = [
      {eventDate: 300, fileType: "Import Template"} as CommitteeFile,
      {eventDate: 200, fileType: "Agenda"} as CommitteeFile,
      {eventDate: 100, fileType: "Minutes"} as CommitteeFile
    ];
    expect(lastMeetingEventDate(files, fileTypes)).toBe(200);
  });

  it("includes booked Other meetings on the calendar without listing Other documents", () => {
    const files = [
      {id: "aug", eventDate: 200, fileType: "Agenda", document: {title: "August agenda"}} as CommitteeFile,
      {
        id: "other-meeting",
        eventDate: 300,
        fileType: OTHER_MEETING_CATEGORY,
        document: {title: "Video call"},
        meeting: {format: CommitteeMeetingFormat.ONLINE}
      } as CommitteeFile,
      {id: "other-doc", eventDate: 400, fileType: OTHER_MEETING_CATEGORY, document: {title: "Random paper"}} as CommitteeFile,
      {
        id: "mins",
        eventDate: 500,
        fileType: "Minutes",
        document: {title: "Future minutes"},
        meeting: {format: CommitteeMeetingFormat.ONLINE}
      } as CommitteeFile
    ];
    const upcoming = upcomingBookedMeetings(files, 150, fileTypes);
    expect(upcoming.map(item => item.title)).toEqual(["August agenda", "Video call"]);
  });

  it("does not treat an ad-hoc video call as a booked committee meeting", () => {
    const files = [{
      id: "call",
      eventDate: 200,
      fileType: "",
      meeting: {format: CommitteeMeetingFormat.ONLINE, title: "Ramblers meeting", room: "ngx-room"}
    }] as CommitteeFile[];
    expect(upcomingBookedMeetings(files, 150, fileTypes)).toEqual([]);
  });

});

describe("recentVideoCalls", () => {

  it("lists start-now video rooms newest first and drops booked meetings", () => {
    const files = [
      {
        id: "old",
        eventDate: 100,
        fileType: "",
        meeting: {format: CommitteeMeetingFormat.ONLINE, title: "Ramblers meeting", room: "ngx-old"}
      },
      {
        id: "new",
        eventDate: 300,
        fileType: "",
        meeting: {format: CommitteeMeetingFormat.ONLINE, title: "Video call, Sunday 30 August 2026", room: "ngx-new"}
      },
      {
        id: "booked",
        eventDate: 400,
        fileType: "Agenda",
        meeting: {format: CommitteeMeetingFormat.ONLINE, title: "Committee Meeting", room: "ngx-booked"}
      }
    ] as CommitteeFile[];
    expect(recentVideoCalls(files)).toEqual([
      {id: "new", room: "ngx-new", title: "Video call, Sunday 30 August 2026", startedAt: 300},
      {id: "old", room: "ngx-old", title: "Unnamed meeting", startedAt: 100}
    ]);
  });

});
