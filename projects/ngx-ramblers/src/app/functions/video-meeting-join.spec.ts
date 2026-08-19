import { describe, expect, it } from "vitest";
import { JitsiJoinMode } from "../models/video-meeting.model";
import { jitsiHostPageUrl, jitsiJoinMode, suggestedVideoMeetingTitle, videoMeetingRoomSlug } from "./video-meeting-join";

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

describe("videoMeetingRoomSlug", () => {

  it("builds a readable room from the brand, date and a short number", () => {
    expect(videoMeetingRoomSlug("Ramblers Video Meetings", "18-august-2026", "1847"))
      .toEqual("ramblers-video-meetings-18-august-2026-1847");
  });

});
