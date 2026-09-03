import { describe, expect, it } from "vitest";
import { JitsiJoinMode, VideoMeetingRuntimeConfig } from "../models/video-meeting.model";
import {
  applyJitsiHostPageTheme,
  applyJitsiIframeAllow,
  displayNameFromToken,
  duplicateOccupantIdsToKick,
  guestMeetingOccupantId,
  JITSI_HOST_PAGE_STYLE_ID,
  JITSI_IFRAME_ALLOW,
  JITSI_SUNRISE,
  jitsiEmbedConfigOverwrite,
  jitsiHostPageUrl,
  jitsiJoinMode,
  joinVideoMeetingAsGuest,
  memberMeetingQueryParams,
  nameFromEmailAddress,
  shouldPromptForGuestName,
  usableMeetingDisplayName,
  occupantIdentityKey,
  suggestedVideoMeetingTitle,
  tokenUserFromJwt,
  videoMeetingTitleFromRoom,
  videoMeetingDisplayName,
  videoMeetingPeople,
  videoMeetingRoomSlug
} from "./video-meeting-join";
import { MeetingGuestOccupantKind, MeetingOccupantIdentity } from "../models/video-meeting.model";

function fakeJwt(user: {name?: string; id?: string; email?: string; moderator?: boolean}): string {
  const payload = Buffer.from(JSON.stringify({context: {user}})).toString("base64")
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

describe("videoMeetingTitleFromRoom", () => {

  it("turns a room slug into a readable meeting title", () => {
    expect(videoMeetingTitleFromRoom("video-meeting-with-nick-and-vignesh-1-september-2026-8055"))
      .toEqual("Video Meeting With Nick And Vignesh 1 September 2026");
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
      {participantId: "them", formattedDisplayName: "Jane Walker", email: "jane@example.org"}
    ], "me")).toEqual([
      {participantId: "me", displayName: "Nick Barrett", email: null, local: true},
      {participantId: "them", displayName: "Jane Walker", email: "jane@example.org", local: false}
    ]);
  });

  it("ignores empty or malformed participant rows", () => {
    expect(videoMeetingPeople([{displayName: "Nobody"}], "me")).toEqual([]);
    expect(videoMeetingPeople(null, "me")).toEqual([]);
  });

});

describe("jitsiEmbedConfigOverwrite", () => {

  it("keeps the Jitsi prejoin screen so people check their microphone and camera before entering", () => {
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
    expect(overwrite.filmstrip.disableResizable).toEqual(true);
    expect(overwrite.filmstrip.disableStageFilmstrip).toEqual(false);
  });

  it("leaves the lobby off unless that setting is on", () => {
    expect(jitsiEmbedConfigOverwrite(runtime(), "Meeting").disableLobby).toEqual(true);
    expect(jitsiEmbedConfigOverwrite(runtime({enableLobby: true}), "Meeting").disableLobby).toEqual(false);
    expect(jitsiEmbedConfigOverwrite(runtime({enableLobby: true}), "Meeting").lobby.autoKnock).toEqual(true);
  });

});

describe("joinVideoMeetingAsGuest", () => {

  it("joins a logged-in member as themselves even when they opened the guest link", () => {
    expect(joinVideoMeetingAsGuest(true, true)).toEqual(false);
  });

  it("joins as a guest when the guest link is opened with no login", () => {
    expect(joinVideoMeetingAsGuest(true, false)).toEqual(true);
  });

  it("joins as a member on the logged-in meeting path", () => {
    expect(joinVideoMeetingAsGuest(false, true)).toEqual(false);
    expect(joinVideoMeetingAsGuest(false, false)).toEqual(false);
  });

});

describe("memberMeetingQueryParams", () => {

  it("drops the guest token so a logged-in member is not joined with a guest identity", () => {
    const params = {
      keys: ["t", "meeting-title"],
      get: (name: string) => name === "t" ? "guest-jwt" : name === "meeting-title" ? "Committee meeting" : null
    };
    expect(memberMeetingQueryParams(params)).toEqual({"meeting-title": "Committee meeting"});
  });

  it("keeps other query params when there is no guest token", () => {
    const params = {
      keys: ["meeting-title"],
      get: (name: string) => name === "meeting-title" ? "Walk planning" : null
    };
    expect(memberMeetingQueryParams(params)).toEqual({"meeting-title": "Walk planning"});
  });

});

describe("usableMeetingDisplayName", () => {

  it("rejects blank and generic Guest labels", () => {
    expect(usableMeetingDisplayName("")).toEqual(false);
    expect(usableMeetingDisplayName("Guest")).toEqual(false);
    expect(usableMeetingDisplayName("fellow jitster")).toEqual(false);
  });

  it("accepts a real name people can recognise", () => {
    expect(usableMeetingDisplayName("Andrew Barrett")).toEqual(true);
  });

});

