import {
  VideoMeetingBrowser,
  VideoMeetingClient,
  VideoMeetingClientHints,
  VideoMeetingDevice,
  VideoMeetingMediaAction,
  VideoMeetingMediaHelp,
  VideoMeetingMediaIssue,
  VideoMeetingMediaState
} from "../models/video-meeting.model";

const IN_APP_MARKERS = [
  "fban",
  "fbav",
  "fb_iab",
  "instagram",
  "line/",
  "twitter",
  "linkedinapp",
  "whatsapp",
  "snapchat",
  "tiktok",
  "bytedance",
  "micromessenger",
  "gsa/"
];

export function videoMeetingClient(hints: VideoMeetingClientHints): VideoMeetingClient {
  const ua = (hints.userAgent || "").toLowerCase();
  const platform = (hints.platform || "").toLowerCase();
  const maxTouchPoints = hints.maxTouchPoints || 0;
  const device = meetingDevice(ua, platform, maxTouchPoints);
  const browser = meetingBrowser(ua);
  const inAppBrowser = isInAppBrowser(ua, device);
  const recommendedBrowserLabel = recommendedBrowser(device);
  return {
    device,
    browser,
    inAppBrowser,
    coarsePointer: !!hints.coarsePointer || device !== VideoMeetingDevice.COMPUTER,
    deviceLabel: deviceLabel(device),
    browserLabel: browserLabel(browser),
    recommendedBrowserLabel
  };
}

export const VIDEO_MEETING_ACTIVE_ROOM_KEY = "videoMeetingActiveRoom";
export const VIDEO_MEETING_NOTES_STARTED_KEY = "videoMeetingNotesStartedAt";
export const VIDEO_MEETING_GUEST_NAME_KEY = "videoMeetingGuestName";

export function rememberActiveMeetingRoom(room: string, storage: Storage): void {
  if (room) {
    storage.setItem(VIDEO_MEETING_ACTIVE_ROOM_KEY, room);
  }
}

export function forgetActiveMeetingRoom(storage: Storage): void {
  storage.removeItem(VIDEO_MEETING_ACTIVE_ROOM_KEY);
}

export function activeMeetingRoom(storage: Storage): string | null {
  return storage.getItem(VIDEO_MEETING_ACTIVE_ROOM_KEY);
}

function notesStartedStorageKey(room: string): string {
  return `${VIDEO_MEETING_NOTES_STARTED_KEY}:${room}`;
}

export function rememberMeetingNotesStartedAt(room: string, startedAt: number, storage: Storage): void {
  if (room && startedAt > 0) {
    storage.setItem(notesStartedStorageKey(room), String(startedAt));
  }
}

export function meetingNotesStartedAt(room: string, storage: Storage): number | null {
  const stored = room ? storage.getItem(notesStartedStorageKey(room)) : null;
  const value = stored ? Number(stored) : 0;
  if (value > 0) {
    return value;
  } else {
    return null;
  }
}

export function forgetMeetingNotesStartedAt(room: string, storage: Storage): void {
  if (room) {
    storage.removeItem(notesStartedStorageKey(room));
  }
}

export function rememberedGuestName(storage: Storage): string {
  return (storage.getItem(VIDEO_MEETING_GUEST_NAME_KEY) || "").trim();
}

export function rememberGuestName(name: string, storage: Storage): void {
  const trimmed = (name || "").trim();
  if (trimmed) {
    storage.setItem(VIDEO_MEETING_GUEST_NAME_KEY, trimmed);
  } else {
    storage.removeItem(VIDEO_MEETING_GUEST_NAME_KEY);
  }
}

export function shouldAutoJoinMeeting(room: string, client: VideoMeetingClient, storedRoom: string | null): boolean {
  if (!room || client.inAppBrowser) {
    return false;
  } else if (client.device === VideoMeetingDevice.IPAD || client.device === VideoMeetingDevice.IPHONE) {
    return storedRoom === room;
  } else {
    return true;
  }
}

export function clientHintsFromWindow(win: Window): VideoMeetingClientHints {
  const nav = win.navigator;
  return {
    userAgent: nav?.userAgent || "",
    platform: nav?.platform || "",
    maxTouchPoints: nav?.maxTouchPoints || 0,
    vendor: nav?.vendor || "",
    coarsePointer: !!win.matchMedia && win.matchMedia("(pointer: coarse)").matches
  };
}

export function videoMeetingJoinTitle(client: VideoMeetingClient): string {
  if (client.inAppBrowser) {
    return `Open this meeting in ${client.recommendedBrowserLabel}`;
  } else {
    return "Join this meeting";
  }
}

