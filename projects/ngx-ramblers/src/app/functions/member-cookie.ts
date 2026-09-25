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
