import { isArray, isObject, isString } from "es-toolkit/compat";
import { JitsiEmbedConfigOverwrite, JitsiJoinMode, VideoMeetingParticipant, VideoMeetingRuntimeConfig } from "../models/video-meeting.model";

export const JITSI_IFRAME_ALLOW = "camera; microphone; display-capture; autoplay; clipboard-write; fullscreen";

export const JITSI_MEETING_TOOLBAR_BUTTONS = [
  "microphone", "camera", "desktop", "chat", "raisehand", "reactions",
  "participants-pane", "tileview", "settings", "videoquality", "fullscreen", "hangup"
];

export const JITSI_SUNRISE = "rgb(249, 177, 4)";
export const JITSI_SUNRISE_HOVER = "rgb(211, 150, 3)";
export const JITSI_SUNRISE_ACTIVE = "rgb(199, 141, 3)";
export const JITSI_SUNRISE_INK = "#1a1a1a";
export const JITSI_HOST_PAGE_STYLE_ID = "ngx-ramblers-jitsi-theme";
export const JITSI_HOST_PAGE_CSS = [
  ".leftwatermark,.rightwatermark,.watermark,#new-watermark{display:none!important}",
  "#localvideomenu button,#remotevideomenu button,#local-video-menu-trigger button,#remote-video-menu-trigger button{background-color:" + JITSI_SUNRISE + "!important;background:" + JITSI_SUNRISE + "!important;color:" + JITSI_SUNRISE_INK + "!important}",
  "#localvideomenu svg,#remotevideomenu svg,#local-video-menu-trigger svg,#remote-video-menu-trigger svg{fill:" + JITSI_SUNRISE_INK + "!important}",
  ".vertical-filmstrip .filmstrip,.stage-filmstrip .filmstrip,.vertical-filmstrip .filmstrip__videos,.stage-filmstrip .filmstrip__videos{flex-direction:column!important;justify-content:flex-start!important;align-items:stretch!important;height:auto!important;max-height:100%!important}",
  ".vertical-filmstrip #filmstripRemoteVideos,.stage-filmstrip #filmstripRemoteVideos{flex:0 0 auto!important;height:auto!important;justify-content:flex-start!important}",
  ".vertical-filmstrip #filmstripRemoteVideosContainer,.stage-filmstrip #filmstripRemoteVideosContainer{flex-direction:column!important;justify-content:flex-start!important}",
  ".vertical-filmstrip #largeVideoContainer,.vertical-filmstrip #largeVideoWrapper,.stage-filmstrip #largeVideoContainer,.stage-filmstrip #largeVideoWrapper{width:0!important;min-width:0!important;overflow:hidden!important}",
  ".vertical-filmstrip .filmstrip,.stage-filmstrip .filmstrip{left:0!important;right:0!important;width:100%!important;top:0!important}",
  ".tile-view .remote-videos,.tile-view .remote-videos>div{align-content:flex-start!important;align-items:flex-start!important;justify-content:flex-start!important}"
].join("");

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

export function nameFromEmailAddress(email: string): string {
  const localPart = (email || "").trim().split("@")[0];
  return localPart.split(/[._+-]+/).filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function displayNameFromToken(token: string): string {
  const payload = (token || "").split(".")[1];
  let name = "";
  if (payload) {
    try {
      const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
      name = (decoded?.context?.user?.name || "").trim();
    } catch {
      name = "";
    }
  }
  return name;
}

export function videoMeetingPeople(info: unknown, localParticipantId: string): VideoMeetingParticipant[] {
  const rows = isArray(info) ? info : [];
  return rows.map(item => personFromJitsi(item, localParticipantId)).filter(person => person.participantId);
}

function personFromJitsi(item: unknown, localParticipantId: string): VideoMeetingParticipant {
  const record = isObject(item) ? item as { [key: string]: unknown } : {};
  const participantId = isString(record["participantId"]) ? record["participantId"] : "";
  const named = isString(record["displayName"]) ? record["displayName"] : "";
  const formatted = isString(record["formattedDisplayName"]) ? record["formattedDisplayName"] : "";
  return {
    participantId,
    displayName: named || formatted || "Guest",
    local: !!localParticipantId && participantId === localParticipantId
  };
}

export function jitsiEmbedConfigOverwrite(config: VideoMeetingRuntimeConfig, subject: string, silent = false): JitsiEmbedConfigOverwrite {
  return {
    prejoinPageEnabled: false,
    prejoinConfig: {
      enabled: false,
      hideExtraJoinButtons: ["no-audio", "no-video"]
    },
    disableLobby: !config.enableLobby,
    lobby: {
      autoKnock: !!config.enableLobby,
      enableChat: true
    },
    startWithAudioMuted: !!config.startWithAudioMuted || silent,
    startWithVideoMuted: !!config.startWithVideoMuted,
    startSilent: silent,
    disableDeepLinking: true,
    hideConferenceSubject: true,
    hideConferenceTimer: true,
    disableSelfView: false,
    disableResponsiveTiles: true,
    customTheme: {
      palette: {
        action01: JITSI_SUNRISE,
        action01Hover: JITSI_SUNRISE_HOVER,
        action01Active: JITSI_SUNRISE_ACTIVE,
        focus01: JITSI_SUNRISE
      }
    },
    connectionIndicators: {
      disabled: true
    },
    defaultLogoUrl: "",
    toolbarButtons: [],
    toolbarConfig: {
      alwaysVisible: true
    },
    followMeEnabled: true,
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

export function applyJitsiHostPageTheme(iframe: HTMLIFrameElement | null): void {
  const page = iframe?.contentDocument;
  const head = page?.head;
  if (page && head && !page.getElementById(JITSI_HOST_PAGE_STYLE_ID)) {
    const style = page.createElement("style");
    style.id = JITSI_HOST_PAGE_STYLE_ID;
    style.textContent = JITSI_HOST_PAGE_CSS;
    head.appendChild(style);
  }
}