export function videoMeetingJoinGuidance(client: VideoMeetingClient): string {
  if (client.inAppBrowser) {
    return `This window cannot use the camera and microphone. Copy the link and open it in ${client.recommendedBrowserLabel} so others can see and hear you.`;
  } else if (client.device === VideoMeetingDevice.IPAD || client.device === VideoMeetingDevice.IPHONE) {
    if (client.browser === VideoMeetingBrowser.SAFARI) {
      return `Your ${client.deviceLabel} will ask to use the camera and microphone. Tap Allow so others can see and hear you. You will see a preview of yourself before you enter the meeting.`;
    } else if (client.browser === VideoMeetingBrowser.CHROME) {
      return `Chrome will ask to use the camera and microphone. Tap Allow. If it does not ask, open the ${client.deviceLabel} Settings app, tap Chrome, and turn on Camera and Microphone. You will see a preview of yourself before you enter the meeting.`;
    } else {
      return `When asked, allow the camera and microphone. If nothing happens, open this page in Safari instead of ${client.browserLabel}. You will see a preview of yourself before you enter the meeting.`;
    }
  } else if (client.device === VideoMeetingDevice.ANDROID) {
    return "Chrome will ask to use the camera and microphone. Tap Allow so others can see and hear you. You will see a preview of yourself before you enter the meeting.";
  } else {
    return "Your browser will ask to use the camera and microphone. Click Allow so others can see and hear you. You will see a preview of yourself before you enter the meeting.";
  }
}

export function videoMeetingJoinActionLabel(client: VideoMeetingClient): string {
  if (client.inAppBrowser) {
    return "Copy meeting link";
  } else {
    return "Join meeting";
  }
}

export function videoMeetingMediaHelp(state: VideoMeetingMediaState, client: VideoMeetingClient): VideoMeetingMediaHelp | null {
  if (state.inMeeting && (state.audioAvailable === false || state.videoAvailable === false)) {
    return mediaBlockedHelp(state, client);
  } else if (state.inMeeting && state.coarsePointer && state.remoteParticipantCount > 0 && !state.cannotHearDismissed) {
    return {
      issue: VideoMeetingMediaIssue.CANNOT_HEAR,
      title: "If you cannot hear, tap the picture",
      body: "Some phones and tablets wait for a tap before they play sound.",
      primaryAction: VideoMeetingMediaAction.DISMISS,
      primaryLabel: "Dismiss",
      secondaryAction: null,
      secondaryLabel: null
    };
  } else if (state.inMeeting && state.joinedMuted && state.audioAvailable !== false && state.audioMuted && !state.microphoneOffDismissed) {
    return {
      issue: VideoMeetingMediaIssue.MICROPHONE_OFF,
      title: "Your microphone is off",
      body: "Others cannot hear you. Tap Turn on microphone, or Stay muted if you only want to listen.",
      primaryAction: VideoMeetingMediaAction.TURN_ON_MICROPHONE,
      primaryLabel: "Turn on microphone",
      secondaryAction: VideoMeetingMediaAction.STAY_MUTED,
      secondaryLabel: "Stay muted"
    };
  } else {
    return null;
  }
}

function mediaBlockedHelp(state: VideoMeetingMediaState, client: VideoMeetingClient): VideoMeetingMediaHelp {
  const blocked = blockedMediaLabel(state);
  return {
    issue: VideoMeetingMediaIssue.MEDIA_BLOCKED,
    title: blockedTitle(blocked),
    body: blockedRecovery(blocked, client),
    primaryAction: VideoMeetingMediaAction.TRY_AGAIN,
    primaryLabel: "Try again",
    secondaryAction: VideoMeetingMediaAction.COPY_LINK,
    secondaryLabel: "Copy meeting link"
  };
}

function blockedMediaLabel(state: VideoMeetingMediaState): string {
  if (state.audioAvailable === false && state.videoAvailable === false) {
    return "camera and microphone";
  } else if (state.audioAvailable === false) {
    return "microphone";
  } else {
    return "camera";
  }
}

function blockedTitle(blocked: string): string {
  if (blocked === "camera and microphone") {
    return "Your camera and microphone are blocked";
  } else if (blocked === "microphone") {
    return "Your microphone is blocked";
  } else {
    return "Your camera is blocked";
  }
}

