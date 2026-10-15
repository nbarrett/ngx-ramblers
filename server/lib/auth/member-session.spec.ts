import expect from "expect";
import sinon from "sinon";
import express, { Request, Response } from "express";
import { Server } from "node:http";
import { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import { member } from "../mongo/models/member";
import { refreshToken } from "../mongo/models/refresh-token";
import { refresh } from "../mongo/controllers/auth";
import { currentMemberSession } from "./member-session";
import { authenticate, requireAdmin, signValue, tokenExpiry } from "./auth-config";
import { verifiedMember } from "./request-member";
import { envConfig } from "../env-config/env-config";
import { Member } from "../../../projects/ngx-ramblers/src/app/models/member.model";

const memberId = "aaaaaaaaaaaaaaaaaaaaaaaa";

describe("Current member privileges across existing sessions", () => {
  const sandbox = sinon.createSandbox();
  const state = {member: {id: memberId, firstName: "Alex", lastName: "Reed", memberAdmin: true, viewAsMember: false, groupMember: true} as Member, exists: true};
  const serverState = {server: null as Server | null};

  beforeEach(() => {
    state.member = {id: memberId, firstName: "Alex", lastName: "Reed", memberAdmin: true, viewAsMember: false, groupMember: true};
    state.exists = true;
    sandbox.stub(member, "findById").callsFake((async () => state.exists ? {toObject: () => ({...state.member, _id: memberId})} : null) as unknown as typeof member.findById);
  });

  afterEach(async () => {
    sandbox.restore();
    if (serverState.server) {
      await new Promise<void>((resolve, reject) => serverState.server.close(error => error ? reject(error) : resolve()));
      serverState.server = null;
    }
  });

  it("uses current privileges when renewing a token issued before an administrator's change", async () => {
    sandbox.stub(refreshToken, "findOne").resolves({memberPayload: {memberId, memberAdmin: true, viewAsMember: false}});
    state.member.memberAdmin = false;
    const response = {token: "", status: 0};
    const res = {json: value => {response.token = value.auth;}, sendStatus: value => {response.status = value;}} as unknown as Response;
    await refresh({body: {refreshToken: "fictional-refresh-token"}} as Request, res);
    const payload = jwt.verify(response.token, envConfig.auth().secret);
    expect(payload).toMatchObject({memberId, memberAdmin: false});
    expect(response.status).toBe(0);
  });

  it("rejects malformed refresh tokens before querying stored sessions", async () => {
    const lookup = sandbox.stub(refreshToken, "findOne");
    const response = {status: 0};
    await refresh({body: {refreshToken: {$ne: null}}} as Request, {sendStatus: status => {response.status = status;}} as Response);
    expect(response.status).toBe(401);
    expect(lookup.called).toBe(false);
  });

  it("refuses to renew revoked sessions", async () => {
    sandbox.stub(refreshToken, "findOne").resolves({memberPayload: {memberId}});
    state.member.revoked = true;
    const response = {status: 0};
    await refresh({body: {refreshToken: "fictional-refresh-token"}} as Request, {sendStatus: status => {response.status = status;}} as Response);
    expect(response.status).toBe(401);
  });

  it("blocks existing sessions when login is disabled or a password reset is required", async () => {
    state.member.groupMember = false;
    expect(await currentMemberSession(memberId)).toBeNull();
    state.member.groupMember = true;
    state.member.expiredPassword = true;
    expect(await currentMemberSession(memberId)).toBeNull();
  });

  it("fails closed for deleted members", async () => {
    state.exists = false;
    expect(await currentMemberSession(memberId)).toBeNull();
  });

  it("uses current rights even for token-based checks outside Passport", async () => {
    const token = signValue({memberId, memberAdmin: true}, tokenExpiry.auth);
    state.member.memberAdmin = false;
    expect(await verifiedMember({headers: {authorization: `Bearer ${token}`}} as Request)).toMatchObject({memberAdmin: false});
  });

  it("applies grants and removals to two computers using their original tokens", async () => {
    const app = express();
    app.get("/private", authenticate(), requireAdmin, (_req, res) => res.json({allowed: true}));
    serverState.server = await new Promise<Server>(resolve => {
      const server = app.listen(0, "127.0.0.1", () => resolve(server));
    });
    const url = `http://127.0.0.1:${(serverState.server.address() as AddressInfo).port}/private`;
    const computers = [signValue({memberId, memberAdmin: true}, tokenExpiry.auth), signValue({memberId, memberAdmin: true}, tokenExpiry.auth)];
    const statuses = async () => Promise.all(computers.map(async token => (await fetch(url, {headers: {Authorization: `Bearer ${token}`}})).status));
    expect(await statuses()).toEqual([200, 200]);
    state.member.memberAdmin = false;
    expect(await statuses()).toEqual([403, 403]);
    state.member.memberAdmin = true;
    expect(await statuses()).toEqual([200, 200]);
    state.member.revoked = true;
    expect(await statuses()).toEqual([401, 401]);
  });
});
