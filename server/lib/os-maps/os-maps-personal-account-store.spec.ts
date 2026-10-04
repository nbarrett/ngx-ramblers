import expect from "expect";
import sinon from "sinon";
import { afterEach, beforeEach, describe, it } from "mocha";
import { Request, Response } from "express";
import { envConfig } from "../env-config/env-config";
import * as mongooseClient from "../mongo/mongoose-client";
import { osMapsPersonalAccount } from "../mongo/models/os-maps-personal-account";
import { decryptJsonConfig, encryptJsonConfig } from "../shared/config-crypto";
import { personalOsMapsAccount, savePersonalOsMapsAccount } from "./os-maps-personal-account-store";
import { OsMapsPersonalCredentials } from "../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";

describe("personal OS Maps credentials", () => {
  const sandbox = sinon.createSandbox();
  const key = "fictional-encryption-key";
  beforeEach(() => {
    sandbox.stub(mongooseClient, "execute").callsFake(operation => operation());
    sandbox.stub(envConfig, "auth").returns({secret: key} as ReturnType<typeof envConfig.auth>);
  });
  afterEach(() => sandbox.restore());

  it("stores encrypted credentials against the authenticated member, ignoring a supplied member id", async () => {
    sandbox.stub(osMapsPersonalAccount, "findOne").returns({lean: async () => null} as never);
    const write = sandbox.stub(osMapsPersonalAccount, "findOneAndUpdate").resolves(null);
    const response = {status: sinon.stub(), json: sinon.stub()};
    response.status.returns(response);
    await savePersonalOsMapsAccount({user: {memberId: "alex"}, body: {memberId: "robin", email: " alex@example.com ", password: "fictional-password"}} as unknown as Request, response as unknown as Response);
    expect(write.firstCall.args[0]).toEqual({memberId: "alex"});
    const update = write.firstCall.args[1] as {$set: {encryptedCredentials: string}};
    expect(update.$set.encryptedCredentials).not.toContain("fictional-password");
    expect(decryptJsonConfig<OsMapsPersonalCredentials>(update.$set.encryptedCredentials, key)).toEqual({email: "alex@example.com", password: "fictional-password"});
    expect(response.json.firstCall.args[0]).toEqual({email: "alex@example.com", configured: true});
  });

  it("never returns the stored password when reading settings", async () => {
    sandbox.stub(osMapsPersonalAccount, "findOne").returns({lean: async () => ({encryptedCredentials: encryptJsonConfig({email: "alex@example.com", password: "fictional-password"}, key)})} as never);
    const response = {status: sinon.stub(), json: sinon.stub()};
    response.status.returns(response);
    await personalOsMapsAccount({user: {memberId: "alex"}} as unknown as Request, response as unknown as Response);
    expect(response.json.firstCall.args[0]).toEqual({email: "alex@example.com", configured: true});
  });

  it("requires a new password when changing to a different account", async () => {
    sandbox.stub(osMapsPersonalAccount, "findOne").returns({lean: async () => ({encryptedCredentials: encryptJsonConfig({email: "alex@example.com", password: "fictional-password"}, key)})} as never);
    const write = sandbox.stub(osMapsPersonalAccount, "findOneAndUpdate");
    const response = {status: sinon.stub(), json: sinon.stub()};
    response.status.returns(response);
    await savePersonalOsMapsAccount({user: {memberId: "alex"}, body: {email: "robin@example.com", password: ""}} as unknown as Request, response as unknown as Response);
    expect(response.status.calledWith(400)).toBe(true);
    expect(write.called).toBe(false);
  });
});