function blockedRecovery(blocked: string, client: VideoMeetingClient): string {
  if (client.inAppBrowser) {
    return `This window has blocked the ${blocked}. Copy the link and open it in ${client.recommendedBrowserLabel}.`;
  } else if (client.device === VideoMeetingDevice.IPAD || client.device === VideoMeetingDevice.IPHONE) {
    if (client.browser === VideoMeetingBrowser.SAFARI) {
      return `Your ${client.deviceLabel} has blocked the ${blocked}. Tap the aA icon in the Safari address bar, tap Website Settings, set Camera and Microphone to Allow, then tap Try again.`;
    } else if (client.browser === VideoMeetingBrowser.CHROME) {
      return `Chrome has blocked the ${blocked}. Open the ${client.deviceLabel} Settings app, tap Chrome, turn on Camera and Microphone, then return here and tap Try again.`;
    } else {
      return `The ${blocked} is blocked. Open this page in Safari, allow camera and microphone when asked, then tap Try again.`;
    }
  } else if (client.device === VideoMeetingDevice.ANDROID) {
    return `The ${blocked} is blocked. Tap the padlock in the address bar, allow Camera and Microphone, then tap Try again.`;
  } else {
    return `The ${blocked} is blocked. Click the padlock next to the address, allow the camera and microphone, then click Try again.`;
  }
}

function meetingDevice(ua: string, platform: string, maxTouchPoints: number): VideoMeetingDevice {
  const ipad = ua.includes("ipad") || ((ua.includes("macintosh") || platform.includes("mac")) && maxTouchPoints > 1);
  if (ipad) {
    return VideoMeetingDevice.IPAD;
  } else if (ua.includes("iphone") || ua.includes("ipod")) {
    return VideoMeetingDevice.IPHONE;
  } else if (ua.includes("android")) {
    return VideoMeetingDevice.ANDROID;
  } else {
    return VideoMeetingDevice.COMPUTER;
  }
}

function meetingBrowser(ua: string): VideoMeetingBrowser {
  if (ua.includes("crios") || (ua.includes("chrome") && !ua.includes("edg"))) {
    return VideoMeetingBrowser.CHROME;
  } else if (ua.includes("fxios") || ua.includes("firefox")) {
    return VideoMeetingBrowser.FIREFOX;
  } else if (ua.includes("edgios") || ua.includes("edg/") || ua.includes("edga")) {
    return VideoMeetingBrowser.EDGE;
  } else if (ua.includes("safari") && !ua.includes("chrome") && !ua.includes("chromium") && !ua.includes("android")) {
    return VideoMeetingBrowser.SAFARI;
  } else {
    return VideoMeetingBrowser.OTHER;
  }
}

function isInAppBrowser(ua: string, device: VideoMeetingDevice): boolean {
  if (IN_APP_MARKERS.some(marker => ua.includes(marker))) {
    return true;
  } else if (ua.includes("android") && ua.includes("; wv)")) {
    return true;
  } else if (iosWebView(ua, device)) {
    return true;
  } else {
    return false;
  }
}

function iosWebView(ua: string, device: VideoMeetingDevice): boolean {
  const applePhoneOrTablet = device === VideoMeetingDevice.IPAD || device === VideoMeetingDevice.IPHONE;
  if (!applePhoneOrTablet) {
    return false;
  } else if (ua.includes("safari") || ua.includes("crios") || ua.includes("fxios") || ua.includes("edgios")) {
    return false;
  } else if (ua.includes("applewebkit")) {
    return true;
  } else {
    return false;
  }
}

function deviceLabel(device: VideoMeetingDevice): string {
  if (device === VideoMeetingDevice.IPAD) {
    return "iPad";
  } else if (device === VideoMeetingDevice.IPHONE) {
    return "iPhone";
  } else if (device === VideoMeetingDevice.ANDROID) {
    return "phone";
  } else {
    return "computer";
  }
}

function browserLabel(browser: VideoMeetingBrowser): string {
  if (browser === VideoMeetingBrowser.SAFARI) {
    return "Safari";
  } else if (browser === VideoMeetingBrowser.CHROME) {
    return "Chrome";
  } else if (browser === VideoMeetingBrowser.FIREFOX) {
    return "Firefox";
  } else if (browser === VideoMeetingBrowser.EDGE) {
    return "Edge";
  } else {
    return "this browser";
  }
}

function recommendedBrowser(device: VideoMeetingDevice): string {
  if (device === VideoMeetingDevice.IPAD || device === VideoMeetingDevice.IPHONE) {
    return "Safari";
  } else if (device === VideoMeetingDevice.ANDROID) {
    return "Chrome";
  } else {
    return "your usual browser";
  }
}
