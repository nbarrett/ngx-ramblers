import { currentMemberSession } from "./member-session";
import { VIEW_AS_MEMBER_HEADER } from "../../../projects/ngx-ramblers/src/app/functions/member-cookie";
import { RouteContributor } from "../../../projects/ngx-ramblers/src/app/models/audit";
import { Request } from "express";
import jwt from "jsonwebtoken";
import { MemberCookie } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { envConfig } from "../env-config/env-config";

export function bearerToken(req: Request): string | null {
  const authHeader = req.headers?.authorization || "";
  return authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null;
}

export async function verifiedMember(req: Request): Promise<MemberCookie | null> {
  const token = bearerToken(req);
  const verified = token ? jwt.verify(token, envConfig.auth().secret) as MemberCookie : null;
  return verified && req.headers[VIEW_AS_MEMBER_HEADER] ? req.user as MemberCookie ?? null : verified ? await currentMemberSession(verified.memberId) : null;
}

export async function memberFromRequest(req: Request): Promise<MemberCookie | null> {
  try {
    return await verifiedMember(req);
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

export function routeContributorFrom(req: Request): RouteContributor {
  const user = req.user as Partial<MemberCookie> | undefined;
  const name = [user?.firstName, user?.lastName].filter(part => !!part).join(" ").trim() || user?.userName || "";
  return {
    memberId: user?.memberId,
    name: name || undefined
  };
}
