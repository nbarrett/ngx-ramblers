import { keys } from "es-toolkit/compat";
import { Member, MemberCookie } from "../models/member.model";

export const VIEW_AS_MEMBER_HEADER = "view-as-member-id";

export function toMemberCookie(member: Member): MemberCookie {
  return {
    memberId: member.id,
    walkAdmin: member.walkAdmin,
    volunteerAdmin: member.volunteerAdmin,
    socialAdmin: member.socialAdmin,
    socialMember: member.socialMember,
    contentAdmin: member.contentAdmin,
    memberAdmin: member.memberAdmin,
    viewAsMember: member.viewAsMember === true && member.revoked !== true,
    financeAdmin: member.financeAdmin,
    committee: member.committee,
    treasuryAdmin: member.treasuryAdmin,
    fileAdmin: member.fileAdmin,
    firstName: member.firstName,
    lastName: member.lastName,
    postcode: member.postcode,
    userName: member.userName,
    profileSettingsConfirmed: member.profileSettingsConfirmed
  };
}

export function canViewAsMember(member: Partial<MemberCookie> | null): boolean {
  return !!member?.memberId && member.memberAdmin === true && member.viewAsMember === true;
}

export function memberSessionFields(): string[] {
  return [...keys(toMemberCookie({} as Member)).filter(field => field !== "memberId"), "groupMember", "expiredPassword", "revoked"];
}
