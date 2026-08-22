import { CommitteeFile, CommitteeFileType, isAgendaFileType, isMeetingFileType } from "../models/committee.model";
import { UpcomingBookedMeeting } from "../models/video-meeting.model";

export function lastMeetingEventDate(files: CommitteeFile[], fileTypes: CommitteeFileType[]): number | null {
  const dates = (files || [])
    .filter(file => isMeetingFileType(file.fileType, fileTypes))
    .map(file => file.eventDate || 0)
    .filter(date => date > 0)
    .sort((left, right) => right - left);
  return dates[0] || null;
}

export function upcomingBookedMeetings(
  committeeFiles: CommitteeFile[],
  fromTime: number,
  fileTypes: CommitteeFileType[]
): UpcomingBookedMeeting[] {
  return (committeeFiles || [])
    .filter(file => (file.eventDate || 0) >= fromTime)
    .filter(file => isAgendaFileType(file.fileType, fileTypes))
    .map(file => ({
      title: file.document?.title || file.fileNameData?.title || file.meeting?.title || file.fileType || "Committee meeting",
      startTime: file.eventDate,
      committeeFileId: file.id,
      room: file.meeting?.room
    }))
    .sort((left, right) => left.startTime - right.startTime);
}
