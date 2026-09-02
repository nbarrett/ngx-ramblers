import { isArray, isObject, isString } from "es-toolkit/compat";
import {
  JitsiEmbedConfigOverwrite,
  JitsiJoinMode,
  JitsiTokenUser,
  MeetingGuestOccupantKind,
  MeetingOccupantIdentity,
  VideoMeetingParticipant,
  VideoMeetingRuntimeConfig
} from "../models/video-meeting.model";

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
  ".premeeting-screen .primary,.premeeting-screen .primary:focus{background:" + JITSI_SUNRISE + "!important;border-color:" + JITSI_SUNRISE + "!important;color:" + JITSI_SUNRISE_INK + "!important}",
  ".premeeting-screen .primary:hover{background:" + JITSI_SUNRISE_HOVER + "!important;border-color:" + JITSI_SUNRISE_HOVER + "!important}",
  ".premeeting-screen .primary svg{fill:" + JITSI_SUNRISE_INK + "!important}",
  ".tile-view .filmstrip{display:flex!important;align-items:center!important;justify-content:center!important;height:100%!important;width:100%!important;left:0!important;top:0!important;right:auto!important;bottom:auto!important}",
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

export function videoMeetingTitleFromRoom(room: string): string {
  return (room || "").replace(/-\d{3,}$/, "").replace(/-/g, " ").replace(/\b\w/g, character => character.toUpperCase()).trim();
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

export const GUEST_MEETING_TOKEN_PARAM = "t";
export const GUEST_MEETING_NAME_PARAM = "name";
export const GUEST_MEETING_EMAIL_PARAM = "email";
const GUEST_IDENTITY_PARAMS = [GUEST_MEETING_TOKEN_PARAM, GUEST_MEETING_NAME_PARAM, GUEST_MEETING_EMAIL_PARAM];

export function joinVideoMeetingAsGuest(guestRoute: boolean, loggedIn: boolean): boolean {
  return !!guestRoute && !loggedIn;
}

export function guestIdentityFromQuery(params: {get(name: string): string | null}): {name: string; email: string} {
  return {
    name: (params.get(GUEST_MEETING_NAME_PARAM) || "").trim(),
    email: (params.get(GUEST_MEETING_EMAIL_PARAM) || "").trim()
  };
}

export function memberMeetingQueryParams(params: {keys: string[]; get(name: string): string | null}): {[key: string]: string} {
  return params.keys.filter(key => !GUEST_IDENTITY_PARAMS.includes(key)).reduce((next, key) => {
    const value = params.get(key);
    if (value) {
      return {...next, [key]: value};
    } else {
      return next;
    }
  }, {});
}

export function usableMeetingDisplayName(name: string): boolean {
  const trimmed = (name || "").trim().toLowerCase();
  return !!trimmed && trimmed !== "guest" && trimmed !== "fellow jitster";
}

export function shouldPromptForGuestName(guest: boolean, name: string): boolean {
  return !!guest && !usableMeetingDisplayName(name);
}

export function nameFromEmailAddress(email: string): string {
  const localPart = (email || "").trim().split("@")[0];
  return localPart.split(/[._+-]+/).filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function guestMeetingOccupantId(room: string, email: string): string {
  const normalised = (email || "").trim().toLowerCase();
  if (normalised) {
    return `${MeetingGuestOccupantKind.EMAIL}:${normalised}`;
  } else {
    return `${MeetingGuestOccupantKind.ANONYMOUS}:${room || "room"}`;
  }
}

function emptyTokenUser(): JitsiTokenUser {
  return {id: "", name: "", moderator: false};
}

export function tokenUserFromJwt(token: string): JitsiTokenUser {
  const payload = (token || "").split(".")[1];
  if (payload) {
    try {
      const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
      const user = isObject(decoded?.context?.user) ? decoded.context.user as { [key: string]: unknown } : {};
      const email = isString(user["email"]) ? user["email"].trim() : "";
      return {
        id: isString(user["id"]) ? user["id"] : "",
        name: isString(user["name"]) ? user["name"].trim() : "",
        email: email || undefined,
        moderator: user["moderator"] === true || user["moderator"] === "true"
      };
    } catch {
      return emptyTokenUser();
    }
  } else {
    return emptyTokenUser();
  }
}

export function displayNameFromToken(token: string): string {
  return tokenUserFromJwt(token).name;
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
  const email = isString(record["email"]) ? record["email"].trim() : "";
  return {
    participantId,
    displayName: named || formatted || "Guest",
    email: email || null,
    local: !!localParticipantId && participantId === localParticipantId
  };
}

function occupantDisplayName(person: Pick<VideoMeetingParticipant, "displayName">): string {
  return (person.displayName || "").replace(/\s*\((me|you)\)\s*$/i, "").trim().toLowerCase();
}

function isAnonymousGuestName(name: string): boolean {
  return !name || name === "guest" || name === "fellow jitster";
}

export function occupantIdentityKey(person: Pick<VideoMeetingParticipant, "displayName" | "email">): string {
  const email = (person.email || "").trim().toLowerCase();
  const name = occupantDisplayName(person);
  if (email) {
    return `email:${email}`;
  } else if (isAnonymousGuestName(name)) {
    return MeetingOccupantIdentity.ANONYMOUS_GUEST;
  } else {
    return `name:${name}`;
  }
}

export function duplicateOccupantIdsToKick(
  people: VideoMeetingParticipant[],
  localParticipantId: string,
  preferParticipantId: string | null = null
): string[] {
  const groups = people.reduce((grouped, person) => {
    const key = occupantIdentityKey(person);
    grouped.set(key, (grouped.get(key) || []).concat(person));
    return grouped;
  }, new Map<string, VideoMeetingParticipant[]>());
  return [...groups.values()].reduce((ids, group) => {
    if (group.length < 2) {
      return ids;
    } else {
      const preferred = group.find(person => person.participantId === preferParticipantId);
      const localPerson = group.find(person => person.local || person.participantId === localParticipantId);
      const keepId = (preferred || localPerson || group[group.length - 1]).participantId;
      return ids.concat(group.filter(person => person.participantId !== keepId).map(person => person.participantId));
    }
  }, [] as string[]);
}

export function jitsiEmbedConfigOverwrite(config: VideoMeetingRuntimeConfig, subject: string, silent = false): JitsiEmbedConfigOverwrite {
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
    subject,
    filmstrip: {
      disableResizable: true,
      disableStageFilmstrip: false
    }
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
