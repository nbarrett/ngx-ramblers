import { describe, expect, it } from "vitest";
import { CommitteeFile } from "../models/committee.model";
import { VideoMeeting } from "../models/video-meeting.model";
import { lastFileDateForAgendaType, lastMeetingEventDate, mergeUpcomingBookedMeetings } from "./upcoming-booked-meetings";

describe("mergeUpcomingBookedMeetings", () => {

  it("keeps future video meetings and agendas, and drops past ones", () => {
    const meetings = [
      {title: "Past call", startTime: 100, committeeFileId: "old"} as VideoMeeting,
      {title: "November committee", startTime: 500, committeeFileId: "nov"} as VideoMeeting
    ];
    const files = [
      {id: "aug", eventDate: 200, fileType: "Agenda", document: {title: "August agenda"}} as CommitteeFile,
      {id: "nov", eventDate: 500, fileType: "Agenda", document: {title: "November agenda"}} as CommitteeFile,
      {id: "mins", eventDate: 600, fileType: "Minutes", document: {title: "Old minutes"}} as CommitteeFile
    ];
    const merged = mergeUpcomingBookedMeetings(meetings, files, 150, ["Agenda"]);
    expect(merged.map(item => item.title)).toEqual(["August agenda", "November committee"]);
  });

  it("uses the latest agenda or minutes as the last meeting, not other file types", () => {
    const files = [
      {eventDate: 300, fileType: "Import Template"} as CommitteeFile,
      {eventDate: 200, fileType: "Agenda"} as CommitteeFile,
      {eventDate: 100, fileType: "Minutes"} as CommitteeFile
    ];
    expect(lastMeetingEventDate(files, ["Agenda"])).toBe(200);
    expect(lastMeetingEventDate(files, [])).toBe(200);
  });

  it("finds the latest file for one agenda type and its minutes", () => {
    const files = [
      {eventDate: 100, fileType: "AGM Agenda"} as CommitteeFile,
      {eventDate: 300, fileType: "AGM Minutes"} as CommitteeFile,
      {eventDate: 400, fileType: "Committee Meeting Agenda"} as CommitteeFile
    ];
    expect(lastFileDateForAgendaType(files, "AGM Agenda")).toBe(300);
    expect(lastFileDateForAgendaType(files, "Committee Meeting Agenda")).toBe(400);
  });

});
