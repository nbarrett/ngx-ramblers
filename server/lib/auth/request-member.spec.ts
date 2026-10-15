import expect from "expect";
import jwt from "jsonwebtoken";
import { Request } from "express";
import { verifiedMember } from "./request-member";
import { VIEW_AS_MEMBER_HEADER } from "../../../projects/ngx-ramblers/src/app/functions/member-cookie";
import { envConfig } from "../env-config/env-config";

describe("Verified member during View as", () => {
  it("uses the effective member rather than restoring administrator permissions", async () => {
    const token = jwt.sign({memberId: "administrator", memberAdmin: true}, envConfig.auth().secret);
    const req = {headers: {authorization: `Bearer ${token}`, [VIEW_AS_MEMBER_HEADER]: "alex-reed"}, user: {memberId: "target", memberAdmin: false}} as unknown as Request;
    expect(await verifiedMember(req)).toEqual({memberId: "target", memberAdmin: false});
  });

  it("does not use the real administrator on routes that have not applied View as", async () => {
    const token = jwt.sign({memberId: "administrator", memberAdmin: true}, envConfig.auth().secret);
    const req = {headers: {authorization: `Bearer ${token}`, [VIEW_AS_MEMBER_HEADER]: "alex-reed"}} as unknown as Request;
    expect(await verifiedMember(req)).toBeNull();
  });

  it("still verifies the token before using the effective member", async () => {
    const req = {headers: {authorization: "Bearer invalid", [VIEW_AS_MEMBER_HEADER]: "alex-reed"}, user: {memberId: "target"}} as unknown as Request;
    await expect(verifiedMember(req)).rejects.toThrow();
  });
});
