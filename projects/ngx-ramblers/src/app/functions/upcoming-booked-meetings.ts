import { CommitteeFile, CommitteeFileType, isAdHocVideoCall, isBookedMeetingFile, isMeetingFileType } from "../models/committee.model";
import { RecentVideoCall, UpcomingBookedMeeting } from "../models/video-meeting.model";
import { committeeFileMeetingTitle } from "./committee-meeting-agenda";

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
    .filter(file => isBookedMeetingFile(file, fileTypes))
    .map(file => ({
      title: committeeFileMeetingTitle(file),
      startTime: file.eventDate,
      committeeFileId: file.id,
      room: file.meeting?.room
    }))
    .sort((left, right) => left.startTime - right.startTime);
}

export function recentVideoCalls(committeeFiles: CommitteeFile[]): RecentVideoCall[] {
  return (committeeFiles || [])
    .filter(file => isAdHocVideoCall(file))
    .map(file => ({
      id: file.id,
      room: file.meeting?.room || "",
      title: committeeFileMeetingTitle(file),
      startedAt: file.meeting?.startedAt || file.eventDate || 0
    }))
    .sort((left, right) => right.startedAt - left.startedAt);
}
