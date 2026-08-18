import { describe, expect, it } from "vitest";
import { JitsiJoinMode } from "../models/video-meeting.model";
import { jitsiHostPageUrl, jitsiJoinMode } from "./video-meeting-join";

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

});
