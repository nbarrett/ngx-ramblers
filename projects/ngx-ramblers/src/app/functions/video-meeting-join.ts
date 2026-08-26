import { JitsiEmbedConfigOverwrite, JitsiJoinMode, VideoMeetingRuntimeConfig } from "../models/video-meeting.model";

export const JITSI_IFRAME_ALLOW = "camera; microphone; display-capture; autoplay; clipboard-write; fullscreen";

export const JITSI_MEETING_TOOLBAR_BUTTONS = [
  "microphone", "camera", "desktop", "chat", "raisehand", "reactions",
  "participants-pane", "tileview", "settings", "videoquality", "fullscreen", "hangup"
];

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

export function jitsiEmbedConfigOverwrite(config: VideoMeetingRuntimeConfig, subject: string): JitsiEmbedConfigOverwrite {
  return {
    prejoinPageEnabled: true,
    prejoinConfig: {
      enabled: true,
      hideExtraJoinButtons: ["no-audio", "no-video"]
    },
    disableLobby: !config.enableLobby,
    lobby: {
      autoKnock: !!config.enableLobby,
      enableChat: true
    },
    startWithAudioMuted: !!config.startWithAudioMuted,
    startWithVideoMuted: !!config.startWithVideoMuted,
    disableDeepLinking: true,
    defaultLogoUrl: "",
    toolbarButtons: JITSI_MEETING_TOOLBAR_BUTTONS,
    toolbarConfig: {
      alwaysVisible: true
    },
    transcription: {
      enabled: false,
      preferredLanguage: "en-GB",
      disableClosedCaptions: true
    },
    transcribingEnabled: false,
    disabledNotifications: [
      "notify.TRANSCRIBING_FAILED",
      "transcribing.failed"
    ],
    subject
  };
}

export function applyJitsiIframeAllow(iframe: HTMLIFrameElement | null): void {
  if (iframe) {
    iframe.setAttribute("allow", JITSI_IFRAME_ALLOW);
    iframe.setAttribute("allowfullscreen", "true");
  }
}
