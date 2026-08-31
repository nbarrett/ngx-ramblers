import { describe, expect, it } from "vitest";
import { JitsiJoinMode, VideoMeetingRuntimeConfig } from "../models/video-meeting.model";
import {
  applyJitsiHostPageTheme,
  applyJitsiIframeAllow,
  displayNameFromToken,
  JITSI_HOST_PAGE_STYLE_ID,
  JITSI_IFRAME_ALLOW,
  JITSI_SUNRISE,
  jitsiEmbedConfigOverwrite,
  jitsiHostPageUrl,
  jitsiJoinMode,
  nameFromEmailAddress,
  suggestedVideoMeetingTitle,
  videoMeetingDisplayName,
  videoMeetingPeople,
  videoMeetingRoomSlug
} from "./video-meeting-join";

function fakeJwt(name: string): string {
  const payload = Buffer.from(JSON.stringify({context: {user: {name}}})).toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `header.${payload}.signature`;
}

function runtime(overrides: Partial<VideoMeetingRuntimeConfig> = {}): VideoMeetingRuntimeConfig {
  return {
    enabled: true,
    host: "https://ngx-ramblers-jitsi.fly.dev",
    jwtRequired: true,
    publicHost: false,
    roomPrefix: "ngx",
    brandName: "Ramblers Video Meetings",
    guestInstructions: "Allow the camera and microphone.",
    startWithAudioMuted: false,
    startWithVideoMuted: false,
    enableNotes: true,
    enableLobby: false,
    ...overrides
  };
}

describe("jitsiJoinMode", () => {

  it("opens the public Jitsi page so the call is not cut after five minutes", () => {
    expect(jitsiJoinMode(true)).toEqual(JitsiJoinMode.HOST_PAGE);
  });

  it("embeds a self-hosted Jitsi inside NGX", () => {
    expect(jitsiJoinMode(false)).toEqual(JitsiJoinMode.EMBED);
  });

});

describe("jitsiHostPageUrl", () => {

  it("joins the room on the host as a full page", () => {
    expect(jitsiHostPageUrl("https://meet.jit.si", "ngx-abcd-efgh")).toEqual("https://meet.jit.si/ngx-abcd-efgh");
  });

  it("strips a trailing slash on the host", () => {
    expect(jitsiHostPageUrl("https://meet.jit.si/", "ngx-abcd-efgh")).toEqual("https://meet.jit.si/ngx-abcd-efgh");
  });

  it("sets the meeting subject so Jitsi does not show the raw room slug", () => {
    expect(jitsiHostPageUrl("https://meet.jit.si", "room", "Ramblers video meeting"))
      .toEqual("https://meet.jit.si/room#config.subject=%22Ramblers%20video%20meeting%22");
  });

});

describe("suggestedVideoMeetingTitle", () => {

  it("uses the meeting kind and date as the name people see", () => {
    expect(suggestedVideoMeetingTitle("Committee meeting", "Tuesday 18 August 2026"))
      .toEqual("Committee meeting, Tuesday 18 August 2026");
  });

});

describe("videoMeetingDisplayName", () => {

  it("prefers the meeting type over a title that also contains a date", () => {
    expect(videoMeetingDisplayName("Committee Meeting, Saturday 12 September 2026", "Committee Meeting"))
      .toEqual("Committee Meeting");
  });

  it("strips a trailing display date from the title when there is no meeting type", () => {
    expect(videoMeetingDisplayName("Committee Meeting, Saturday 12 September 2026"))
      .toEqual("Committee Meeting");
  });

});

describe("videoMeetingRoomSlug", () => {

  it("builds a readable room from the brand, date and a short number", () => {
    expect(videoMeetingRoomSlug("Ramblers Video Meetings", "18-august-2026", "1847"))
      .toEqual("ramblers-video-meetings-18-august-2026-1847");
  });

});

describe("videoMeetingPeople", () => {

  it("keeps named participants and marks the local person", () => {
    expect(videoMeetingPeople([
      {participantId: "me", displayName: "Nick Barrett"},
      {participantId: "them", formattedDisplayName: "Jane Walker"}
    ], "me")).toEqual([
      {participantId: "me", displayName: "Nick Barrett", local: true},
      {participantId: "them", displayName: "Jane Walker", local: false}
    ]);
  });

  it("ignores empty or malformed participant rows", () => {
    expect(videoMeetingPeople([{displayName: "Nobody"}], "me")).toEqual([]);
    expect(videoMeetingPeople(null, "me")).toEqual([]);
  });

});

