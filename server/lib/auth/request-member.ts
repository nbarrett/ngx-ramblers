import { Request } from "express";
import jwt from "jsonwebtoken";
import { MemberCookie } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { envConfig } from "../env-config/env-config";

export function bearerToken(req: Request): string | null {
  const authHeader = req.headers?.authorization || "";
  return authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null;
}

export function verifiedMember(req: Request): MemberCookie | null {
  const token = bearerToken(req);
  return token ? jwt.verify(token, envConfig.auth().secret) as MemberCookie : null;
}

export function memberFromRequest(req: Request): MemberCookie | null {
  try {
    return verifiedMember(req);
  } catch {
    return null;
  }
}

export function hasAdminPrivilege(member: MemberCookie | null): boolean {
  return !!(member?.memberAdmin || member?.contentAdmin || member?.fileAdmin || member?.walkAdmin || member?.socialAdmin || member?.treasuryAdmin || member?.financeAdmin);
}

export function memberDescription(member: MemberCookie | null): string {
  return member ? `${member.userName || "unknown user"} (member id ${member.memberId || "unknown"})` : "no member token";
}
