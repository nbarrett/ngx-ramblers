import { describe, expect, it } from "vitest";
import { JitsiJoinMode, VideoMeetingRuntimeConfig } from "../models/video-meeting.model";
import {
  applyJitsiIframeAllow,
  JITSI_IFRAME_ALLOW,
  jitsiEmbedConfigOverwrite,
  jitsiHostPageUrl,
  jitsiJoinMode,
  suggestedVideoMeetingTitle,
  videoMeetingDisplayName,
  videoMeetingRoomSlug
} from "./video-meeting-join";

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

describe("jitsiEmbedConfigOverwrite", () => {

  it("always shows a device preview and hides join-without-audio extras", () => {
    const overwrite = jitsiEmbedConfigOverwrite(runtime(), "Committee meeting");
    expect(overwrite.prejoinPageEnabled).toEqual(true);
    expect(overwrite.prejoinConfig.enabled).toEqual(true);
    expect(overwrite.prejoinConfig.hideExtraJoinButtons).toEqual(["no-audio", "no-video"]);
    expect(overwrite.transcription.enabled).toEqual(false);
    expect(overwrite.transcription.disableClosedCaptions).toEqual(true);
    expect(overwrite.transcribingEnabled).toEqual(false);
    expect(overwrite.disableDeepLinking).toEqual(true);
    expect(overwrite.toolbarConfig.alwaysVisible).toEqual(true);
    expect(overwrite.subject).toEqual("Committee meeting");
  });

  it("leaves the lobby off unless that setting is on", () => {
    expect(jitsiEmbedConfigOverwrite(runtime(), "Meeting").disableLobby).toEqual(true);
    expect(jitsiEmbedConfigOverwrite(runtime({enableLobby: true}), "Meeting").disableLobby).toEqual(false);
    expect(jitsiEmbedConfigOverwrite(runtime({enableLobby: true}), "Meeting").lobby.autoKnock).toEqual(true);
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
