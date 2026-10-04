import { MemberCookie } from "../models/member.model";
import { OsMapsImportContext, RouteVisibility } from "../models/os-maps-export.model";

export function routeMemberIsAdmin(member: MemberCookie | null): boolean {
  return !!(member?.memberAdmin || member?.contentAdmin || member?.fileAdmin || member?.walkAdmin || member?.volunteerAdmin
    || member?.socialAdmin || member?.treasuryAdmin || member?.financeAdmin);
}

export function routeVisibleToMember(route: OsMapsImportContext, member: MemberCookie | null): boolean {
  return routeMemberIsAdmin(member) || (route.visibility !== RouteVisibility.PRIVATE && (!route.visibility || !!member?.memberId))
    || !!member?.memberId && route.ownerMemberId === member.memberId;
}

export function routeEditableByMember(route: OsMapsImportContext, member: MemberCookie | null): boolean {
  return routeMemberIsAdmin(member) || !!member?.memberId && route.ownerMemberId === member.memberId;
}
