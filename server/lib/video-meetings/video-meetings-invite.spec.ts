import expect from "expect";
import sinon from "sinon";
import { afterEach, beforeEach, describe, it } from "mocha";
import { handleGuestInvite } from "./video-meetings-controllers";
import * as videoMeetingsConfig from "./video-meetings-config";
import * as guestInviteEmail from "./send-guest-invite-email";
import * as systemConfigModule from "../config/system-config";
import * as configModule from "../mongo/controllers/config";
import { VideoMeetingRuntimeConfig } from "../../../projects/ngx-ramblers/src/app/models/video-meeting.model";

function runtime(overrides: Partial<VideoMeetingRuntimeConfig> = {}): VideoMeetingRuntimeConfig {
  return {
    enabled: true,
    host: "https://meet.jit.si",
    jwtRequired: false,
    publicHost: true,
    roomPrefix: "",
    brandName: "Test Ramblers",
    guestInstructions: "Configured joining guidance for guests.",
    startWithAudioMuted: false,
    startWithVideoMuted: false,
    enableNotes: false,
    enableLobby: false,
    ...overrides
  };
}

function mockResponse() {
  const res: any = {statusCode: undefined, body: undefined};
  res.status = sinon.stub().callsFake((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = sinon.stub().callsFake((payload: any) => {
    res.body = payload;
    return res;
  });
  return res;
}

describe("video-meetings guest invite endpoint", () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("rejects with 400 when room or email is missing, without touching the mail provider", async () => {
    const sendStub = sandbox.stub(guestInviteEmail, "sendGuestInviteEmail");
    const res = mockResponse();

    await handleGuestInvite({body: {room: "", email: ""}} as any, res);

    expect(res.statusCode).toEqual(400);
    expect(res.body).toEqual({message: "room and email are required"});
    expect(sendStub.called).toEqual(false);
  });

  function stubCommitteeRoles(roles: any[]): void {
    sandbox.stub(configModule, "queryKey").resolves({value: {roles}} as any);
  }

  it("sends from the inviting member's committee role email and reports it as sent when a provider is configured", async () => {
    sandbox.stub(videoMeetingsConfig, "resolveVideoMeetingRuntime").resolves(runtime());
    sandbox.stub(systemConfigModule, "systemConfig").resolves({group: {href: "https://ngx.example.org"}} as any);
    stubCommitteeRoles([{type: "secretary", memberId: "m1", email: "secretary@ngx.example.org", fullName: "Nick Barrett"}]);
    const sendStub = sandbox.stub(guestInviteEmail, "sendGuestInviteEmail").resolves(true);
    const res = mockResponse();

    await handleGuestInvite(
      {body: {room: "committee-2026-08", email: "guest@example.org", name: "Guest One"}, user: {memberId: "m1", firstName: "Nick", lastName: "Barrett"}} as any,
      res);

    expect(res.statusCode).toEqual(200);
    expect(res.body.sent).toEqual(true);
    expect(res.body.room).toEqual("committee-2026-08");
    expect(res.body.link).toEqual("https://ngx.example.org/video-meetings/guest/committee-2026-08");
    expect(sendStub.calledOnce).toEqual(true);
    const [sender, toEmail, toName, subject, html] = sendStub.firstCall.args;
    expect(sender).toEqual({name: "Nick Barrett", email: "secretary@ngx.example.org"});
    expect(toEmail).toEqual("guest@example.org");
    expect(toName).toEqual("Guest One");
    expect(subject).toEqual("You are invited to a Test Ramblers video meeting");
    expect(html).toContain("Nick Barrett");
    expect(html).toContain("https://ngx.example.org/video-meetings/guest/committee-2026-08");
    expect(html).toContain("Configured joining guidance for guests.");
  });

  it("passes a null sender when the inviting member holds no committee role with an email", async () => {
    sandbox.stub(videoMeetingsConfig, "resolveVideoMeetingRuntime").resolves(runtime());
    sandbox.stub(systemConfigModule, "systemConfig").resolves({group: {href: "https://ngx.example.org"}} as any);
    stubCommitteeRoles([{type: "secretary", memberId: "someone-else", email: "secretary@ngx.example.org", fullName: "Someone Else"}]);
    const sendStub = sandbox.stub(guestInviteEmail, "sendGuestInviteEmail").resolves(false);
    const res = mockResponse();

    await handleGuestInvite({body: {room: "committee-2026-08", email: "guest@example.org"}, user: {memberId: "m1"}} as any, res);

    expect(res.statusCode).toEqual(200);
    expect(res.body.sent).toEqual(false);
    expect(res.body.link).toEqual("https://ngx.example.org/video-meetings/guest/committee-2026-08");
    expect(sendStub.firstCall.args[0]).toEqual(null);
  });

  it("still returns a copyable link with sent:false when no mail provider is configured", async () => {
    sandbox.stub(videoMeetingsConfig, "resolveVideoMeetingRuntime").resolves(runtime());
    sandbox.stub(systemConfigModule, "systemConfig").resolves({group: {href: "https://ngx.example.org"}} as any);
    stubCommitteeRoles([{type: "secretary", memberId: "m1", email: "secretary@ngx.example.org", fullName: "Nick Barrett"}]);
    sandbox.stub(guestInviteEmail, "sendGuestInviteEmail").resolves(false);
    const res = mockResponse();

    await handleGuestInvite({body: {room: "committee-2026-08", email: "guest@example.org"}, user: {memberId: "m1"}} as any, res);

    expect(res.statusCode).toEqual(200);
    expect(res.body.sent).toEqual(false);
    expect(res.body.link).toEqual("https://ngx.example.org/video-meetings/guest/committee-2026-08");
  });

  it("appends a signed guest token to the link on a self-hosted (jwt-required) host", async () => {
    sandbox.stub(videoMeetingsConfig, "resolveVideoMeetingRuntime")
      .resolves(runtime({host: "https://ngx-ramblers-jitsi.fly.dev", jwtRequired: true, publicHost: false}));
    sandbox.stub(videoMeetingsConfig, "jitsiJwtCredentials")
      .returns({appId: "ngx-ramblers", appSecret: "test-secret-value"});
    sandbox.stub(systemConfigModule, "systemConfig").resolves({group: {href: "https://ngx.example.org"}} as any);
    stubCommitteeRoles([{type: "secretary", memberId: "m1", email: "secretary@ngx.example.org", fullName: "Nick Barrett"}]);
    sandbox.stub(guestInviteEmail, "sendGuestInviteEmail").resolves(true);
    const res = mockResponse();

    await handleGuestInvite({body: {room: "committee-2026-08", email: "guest@example.org"}, user: {memberId: "m1"}} as any, res);

    expect(res.statusCode).toEqual(200);
    expect(res.body.link).toContain("https://ngx.example.org/video-meetings/guest/committee-2026-08?t=");
  });

  it("responds with 500 when invite processing fails", async () => {
    sandbox.stub(videoMeetingsConfig, "resolveVideoMeetingRuntime").rejects(new Error("boom"));
    const res = mockResponse();

    await handleGuestInvite({body: {room: "room-1", email: "guest@example.org"}} as any, res);

    expect(res.statusCode).toEqual(500);
    expect(res.body.message).toEqual("Failed to send guest invite");
  });
});
