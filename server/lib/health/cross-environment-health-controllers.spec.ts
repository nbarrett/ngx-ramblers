import {EventEmitter} from "node:events";
import expect from "expect";
import {afterEach, beforeEach, describe, it} from "mocha";
import sinon from "sinon";
import {Request, Response} from "express";
import * as health from "./cross-environment-health";
import {allEnvironmentHealth, streamEnvironmentHealth} from "./cross-environment-health-controllers";
import {Environment} from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import {EnvironmentHealthEventType} from "../../../projects/ngx-ramblers/src/app/models/health.model";

const sandbox = sinon.createSandbox();

function response() {
  const emitter = new EventEmitter();
  const res = Object.assign(emitter, {
    status: sandbox.stub().returnsThis(), json: sandbox.stub().returnsThis(), setHeader: sandbox.spy(),
    flushHeaders: sandbox.spy(), write: sandbox.spy(), end: sandbox.spy(), destroyed: false
  });
  return {res: res as unknown as Response, calls: res};
}

describe("environment health handlers", () => {
  const original = {platformEnabled: null as string | null};
  beforeEach(() => original.platformEnabled = process.env[Environment.PLATFORM_ADMIN_ENABLED] || null);
  afterEach(() => {
    sandbox.restore();
    if (original.platformEnabled === null) {
      delete process.env[Environment.PLATFORM_ADMIN_ENABLED];
    } else {
      process.env[Environment.PLATFORM_ADMIN_ENABLED] = original.platformEnabled;
    }
  });

  it("keeps the platform guard on both endpoints", async () => {
    process.env[Environment.PLATFORM_ADMIN_ENABLED] = "false";
    const checks = sandbox.stub(health, "crossEnvironmentHealth");
    for (const handler of [allEnvironmentHealth, streamEnvironmentHealth]) {
      const {res, calls} = response();
      await handler({} as Request, res);
      expect(calls.status.calledWith(403)).toBe(true);
    }
    expect(checks.called).toBe(false);
  });

  it("streams a readable error after headers have been sent", async () => {
    process.env[Environment.PLATFORM_ADMIN_ENABLED] = "true";
    sandbox.stub(health, "crossEnvironmentHealth").rejects(new Error("Checks unavailable"));
    const {res, calls} = response();
    await streamEnvironmentHealth({} as Request, res);
    expect(calls.setHeader.calledWith("Cache-Control", "no-cache, no-transform")).toBe(true);
    expect(JSON.parse(calls.write.firstCall.args[0])).toEqual({type: EnvironmentHealthEventType.ERROR, error: "Checks unavailable"});
    expect(calls.end.calledOnce).toBe(true);
  });

  it("aborts server checks when the client closes the stream", async () => {
    process.env[Environment.PLATFORM_ADMIN_ENABLED] = "true";
    const {res, calls} = response();
    const captured = {signal: null as AbortSignal | null};
    sandbox.stub(health, "crossEnvironmentHealth").callsFake(async (_progress, signal) => {
      captured.signal = signal;
      return await new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), {once: true}));
    });
    const pending = streamEnvironmentHealth({} as Request, res);
    calls.emit("close");
    await pending;
    expect(captured.signal.aborted).toBe(true);
    expect(calls.write.called).toBe(false);
    expect(calls.listenerCount("close")).toBe(0);
  });
});