describe("jitsiEmbedConfigOverwrite", () => {

  it("skips the Jitsi prejoin screen so our own join dialog is the only join step", () => {
    const overwrite = jitsiEmbedConfigOverwrite(runtime(), "Committee meeting");
    expect(overwrite.prejoinPageEnabled).toEqual(false);
    expect(overwrite.prejoinConfig.enabled).toEqual(false);
    expect(overwrite.transcription.enabled).toEqual(false);
    expect(overwrite.transcription.disableClosedCaptions).toEqual(true);
    expect(overwrite.transcribingEnabled).toEqual(false);
    expect(overwrite.disableDeepLinking).toEqual(true);
    expect(overwrite.toolbarConfig.alwaysVisible).toEqual(true);
    expect(overwrite.subject).toEqual("Committee meeting");
  });

  it("offers Follow Me so a moderator can present a shared screen to everyone", () => {
    expect(jitsiEmbedConfigOverwrite(runtime(), "Meeting").followMeEnabled).toEqual(true);
  });

  it("joins normally with sound by default", () => {
    const overwrite = jitsiEmbedConfigOverwrite(runtime(), "Meeting");
    expect(overwrite.startSilent).toEqual(false);
    expect(overwrite.startWithAudioMuted).toEqual(false);
  });

  it("joins silent and muted for a companion device in the same room, to stop echo", () => {
    const overwrite = jitsiEmbedConfigOverwrite(runtime(), "Meeting", true);
    expect(overwrite.startSilent).toEqual(true);
    expect(overwrite.startWithAudioMuted).toEqual(true);
  });

  it("keeps the meeting controls always visible so mute, camera and hang-up can always be found", () => {
    expect(jitsiEmbedConfigOverwrite(runtime(), "Meeting").toolbarConfig.alwaysVisible).toEqual(true);
    expect(jitsiEmbedConfigOverwrite(runtime(), "Meeting", true).toolbarConfig.alwaysVisible).toEqual(true);
  });

  it("hides Jitsi's duplicate conference subject and timer", () => {
    const overwrite = jitsiEmbedConfigOverwrite(runtime(), "Meeting");
    expect(overwrite.hideConferenceSubject).toEqual(true);
    expect(overwrite.hideConferenceTimer).toEqual(true);
    expect(overwrite.disableSelfView).toEqual(false);
    expect(overwrite.disableResponsiveTiles).toEqual(true);
    expect(overwrite.customTheme.palette.action01).toEqual(JITSI_SUNRISE);
    expect(overwrite.connectionIndicators.disabled).toEqual(true);
  });

  it("leaves the lobby off unless that setting is on", () => {
    expect(jitsiEmbedConfigOverwrite(runtime(), "Meeting").disableLobby).toEqual(true);
    expect(jitsiEmbedConfigOverwrite(runtime({enableLobby: true}), "Meeting").disableLobby).toEqual(false);
    expect(jitsiEmbedConfigOverwrite(runtime({enableLobby: true}), "Meeting").lobby.autoKnock).toEqual(true);
  });

});

describe("nameFromEmailAddress", () => {

  it("turns the part before the @ into a readable name", () => {
    expect(nameFromEmailAddress("duncan.reid@example.org")).toEqual("Duncan Reid");
    expect(nameFromEmailAddress("lindsay_stewart@example.org")).toEqual("Lindsay Stewart");
    expect(nameFromEmailAddress("guy@example.org")).toEqual("Guy");
  });

  it("is empty for an empty address", () => {
    expect(nameFromEmailAddress("")).toEqual("");
  });

});

describe("displayNameFromToken", () => {

  it("reads the display name carried in the meeting token", () => {
    expect(displayNameFromToken(fakeJwt("Duncan Reid"))).toEqual("Duncan Reid");
  });

  it("returns empty for a missing or unreadable token", () => {
    expect(displayNameFromToken("")).toEqual("");
    expect(displayNameFromToken("not-a-token")).toEqual("");
  });

});

describe("applyJitsiHostPageTheme", () => {

  it("paints Jitsi's overflowing video-menu button in Ramblers sunrise once", () => {
    const created: {id: string; textContent: string}[] = [];
    const page = {
      getElementById: (id: string) => created.find(item => item.id === id) || null,
      createElement: () => ({id: "", textContent: ""}),
      head: {
        appendChild: (node: {id: string; textContent: string}) => {
          created.push(node);
        }
      }
    };
    const iframe = {contentDocument: page} as unknown as HTMLIFrameElement;
    applyJitsiHostPageTheme(iframe);
    applyJitsiHostPageTheme(iframe);
    expect(created.length).toEqual(1);
    expect(created[0].id).toEqual(JITSI_HOST_PAGE_STYLE_ID);
    expect(created[0].textContent).toContain(JITSI_SUNRISE);
    expect(created[0].textContent).toContain("#localvideomenu button");
    expect(created[0].textContent).toContain(".vertical-filmstrip #filmstripRemoteVideos");
  });

});

describe("applyJitsiIframeAllow", () => {

  it("asks the browser to allow camera, microphone and sound in the meeting frame", () => {
    const attributes: Record<string, string> = {};
    const iframe = {
      setAttribute: (name: string, value: string) => {
        attributes[name] = value;
      }
    } as HTMLIFrameElement;
    applyJitsiIframeAllow(iframe);
    expect(attributes.allow).toEqual(JITSI_IFRAME_ALLOW);
    expect(attributes.allowfullscreen).toEqual("true");
  });

});
