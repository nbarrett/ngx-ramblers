import {
  committeeMeetingTypesFromFileTypes,
  CommitteeFile,
  CommitteeFileMeetingRole,
  CommitteeMeetingFormat,
  isAdHocVideoCall,
  isBookedMeetingFile,
  OTHER_MEETING_CATEGORY
} from "./committee.model";

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

describe("isBookedMeetingFile", () => {
  const fileTypes = [
    {description: "AGM Agenda", meetingRole: CommitteeFileMeetingRole.AGENDA, meetingCategory: "AGM"},
    {description: "AGM Minutes", meetingRole: CommitteeFileMeetingRole.MINUTES, meetingCategory: "AGM"},
    {description: "Committee Meeting Agenda", meetingRole: CommitteeFileMeetingRole.AGENDA, meetingCategory: "Committee Meeting"},
    {description: "Committee Meeting Minutes", meetingRole: CommitteeFileMeetingRole.MINUTES, meetingCategory: "Committee Meeting"},
    {description: OTHER_MEETING_CATEGORY}
  ];

  it("includes agenda files and booked Other meetings, but not minutes or Other documents", () => {
    const agenda = {fileType: "Committee Meeting Agenda"} as CommitteeFile;
    const agm = {fileType: "AGM Agenda"} as CommitteeFile;
    const otherMeeting = {
      fileType: OTHER_MEETING_CATEGORY,
      meeting: {format: CommitteeMeetingFormat.ONLINE}
    } as CommitteeFile;
    const otherDocument = {fileType: OTHER_MEETING_CATEGORY} as CommitteeFile;
    const minutes = {
      fileType: "Committee Meeting Minutes",
      meeting: {format: CommitteeMeetingFormat.ONLINE}
    } as CommitteeFile;
    const statements = {fileType: "Financial Statements"} as CommitteeFile;
    const adHocCall = {
      fileType: "",
      meeting: {format: CommitteeMeetingFormat.ONLINE, title: "Ramblers meeting", room: "ngx-room"}
    } as CommitteeFile;
    expect(isBookedMeetingFile(agenda, fileTypes)).toBe(true);
    expect(isBookedMeetingFile(agm, fileTypes)).toBe(true);
    expect(isBookedMeetingFile(otherMeeting, fileTypes)).toBe(true);
    expect(isBookedMeetingFile(otherDocument, fileTypes)).toBe(false);
    expect(isBookedMeetingFile(minutes, fileTypes)).toBe(false);
    expect(isBookedMeetingFile(statements, fileTypes)).toBe(false);
    expect(isBookedMeetingFile(adHocCall, fileTypes)).toBe(false);
  });
});

describe("isAdHocVideoCall", () => {

  it("is a start-now video room with no committee file type", () => {
    expect(isAdHocVideoCall({
      fileType: "",
      meeting: {format: CommitteeMeetingFormat.ONLINE, room: "ngx-room"}
    } as CommitteeFile)).toBe(true);
    expect(isAdHocVideoCall({
      fileType: "Committee Meeting Agenda",
      meeting: {format: CommitteeMeetingFormat.ONLINE, room: "ngx-room"}
    } as CommitteeFile)).toBe(false);
    expect(isAdHocVideoCall({
      fileType: "",
      meeting: {format: CommitteeMeetingFormat.ONLINE}
    } as CommitteeFile)).toBe(false);
  });
});
