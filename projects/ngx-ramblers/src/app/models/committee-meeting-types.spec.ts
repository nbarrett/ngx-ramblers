import { committeeMeetingTypesFromFileTypes, CommitteeFileMeetingRole } from "./committee.model";

describe("committeeMeetingTypesFromFileTypes", () => {

  it("pairs each category's agenda and minutes file types and always appends Other", () => {
    expect(committeeMeetingTypesFromFileTypes([
      {description: "AGM Agenda", meetingRole: CommitteeFileMeetingRole.AGENDA, meetingCategory: "AGM"},
      {description: "AGM Minutes", meetingRole: CommitteeFileMeetingRole.MINUTES, meetingCategory: "AGM"},
      {description: "Committee Meeting Agenda", meetingRole: CommitteeFileMeetingRole.AGENDA, meetingCategory: "Committee Meeting"},
      {description: "Committee Meeting Minutes", meetingRole: CommitteeFileMeetingRole.MINUTES, meetingCategory: "Committee Meeting"},
      {description: "Financial Statements"}
    ])).toEqual([
      {description: "AGM", agendaFileType: "AGM Agenda", minutesFileType: "AGM Minutes"},
      {description: "Committee Meeting", agendaFileType: "Committee Meeting Agenda", minutesFileType: "Committee Meeting Minutes"},
      {description: "Other", agendaFileType: null, minutesFileType: null}
    ]);
  });

  it("returns just Other when no file types are classified as meeting documents", () => {
    expect(committeeMeetingTypesFromFileTypes([{description: "Financial Statements"}])).toEqual([
      {description: "Other", agendaFileType: null, minutesFileType: null}
    ]);
  });
});