describe("shouldPromptForGuestName", () => {

  it("asks a guest to type a name when they would otherwise appear as Guest", () => {
    expect(shouldPromptForGuestName(true, "")).toEqual(true);
    expect(shouldPromptForGuestName(true, "Guest")).toEqual(true);
    expect(shouldPromptForGuestName(true, "Andrew Barrett")).toEqual(false);
    expect(shouldPromptForGuestName(false, "")).toEqual(false);
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
    expect(displayNameFromToken(fakeJwt({name: "Duncan Reid"}))).toEqual("Duncan Reid");
  });

  it("returns empty for a missing or unreadable token", () => {
    expect(displayNameFromToken("")).toEqual("");
    expect(displayNameFromToken("not-a-token")).toEqual("");
  });

});

describe("tokenUserFromJwt", () => {

  it("reads identity, email and moderator from the meeting token", () => {
    expect(tokenUserFromJwt(fakeJwt({
      id: "guest-email:jane@example.org",
      name: "Jane Walker",
      email: "jane@example.org",
      moderator: false
    }))).toEqual({
      id: "guest-email:jane@example.org",
      name: "Jane Walker",
      email: "jane@example.org",
      moderator: false
    });
  });

  it("treats a string moderator flag as true", () => {
    const payload = Buffer.from(JSON.stringify({context: {user: {name: "Nick", moderator: "true"}}})).toString("base64")
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(tokenUserFromJwt(`header.${payload}.signature`).moderator).toEqual(true);
  });

});

describe("guestMeetingOccupantId", () => {

  it("identifies an invited guest by email so a second join replaces the first", () => {
    expect(guestMeetingOccupantId("committee-2026", "Jane.Walker@example.org"))
      .toEqual(`${MeetingGuestOccupantKind.EMAIL}:jane.walker@example.org`);
  });

  it("gives unnamed guests one shared seat in the room", () => {
    expect(guestMeetingOccupantId("committee-2026", ""))
      .toEqual(`${MeetingGuestOccupantKind.ANONYMOUS}:committee-2026`);
    expect(guestMeetingOccupantId("committee-2026", "  "))
      .toEqual(`${MeetingGuestOccupantKind.ANONYMOUS}:committee-2026`);
  });

});

describe("occupantIdentityKey", () => {

  it("prefers email when Jitsi exposes it", () => {
    expect(occupantIdentityKey({displayName: "Jane Walker", email: "jane@example.org"}))
      .toEqual("email:jane@example.org");
  });

  it("treats unnamed Guest tiles as the same occupant", () => {
    expect(occupantIdentityKey({displayName: "Guest", email: null}))
      .toEqual(MeetingOccupantIdentity.ANONYMOUS_GUEST);
    expect(occupantIdentityKey({displayName: "Fellow Jitster", email: null}))
      .toEqual(MeetingOccupantIdentity.ANONYMOUS_GUEST);
    expect(occupantIdentityKey({displayName: "Guest (me)", email: null}))
      .toEqual(MeetingOccupantIdentity.ANONYMOUS_GUEST);
  });

  it("identifies a named person without email by display name", () => {
    expect(occupantIdentityKey({displayName: "Nick Barrett", email: null})).toEqual("name:nick barrett");
  });

});

describe("duplicateOccupantIdsToKick", () => {

  it("keeps the newest unnamed Guest and kicks the rest", () => {
    expect(duplicateOccupantIdsToKick([
      {participantId: "g1", displayName: "Guest", email: null, local: false},
      {participantId: "g2", displayName: "Guest", email: null, local: false},
      {participantId: "g3", displayName: "Guest", email: null, local: false}
    ], "me")).toEqual(["g1", "g2"]);
  });

  it("keeps a newly joined occupant when one is preferred", () => {
    expect(duplicateOccupantIdsToKick([
      {participantId: "g1", displayName: "Guest", email: null, local: false},
      {participantId: "g2", displayName: "Guest", email: null, local: false}
    ], "me", "g1")).toEqual(["g2"]);
  });

  it("never kicks the local occupant when they share an identity", () => {
    expect(duplicateOccupantIdsToKick([
      {participantId: "old", displayName: "Nick Barrett", email: "nick@example.org", local: false},
      {participantId: "me", displayName: "Nick Barrett", email: "nick@example.org", local: true}
    ], "me")).toEqual(["old"]);
  });

  it("does not treat a named guest as the same person as an unnamed Guest", () => {
    expect(duplicateOccupantIdsToKick([
      {participantId: "g1", displayName: "Guest", email: null, local: false},
      {participantId: "jane", displayName: "Jane Walker", email: "jane@example.org", local: false}
    ], "me")).toEqual([]);
  });

  it("kicks a second join of the same invited email", () => {
    expect(duplicateOccupantIdsToKick([
      {participantId: "first", displayName: "Jane Walker", email: "jane@example.org", local: false},
      {participantId: "retry", displayName: "Jane Walker", email: "jane@example.org", local: false}
    ], "me", "retry")).toEqual(["first"]);
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
    expect(created[0].textContent).toContain(".tile-view .filmstrip");
    expect(created[0].textContent).not.toContain(".toggleFilmstripContainer");
    expect(created[0].textContent).not.toContain(".horizontal-filmstrip .filmstrip");
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
