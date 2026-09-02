import { describe, expect, it } from "vitest";
import {
  VideoMeetingBrowser,
  VideoMeetingDevice,
  VideoMeetingMediaAction,
  VideoMeetingMediaIssue
} from "../models/video-meeting.model";
import {
  forgetActiveMeetingRoom,
  forgetMeetingNotesStartedAt,
  meetingNotesStartedAt,
  rememberActiveMeetingRoom,
  rememberGuestName,
  rememberMeetingNotesStartedAt,
  rememberedGuestName,
  shouldAutoJoinMeeting,
  VIDEO_MEETING_ACTIVE_ROOM_KEY,
  VIDEO_MEETING_GUEST_NAME_KEY,
  VIDEO_MEETING_NOTES_STARTED_KEY,
  videoMeetingClient,
  videoMeetingJoinActionLabel,
  videoMeetingJoinGuidance,
  videoMeetingJoinTitle,
  videoMeetingMediaHelp
} from "./video-meeting-client";

const IPHONE_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const IPAD_SAFARI = "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1";
const IPAD_OS_DESKTOP_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const IPHONE_CHROME = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1";
const IPHONE_FACEBOOK = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21A329 [FBAN/FBIOS;FBDV/iPhone15,2;]";
const ANDROID_CHROME = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const ANDROID_WEBVIEW = "Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36";
const DESKTOP_CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const DESKTOP_SAFARI = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";

describe("videoMeetingClient", () => {

  it("treats iPhone Safari as an iPhone that should use Safari", () => {
    const client = videoMeetingClient({userAgent: IPHONE_SAFARI, coarsePointer: true});
    expect(client.device).toEqual(VideoMeetingDevice.IPHONE);
    expect(client.browser).toEqual(VideoMeetingBrowser.SAFARI);
    expect(client.inAppBrowser).toEqual(false);
    expect(client.recommendedBrowserLabel).toEqual("Safari");
  });

  it("treats an iPad Safari user agent as an iPad", () => {
    const client = videoMeetingClient({userAgent: IPAD_SAFARI, coarsePointer: true});
    expect(client.device).toEqual(VideoMeetingDevice.IPAD);
    expect(client.deviceLabel).toEqual("iPad");
    expect(client.inAppBrowser).toEqual(false);
  });

  it("treats iPadOS desktop-mode Safari as an iPad when the screen takes touches", () => {
    const client = videoMeetingClient({
      userAgent: IPAD_OS_DESKTOP_UA,
      platform: "MacIntel",
      maxTouchPoints: 5,
      coarsePointer: true
    });
    expect(client.device).toEqual(VideoMeetingDevice.IPAD);
    expect(client.browser).toEqual(VideoMeetingBrowser.SAFARI);
  });

  it("does not treat a Mac with a trackpad as an iPad", () => {
    const client = videoMeetingClient({
      userAgent: DESKTOP_SAFARI,
      platform: "MacIntel",
      maxTouchPoints: 0,
      coarsePointer: false
    });
    expect(client.device).toEqual(VideoMeetingDevice.COMPUTER);
  });

  it("recognises Chrome on iPhone", () => {
    const client = videoMeetingClient({userAgent: IPHONE_CHROME, coarsePointer: true});
    expect(client.browser).toEqual(VideoMeetingBrowser.CHROME);
    expect(client.inAppBrowser).toEqual(false);
  });

  it("flags Facebook's in-app browser on iPhone", () => {
    const client = videoMeetingClient({userAgent: IPHONE_FACEBOOK, coarsePointer: true});
    expect(client.inAppBrowser).toEqual(true);
    expect(client.recommendedBrowserLabel).toEqual("Safari");
  });

  it("flags Android WebView as an in-app browser", () => {
    const client = videoMeetingClient({userAgent: ANDROID_WEBVIEW, coarsePointer: true});
    expect(client.device).toEqual(VideoMeetingDevice.ANDROID);
    expect(client.inAppBrowser).toEqual(true);
    expect(client.recommendedBrowserLabel).toEqual("Chrome");
  });

  it("treats Android Chrome as a normal phone browser", () => {
    const client = videoMeetingClient({userAgent: ANDROID_CHROME, coarsePointer: true});
    expect(client.device).toEqual(VideoMeetingDevice.ANDROID);
    expect(client.browser).toEqual(VideoMeetingBrowser.CHROME);
    expect(client.inAppBrowser).toEqual(false);
  });

  it("treats desktop Chrome as a computer", () => {
    const client = videoMeetingClient({userAgent: DESKTOP_CHROME, coarsePointer: false});
    expect(client.device).toEqual(VideoMeetingDevice.COMPUTER);
    expect(client.browser).toEqual(VideoMeetingBrowser.CHROME);
    expect(client.inAppBrowser).toEqual(false);
    expect(client.coarsePointer).toEqual(false);
  });

});

