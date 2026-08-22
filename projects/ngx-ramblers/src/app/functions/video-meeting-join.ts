import { JitsiJoinMode } from "../models/video-meeting.model";

export function jitsiJoinMode(publicHost: boolean): JitsiJoinMode {
  if (publicHost) {
    return JitsiJoinMode.HOST_PAGE;
  } else {
    return JitsiJoinMode.EMBED;
  }
}

export function jitsiHostPageUrl(host: string, room: string, subject?: string): string {
  const trimmedHost = (host || "").replace(/\/$/, "");
  const path = `${trimmedHost}/${encodeURIComponent(room || "")}`;
  if (subject?.trim()) {
    return `${path}#config.subject=${encodeURIComponent(JSON.stringify(subject.trim()))}`;
  } else {
    return path;
  }
}

export function videoMeetingRoomSlug(label: string, dateSlug: string, unique: string): string {
  const base = (label || "ramblers-video-meeting")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "ramblers-video-meeting";
  const datePart = (dateSlug || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (datePart && !base.includes(datePart)) {
    return `${base}-${datePart}-${unique}`;
  } else {
    return `${base}-${unique}`;
  }
}

export function suggestedVideoMeetingTitle(kind: string, dateLabel: string): string {
  const meetingKind = (kind || "").trim() || "Meeting";
  if (dateLabel?.trim()) {
    return `${meetingKind}, ${dateLabel.trim()}`;
  } else {
    return meetingKind;
  }
}

export function videoMeetingDisplayName(title: string, meetingType?: string | null): string {
  if (meetingType?.trim()) {
    return meetingType.trim();
  } else {
    const trimmed = (title || "").trim();
    const withoutDate = trimmed.replace(/, [A-Za-z]+ \d{1,2} [A-Za-z]+ \d{4}$/, "").trim();
    return withoutDate || trimmed || "Meeting";
  }
}

export function videoMeetingDateSlug(displayDate: string): string {
  return (displayDate || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
