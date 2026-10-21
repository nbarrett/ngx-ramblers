import expect from "expect";
import sinon from "sinon";
import { afterEach, describe, it } from "mocha";
import { Request, Response } from "express";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import * as config from "./cloudflare-config";
import * as inventory from "./cloudflare-worker-inventory";
import { requireWorkerInventoryAccess, workerInventory } from "./cloudflare-worker-inventory-controllers";

const request = {} as Request;

describe("worker inventory access", () => {
  const sandbox = sinon.createSandbox();
  afterEach(() => sandbox.restore());

  it("denies access when platform administration is disabled", () => {
    sandbox.stub(process, "env").value({...process.env, [Environment.PLATFORM_ADMIN_ENABLED]: "false"});
    const json = sandbox.spy();
    const status = sandbox.stub().returns({json});
    const next = sandbox.spy();
    requireWorkerInventoryAccess(request, {status} as unknown as Response, next);
    expect(status.calledWith(403)).toBe(true);
    expect(next.called).toBe(false);
  });

  it("allows the authenticated administrator chain to continue on a platform environment", () => {
    sandbox.stub(process, "env").value({...process.env, [Environment.PLATFORM_ADMIN_ENABLED]: "true"});
    const next = sandbox.spy();
    requireWorkerInventoryAccess(request, {} as Response, next);
    expect(next.calledOnce).toBe(true);
  });

  it("does not contact Cloudflare when account credentials are missing", async () => {
    sandbox.stub(config, "configuredCloudflare").resolves({});
    const query = sandbox.stub(inventory, "cloudflareWorkerInventory");
    const json = sandbox.spy();
    const status = sandbox.stub().returns({json});
    await workerInventory(request, {status} as unknown as Response);
    expect(status.calledWith(400)).toBe(true);
    expect(query.called).toBe(false);
  });
});
