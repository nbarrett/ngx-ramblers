import expect from "expect";
import sinon from "sinon";
import { afterEach, beforeEach, describe, it } from "mocha";
import { NextFunction, Request, Response } from "express";
import { AccessLevel } from "../../../projects/ngx-ramblers/src/app/models/member-resource.model";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { DEFAULT_MOBILE_APP_CONFIG } from "../../../projects/ngx-ramblers/src/app/models/walks-config.model";
import * as config from "../mongo/controllers/config";
import { requireMobileImport } from "./mobile-app-access";

describe("requireMobileImport", () => {
  const sandbox = sinon.createSandbox();
  let status: sinon.SinonStub;
  let json: sinon.SinonStub;
  let next: sinon.SinonStub;

  beforeEach(() => {
    json = sandbox.stub();
    status = sandbox.stub().returns({json});
    next = sandbox.stub();
  });

  afterEach(() => sandbox.restore());

  function request(user: object, body: object = {}): Request {
    return {user, body} as unknown as Request;
  }

  function response(): Response {
    return {status} as unknown as Response;
  }

  it("lets a walks administrator import even when walking-app import is hidden", async () => {
    sandbox.stub(config, "queryKey").withArgs(ConfigKey.WALKS).resolves({
      value: {mobileApp: {...DEFAULT_MOBILE_APP_CONFIG, import: AccessLevel.HIDDEN, access: AccessLevel.HIDDEN}}
    } as never);
    await requireMobileImport(request({memberId: "fictional-admin", walkAdmin: true}), response(), next as unknown as NextFunction);
    expect(next.calledOnce).toBe(true);
    expect(status.called).toBe(false);
  });

  it("rejects an ordinary member when walking-app import is hidden", async () => {
    sandbox.stub(config, "queryKey").withArgs(ConfigKey.WALKS).resolves({
      value: {mobileApp: {...DEFAULT_MOBILE_APP_CONFIG, import: AccessLevel.HIDDEN}}
    } as never);
    await requireMobileImport(request({memberId: "fictional-member"}), response(), next as unknown as NextFunction);
    expect(next.called).toBe(false);
    expect(status.calledWith(403)).toBe(true);
  });

  it("allows a logged-in member when walking-app import is at the default", async () => {
    sandbox.stub(config, "queryKey").withArgs(ConfigKey.WALKS).resolves({
      value: {mobileApp: {...DEFAULT_MOBILE_APP_CONFIG}}
    } as never);
    await requireMobileImport(request({memberId: "fictional-member"}), response(), next as unknown as NextFunction);
    expect(next.calledOnce).toBe(true);
  });
});
