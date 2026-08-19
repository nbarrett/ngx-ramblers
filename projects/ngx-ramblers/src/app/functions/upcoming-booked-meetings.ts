import { CommitteeFile } from "../models/committee.model";
import { UpcomingBookedMeeting, VideoMeeting } from "../models/video-meeting.model";

export function isAgendaFileType(fileType: string, agendaTypes: string[]): boolean {
  return /agenda/i.test(fileType || "") || agendaTypes.includes(fileType);
}

export function isMeetingRelatedFileType(fileType: string, agendaTypes: string[]): boolean {
  if (agendaTypes.length) {
    return agendaTypes.includes(fileType) || /minutes/i.test(fileType || "");
  } else {
    return /agenda|minutes/i.test(fileType || "");
  }
}

export function lastFileDateForAgendaType(files: CommitteeFile[], agendaFileType: string): number | null {
  if (!agendaFileType) {
    return null;
  } else {
    const minutesType = agendaFileType.replace(/agenda/i, "Minutes");
    const dates = (files || [])
      .filter(file => file.fileType === agendaFileType || file.fileType === minutesType)
      .map(file => file.eventDate || 0)
      .filter(date => date > 0)
      .sort((left, right) => right - left);
    return dates[0] || null;
  }
}

export function lastMeetingEventDate(files: CommitteeFile[], agendaTypes: string[]): number | null {
  const dates = (files || [])
    .filter(file => isMeetingRelatedFileType(file.fileType, agendaTypes))
    .map(file => file.eventDate || 0)
    .filter(date => date > 0)
    .sort((left, right) => right - left);
  return dates[0] || null;
}

export function mergeUpcomingBookedMeetings(
  videoMeetings: VideoMeeting[],
  committeeFiles: CommitteeFile[],
  fromTime: number,
  agendaTypes: string[]
): UpcomingBookedMeeting[] {
  const upcomingVideo = (videoMeetings || [])
    .filter(meeting => (meeting.startTime || 0) >= fromTime)
    .map(meeting => ({
      title: meeting.title || "Video meeting",
      startTime: meeting.startTime,
      committeeFileId: meeting.committeeFileId,
      room: meeting.room
    }));
  const videoFileIds = new Set(upcomingVideo.map(meeting => meeting.committeeFileId).filter(Boolean));
  const upcomingFiles = (committeeFiles || [])
    .filter(file => (file.eventDate || 0) >= fromTime)
    .filter(file => isAgendaFileType(file.fileType, agendaTypes))
    .filter(file => !videoFileIds.has(file.id))
    .map(file => ({
      title: file.document?.title || file.fileNameData?.title || file.fileType || "Committee meeting",
      startTime: file.eventDate,
      committeeFileId: file.id
    }));
  return [...upcomingVideo, ...upcomingFiles].sort((left, right) => left.startTime - right.startTime);
}
