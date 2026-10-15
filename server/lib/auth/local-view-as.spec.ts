import expect from "expect";
import { NextFunction, Request, Response } from "express";
import { applyViewAs, requireReadOnlyViewAs } from "./local-view-as";
import { VIEW_AS_MEMBER_HEADER } from "../../../projects/ngx-ramblers/src/app/functions/member-cookie";
import { member as memberModel } from "../mongo/models/member";
import { Member, MemberCookie } from "../../../projects/ngx-ramblers/src/app/models/member.model";

const actorId = "aaaaaaaaaaaaaaaaaaaaaaaa";
const targetId = "bbbbbbbbbbbbbbbbbbbbbbbb";
const target: Partial<Member> = {id: targetId, firstName: "Alex", lastName: "Reed", userName: "alex.reed", memberAdmin: false};

function request(slug: string | null = targetId, method = "GET"): Request {
  return {method, headers: slug ? {[VIEW_AS_MEMBER_HEADER]: slug} : {}, user: {memberId: actorId, memberAdmin: true, viewAsMember: true}} as unknown as Request;
}

function storedMember(member: Partial<Member>) {
  return {toObject: () => ({...member, _id: member.id})};
}

describe("View as another member", () => {
  const originalFindById = memberModel.findById;
  const originalFindOne = memberModel.findOne;
  const state = {administrator: {id: actorId, memberAdmin: true, viewAsMember: true} as Partial<Member>, targetExists: true, lookups: [] as string[]};

  beforeEach(() => {
    state.administrator = {id: actorId, memberAdmin: true, viewAsMember: true};
    state.targetExists = true;
    state.lookups = [];
    memberModel.findById = (async (id: string) => {
      state.lookups.push(id);
      return id === actorId ? storedMember(state.administrator) : state.targetExists ? storedMember(target) : null;
    }) as unknown as typeof memberModel.findById;
    memberModel.findOne = (async () => state.targetExists ? storedMember(target) : null) as unknown as typeof memberModel.findOne;
  });

  afterEach(() => {
    memberModel.findById = originalFindById;
    memberModel.findOne = originalFindOne;
  });

  it("uses the target permissions while leaving the real token identity unchanged", async () => {
    const req = request();
    const realIdentity = req.user;
    await applyViewAs(req);
    expect((req.user as MemberCookie).memberId).toBe(targetId);
    expect((req.user as MemberCookie).memberAdmin).toBe(false);
    expect((realIdentity as MemberCookie).memberId).toBe(actorId);
    expect(state.lookups).toEqual([actorId, targetId]);
  });

  it("supports existing user-name links", async () => {
    const req = request("alex-reed");
    await applyViewAs(req);
    expect((req.user as MemberCookie).memberId).toBe(targetId);
  });

  it("does not query members for normal requests", async () => {
    const req = request(null);
    await applyViewAs(req);
    expect(state.lookups).toEqual([]);
    expect((req.user as MemberCookie).memberId).toBe(actorId);
  });

  it("rejects a forged header without the dedicated grant despite an old privileged token", async () => {
    state.administrator.viewAsMember = false;
    await expect(applyViewAs(request())).rejects.toMatchObject({status: 403});
    expect(state.lookups).toEqual([actorId]);
  });

  it("rejects revoked administrator accounts", async () => {
    state.administrator.revoked = true;
    await expect(applyViewAs(request())).rejects.toMatchObject({status: 403});
  });

  it("requires current Member Admin permission as well as the dedicated grant", async () => {
    state.administrator.memberAdmin = false;
    await expect(applyViewAs(request())).rejects.toMatchObject({status: 403});
  });

  it("rejects missing targets rather than silently acting as the administrator", async () => {
    state.targetExists = false;
    await expect(applyViewAs(request())).rejects.toMatchObject({status: 404});
  });

  it("rejects writes before replacing the identity", async () => {
    const req = request(targetId, "POST");
    await expect(applyViewAs(req)).rejects.toMatchObject({status: 403});
    expect((req.user as MemberCookie).memberId).toBe(actorId);
  });

  it("blocks writes even for routes with no authentication middleware", () => {
    const state = {status: 0, proceeded: false};
    const res = {status: (status: number) => {state.status = status; return res;}, json: () => null} as unknown as Response;
    requireReadOnlyViewAs(request(targetId, "DELETE"), res, (() => {state.proceeded = true;}) as NextFunction);
    expect(state.status).toBe(403);
    expect(state.proceeded).toBe(false);
  });
});