describe("video meeting join copy", () => {

  it("tells iPad Safari users to tap Allow and that they will see a preview", () => {
    const client = videoMeetingClient({userAgent: IPAD_SAFARI, coarsePointer: true});
    expect(videoMeetingJoinTitle(client)).toEqual("Join this meeting");
    expect(videoMeetingJoinActionLabel(client)).toEqual("Join meeting");
    expect(videoMeetingJoinGuidance(client)).toContain("Tap Allow");
    expect(videoMeetingJoinGuidance(client)).toContain("preview of yourself");
  });

  it("tells iPhone Chrome users to enable camera and microphone in Settings if Chrome does not ask", () => {
    const client = videoMeetingClient({userAgent: IPHONE_CHROME, coarsePointer: true});
    expect(videoMeetingJoinGuidance(client)).toContain("Settings app");
    expect(videoMeetingJoinGuidance(client)).toContain("Chrome");
  });

  it("tells computer users to click Allow", () => {
    const client = videoMeetingClient({userAgent: DESKTOP_CHROME, coarsePointer: false});
    expect(videoMeetingJoinGuidance(client)).toContain("Click Allow");
  });

  it("tells in-app browser users to copy the link and open Safari or Chrome", () => {
    const client = videoMeetingClient({userAgent: IPHONE_FACEBOOK, coarsePointer: true});
    expect(videoMeetingJoinTitle(client)).toEqual("Open this meeting in Safari");
    expect(videoMeetingJoinActionLabel(client)).toEqual("Copy meeting link");
    expect(videoMeetingJoinGuidance(client)).toContain("Copy the link");
    expect(videoMeetingJoinGuidance(client)).toContain("Safari");
  });

});

describe("shouldAutoJoinMeeting", () => {

  const desktop = videoMeetingClient({userAgent: DESKTOP_CHROME, coarsePointer: false});
  const ipad = videoMeetingClient({userAgent: IPAD_SAFARI, coarsePointer: true});
  const inApp = videoMeetingClient({userAgent: IPHONE_FACEBOOK, coarsePointer: true});
  const android = videoMeetingClient({userAgent: ANDROID_CHROME, coarsePointer: true});

  it("joins a computer straight into the room on the meeting URL", () => {
    expect(shouldAutoJoinMeeting("committee-room", desktop, null)).toEqual(true);
  });

  it("joins Android Chrome straight into the room on the meeting URL", () => {
    expect(shouldAutoJoinMeeting("committee-room", android, null)).toEqual(true);
  });

  it("keeps the Join screen on a first visit from iPad", () => {
    expect(shouldAutoJoinMeeting("committee-room", ipad, null)).toEqual(false);
  });

  it("rejoins an iPad after this tab was already in that room", () => {
    expect(shouldAutoJoinMeeting("committee-room", ipad, "committee-room")).toEqual(true);
  });

  it("does not auto-join an in-app browser", () => {
    expect(shouldAutoJoinMeeting("committee-room", inApp, "committee-room")).toEqual(false);
  });

});

describe("active meeting room storage", () => {

  it("remembers and forgets the room for this tab", () => {
    const store: Record<string, string> = {};
    const storage = {
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      getItem: (key: string) => store[key] || null,
      removeItem: (key: string) => {
        delete store[key];
      }
    } as Storage;
    rememberActiveMeetingRoom("committee-room", storage);
    expect(store[VIDEO_MEETING_ACTIVE_ROOM_KEY]).toEqual("committee-room");
    forgetActiveMeetingRoom(storage);
    expect(store[VIDEO_MEETING_ACTIVE_ROOM_KEY]).toEqual(undefined);
  });

  it("remembers a guest's chosen name so they do not rejoin as Guest", () => {
    const store: Record<string, string> = {};
    const storage = {
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      getItem: (key: string) => store[key] || null,
      removeItem: (key: string) => {
        delete store[key];
      }
    } as Storage;
    rememberGuestName("Andrew Barrett", storage);
    expect(store[VIDEO_MEETING_GUEST_NAME_KEY]).toEqual("Andrew Barrett");
    expect(rememberedGuestName(storage)).toEqual("Andrew Barrett");
    rememberGuestName("  ", storage);
    expect(rememberedGuestName(storage)).toEqual("");
  });

  it("remembers when notes for this room started taking", () => {
    const store: Record<string, string> = {};
    const storage = {
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      getItem: (key: string) => store[key] || null,
      removeItem: (key: string) => {
        delete store[key];
      }
    } as Storage;
    rememberMeetingNotesStartedAt("committee-room", 1700000000000, storage);
    expect(meetingNotesStartedAt("committee-room", storage)).toEqual(1700000000000);
    expect(meetingNotesStartedAt("other-room", storage)).toEqual(null);
    forgetMeetingNotesStartedAt("committee-room", storage);
    expect(meetingNotesStartedAt("committee-room", storage)).toEqual(null);
    expect(store[`${VIDEO_MEETING_NOTES_STARTED_KEY}:committee-room`]).toEqual(undefined);
  });

});

