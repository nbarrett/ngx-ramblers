import { CommitteeFile, CommitteeFileType, isMeetingFileType } from "../models/committee.model";
import { CommitteeStatisticsEvent } from "../models/agm-stats.model";
import { committeeMeetingHeading } from "./committee-meeting-agenda";
import { suggestedVideoMeetingTitle } from "./video-meeting-join";

export function committeeStatisticsEvents(
  files: CommitteeFile[],
  fileTypes: CommitteeFileType[],
  now: number,
  dateLabel: (value: number) => string
): CommitteeStatisticsEvent[] {
  const eventsByDate = (files || [])
    .filter(file => !!file.eventDate && file.eventDate <= now)
    .filter(file => isMeetingFileType(file.fileType, fileTypes))
    .reduce<Map<number, CommitteeStatisticsEvent>>((events, file) => {
      const existing = events.get(file.eventDate);
      const fileType = fileTypes.find(candidate => candidate.description === file.fileType);
      const heading = committeeMeetingHeading(
        file.meeting?.title || file.document?.title || file.fileNameData?.title || file.fileType || "",
        fileType?.meetingCategory
      );
      events.set(file.eventDate, existing || {
        date: file.eventDate,
        label: suggestedVideoMeetingTitle(heading, dateLabel(file.eventDate))
      });
      return events;
    }, new Map<number, CommitteeStatisticsEvent>());
  return [...eventsByDate.values()].sort((left, right) => right.date - left.date);
}

export function previousCommitteeEventDate(
  events: CommitteeStatisticsEvent[],
  selectedDate: number,
  dayValue: (value: number) => number = value => value
): number | null {
  const selectedDay = dayValue(selectedDate);
  const previous = (events || []).find(event => dayValue(event.date) < selectedDay);
  return previous?.date || null;
}

export function committeeEventComparisonPeriods(
  fromDate: number,
  toDate: number,
  events: CommitteeStatisticsEvent[],
  dayValue: (value: number) => number = value => value
): {fromDate: number; toDate: number}[] {
  const previousFrom = previousCommitteeEventDate(events, fromDate, dayValue);
  if (!previousFrom) {
    return [{fromDate, toDate}];
  } else {
    return [
      {fromDate: previousFrom, toDate: fromDate},
      {fromDate, toDate}
    ];
  }
}
