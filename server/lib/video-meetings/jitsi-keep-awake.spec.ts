import expect from "expect";
import sinon from "sinon";
import { afterEach, beforeEach, describe, it } from "mocha";
import { keepJitsiAwake, noteMeetingKeepAwake, refreshKeepAwake, resetKeepAwakeState } from "./jitsi-keep-awake";
import * as videoMeetingsConfig from "./video-meetings-config";
import * as dates from "../shared/dates";
import { VideoMeetingRuntimeConfig } from "../../../projects/ngx-ramblers/src/app/models/video-meeting.model";

function runtime(overrides: Partial<VideoMeetingRuntimeConfig> = {}): VideoMeetingRuntimeConfig {
  return {
    enabled: true,
    host: "https://ngx-ramblers-jitsi.fly.dev",
    jwtRequired: true,
    publicHost: false,
    roomPrefix: "ngx",
    brandName: "Test",
    guestInstructions: "",
    startWithAudioMuted: false,
    startWithVideoMuted: false,
    enableNotes: true,
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

describe("jitsi keep-awake", () => {
  let sandbox: sinon.SinonSandbox;
  let fetchStub: sinon.SinonStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    resetKeepAwakeState();
    fetchStub = sandbox.stub(globalThis, "fetch").resolves({ok: true} as Response);
  });

  afterEach(() => {
    resetKeepAwakeState();
    sandbox.restore();
  });

  it("rejects a keep-awake post with no room", async () => {
    const res = mockResponse();
    await keepJitsiAwake({body: {}} as any, res);
    expect(res.statusCode).toEqual(400);
    expect(fetchStub.called).toEqual(false);
  });

  it("pings the self-hosted Jitsi host when a room is still in a call", async () => {
    sandbox.stub(videoMeetingsConfig, "resolveVideoMeetingRuntime").resolves(runtime());
    sandbox.stub(dates, "dateTimeNowAsValue").returns(1_000_000);
    const res = mockResponse();
    await keepJitsiAwake({body: {room: "ngx-meeting-23-september-2026-1383"}} as any, res);
    expect(res.statusCode).toEqual(200);
    expect(fetchStub.calledOnce).toEqual(true);
    expect(fetchStub.firstCall.args[0]).toEqual("https://ngx-ramblers-jitsi.fly.dev/");
  });

  it("does not ping meet.jit.si", async () => {
    sandbox.stub(videoMeetingsConfig, "resolveVideoMeetingRuntime")
      .resolves(runtime({host: "https://meet.jit.si", publicHost: true, jwtRequired: false}));
    await noteMeetingKeepAwake("room-1");
    expect(fetchStub.called).toEqual(false);
  });

  it("stops pinging once every room has gone quiet", async () => {
    const now = sandbox.stub(dates, "dateTimeNowAsValue");
    sandbox.stub(videoMeetingsConfig, "resolveVideoMeetingRuntime").resolves(runtime());
    now.returns(1_000_000);
    await noteMeetingKeepAwake("room-1");
    expect(fetchStub.callCount).toEqual(1);
    now.returns(1_000_000 + 90_001);
    const stillActive = await refreshKeepAwake();
    expect(stillActive).toEqual(false);
    expect(fetchStub.callCount).toEqual(1);
  });
});