describe("videoMeetingMediaHelp", () => {

  const ipad = videoMeetingClient({userAgent: IPAD_SAFARI, coarsePointer: true});
  const desktop = videoMeetingClient({userAgent: DESKTOP_CHROME, coarsePointer: false});

  it("explains how to unblock the microphone on iPad Safari", () => {
    const help = videoMeetingMediaHelp({
      inMeeting: true,
      audioAvailable: false,
      videoAvailable: true,
      audioMuted: true,
      joinedMuted: true,
      remoteParticipantCount: 1,
      cannotHearDismissed: false,
      microphoneOffDismissed: false,
      coarsePointer: true
    }, ipad);
    expect(help?.issue).toEqual(VideoMeetingMediaIssue.MEDIA_BLOCKED);
    expect(help?.title).toEqual("Your microphone is blocked");
    expect(help?.body).toContain("aA icon");
    expect(help?.body).toContain("Website Settings");
    expect(help?.primaryAction).toEqual(VideoMeetingMediaAction.TRY_AGAIN);
  });

  it("explains padlock settings on a computer when both camera and microphone are blocked", () => {
    const help = videoMeetingMediaHelp({
      inMeeting: true,
      audioAvailable: false,
      videoAvailable: false,
      audioMuted: true,
      joinedMuted: true,
      remoteParticipantCount: 0,
      cannotHearDismissed: false,
      microphoneOffDismissed: false,
      coarsePointer: false
    }, desktop);
    expect(help?.title).toEqual("Your camera and microphone are blocked");
    expect(help?.body).toContain("padlock next to the address");
  });

  it("asks phone and tablet users to tap the picture if they cannot hear others", () => {
    const help = videoMeetingMediaHelp({
      inMeeting: true,
      audioAvailable: true,
      videoAvailable: true,
      audioMuted: false,
      joinedMuted: false,
      remoteParticipantCount: 1,
      cannotHearDismissed: false,
      microphoneOffDismissed: false,
      coarsePointer: true
    }, ipad);
    expect(help?.issue).toEqual(VideoMeetingMediaIssue.CANNOT_HEAR);
    expect(help?.title).toContain("tap the picture");
  });

  it("does not show the cannot-hear prompt on a computer", () => {
    const help = videoMeetingMediaHelp({
      inMeeting: true,
      audioAvailable: true,
      videoAvailable: true,
      audioMuted: false,
      joinedMuted: false,
      remoteParticipantCount: 1,
      cannotHearDismissed: false,
      microphoneOffDismissed: false,
      coarsePointer: false
    }, desktop);
    expect(help).toEqual(null);
  });

  it("tells people who joined muted how to turn the microphone on", () => {
    const help = videoMeetingMediaHelp({
      inMeeting: true,
      audioAvailable: true,
      videoAvailable: true,
      audioMuted: true,
      joinedMuted: true,
      remoteParticipantCount: 0,
      cannotHearDismissed: false,
      microphoneOffDismissed: false,
      coarsePointer: false
    }, desktop);
    expect(help?.issue).toEqual(VideoMeetingMediaIssue.MICROPHONE_OFF);
    expect(help?.primaryAction).toEqual(VideoMeetingMediaAction.TURN_ON_MICROPHONE);
    expect(help?.secondaryAction).toEqual(VideoMeetingMediaAction.STAY_MUTED);
  });

  it("does not nag people who muted themselves later", () => {
    const help = videoMeetingMediaHelp({
      inMeeting: true,
      audioAvailable: true,
      videoAvailable: true,
      audioMuted: true,
      joinedMuted: false,
      remoteParticipantCount: 0,
      cannotHearDismissed: false,
      microphoneOffDismissed: false,
      coarsePointer: false
    }, desktop);
    expect(help).toEqual(null);
  });

  it("prefers a blocked microphone over the cannot-hear prompt", () => {
    const help = videoMeetingMediaHelp({
      inMeeting: true,
      audioAvailable: false,
      videoAvailable: true,
      audioMuted: true,
      joinedMuted: true,
      remoteParticipantCount: 2,
      cannotHearDismissed: false,
      microphoneOffDismissed: false,
      coarsePointer: true
    }, ipad);
    expect(help?.issue).toEqual(VideoMeetingMediaIssue.MEDIA_BLOCKED);
  });

});
