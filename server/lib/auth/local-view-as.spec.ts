import expect from "expect";
import { Request } from "express";
import { applyLocalViewAs } from "./local-view-as";
import { VIEW_AS_MEMBER_HEADER } from "../../../projects/ngx-ramblers/src/app/functions/member-cookie";
import { envConfig } from "../env-config/env-config";
import { member as memberModel } from "../mongo/models/member";

describe("applyLocalViewAs", () => {
  const originalProduction = envConfig.isProduction;

  afterEach(() => {
    envConfig.isProduction = originalProduction;
    delete (memberModel as {findById?: unknown}).findById;
    delete (memberModel as {findOne?: unknown}).findOne;
  });

  it("does nothing in production", async () => {
    envConfig.isProduction = () => true;
    const req = {headers: {[VIEW_AS_MEMBER_HEADER]: "abc"}, user: {memberAdmin: true, memberId: "nick"}} as unknown as Request;
    await applyLocalViewAs(req);
    expect((req as unknown as {user: {memberId: string}}).user.memberId).toBe("nick");
  });

  it("overlays the viewed member when local and platform admin is enabled", async () => {
    envConfig.isProduction = () => false;
    process.env.PLATFORM_ADMIN_ENABLED = "true";
    (memberModel as {findById: unknown}).findById = async () => ({
      toObject: () => ({
        _id: "tom-id",
        firstName: "Tom",
        lastName: "Gamble",
        userName: "tom",
        memberAdmin: false,
        walkAdmin: false,
        socialAdmin: false,
        socialMember: true,
        contentAdmin: false,
        financeAdmin: false,
        committee: true,
        treasuryAdmin: false,
        fileAdmin: false,
        postcode: "",
        profileSettingsConfirmed: true
      })
    });
    const req = {headers: {[VIEW_AS_MEMBER_HEADER]: "aaaaaaaaaaaaaaaaaaaaaaaa"}, user: {memberAdmin: false, memberId: "nick"}} as unknown as Request;
    await applyLocalViewAs(req);
    expect((req as unknown as {user: {memberId: string}}).user.memberId).toBe("tom-id");
    expect((req as unknown as {user: {firstName: string}}).user.firstName).toBe("Tom");
    expect((req as unknown as {user: {memberAdmin: boolean}}).user.memberAdmin).toBe(false);
  });

  it("looks up the viewed member by user name", async () => {
    envConfig.isProduction = () => false;
    process.env.PLATFORM_ADMIN_ENABLED = "true";
    (memberModel as {findOne: unknown}).findOne = async () => ({
      toObject: () => ({
        _id: "tom-id",
        firstName: "Tom",
        lastName: "Gamble",
        userName: "tom",
        memberAdmin: false,
        walkAdmin: false,
        socialAdmin: false,
        socialMember: true,
        contentAdmin: false,
        financeAdmin: false,
        committee: true,
        treasuryAdmin: false,
        fileAdmin: false,
        postcode: "",
        profileSettingsConfirmed: true
      })
    });
    const req = {headers: {[VIEW_AS_MEMBER_HEADER]: "tom"}, user: {memberAdmin: false, memberId: "nick"}} as unknown as Request;
    await applyLocalViewAs(req);
    expect((req as unknown as {user: {memberId: string}}).user.memberId).toBe("tom-id");
  });
});
