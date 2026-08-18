import expect from "expect";
import { describe, it } from "mocha";
import { isPublicJitsiHost } from "./video-meetings-config";

describe("isPublicJitsiHost", () => {

  it("treats meet.jit.si and 8x8.vc as the public service", () => {
    expect(isPublicJitsiHost("https://meet.jit.si")).toEqual(true);
    expect(isPublicJitsiHost("https://meet.jit.si/")).toEqual(true);
    expect(isPublicJitsiHost("https://8x8.vc")).toEqual(true);
  });

  it("does not treat a self-hosted host as the public service", () => {
    expect(isPublicJitsiHost("https://localhost:8443")).toEqual(false);
    expect(isPublicJitsiHost("https://ngx-ramblers-jitsi.fly.dev")).toEqual(false);
  });

});
