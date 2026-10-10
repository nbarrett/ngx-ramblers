import { Request, Response } from "express";
import expect from "expect";
import sinon from "sinon";
import { afterEach, beforeEach, describe, it } from "mocha";
import { readMemberRoutePreferences, changeMemberRoutePreference } from "./member-route-preferences";
import { member as memberModel, memberSchema } from "../models/member";
import * as mongooseClient from "../mongoose-client";
import { Member, RoutePreferenceAction } from "../../../../projects/ngx-ramblers/src/app/models/member.model";

describe("member route preferences", () => {
  const sandbox = sinon.createSandbox();
  const saved = {routePreferences: {favouriteKeys: ["os-maps:1001"], hiddenKeys: []}} as Member;

  beforeEach(() => sandbox.stub(mongooseClient, "execute").callsFake(operation => operation()));
  afterEach(() => sandbox.restore());

  function response() {
    const res = {status: sandbox.stub(), json: sandbox.stub()};
    res.status.returns(res);
    return res;
  }

  it("reads only the authenticated member's preferences without writing data", async () => {
    const select = sandbox.stub().returns({lean: async () => saved});
    const find = sandbox.stub(memberModel, "findById").returns({select} as never);
    const update = sandbox.stub(memberModel, "findByIdAndUpdate");
    const res = response();
    await readMemberRoutePreferences({user: {memberId: "fictional-owner"}, query: {memberId: "another-member"}} as unknown as Request, res as unknown as Response);
    expect(find.firstCall.args[0]).toBe("fictional-owner");
    expect(select.firstCall.args).toEqual(["routePreferences"]);
    expect(res.json.firstCall.args[0]).toEqual(saved.routePreferences);
    expect(update.called).toBe(false);
    expect(memberSchema.path("routePreferences").options.select).toBe(false);
  });

  it("applies only the requested preference delta to the authenticated member", async () => {
    const update = sandbox.stub(memberModel, "findByIdAndUpdate").returns({select: () => ({lean: async () => saved})} as never);
    const res = response();
    await changeMemberRoutePreference({user: {memberId: "fictional-owner"}, body: {
      memberId: "another-member", memberAdmin: true, action: RoutePreferenceAction.FAVOURITE, key: "os-maps:1001"
    }} as unknown as Request, res as unknown as Response);
    expect(update.firstCall.args[0]).toBe("fictional-owner");
    expect(update.firstCall.args[1]).toEqual({$addToSet: {"routePreferences.favouriteKeys": "os-maps:1001"}});
    expect(res.status.firstCall.args[0]).toBe(200);
  });

  it("rejects unsigned requests and invalid actions before accessing member data", async () => {
    const update = sandbox.stub(memberModel, "findByIdAndUpdate");
    const unsigned = response();
    await changeMemberRoutePreference({body: {action: RoutePreferenceAction.HIDE, key: "os-maps:1001"}} as Request, unsigned as unknown as Response);
    expect(unsigned.status.firstCall.args[0]).toBe(401);
    const invalid = response();
    await changeMemberRoutePreference({user: {memberId: "fictional-owner"}, body: {action: "invalid-action", key: "os-maps:1001"}} as unknown as Request, invalid as unknown as Response);
    expect(invalid.status.firstCall.args[0]).toBe(400);
    expect(update.called).toBe(false);
  });
});
