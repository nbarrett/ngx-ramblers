import { member } from "../mongo/models/member";
import { toObjectWithId } from "../mongo/controllers/transforms";
import { toMemberCookie } from "../../../projects/ngx-ramblers/src/app/functions/member-cookie";
import { Member, MemberCookie } from "../../../projects/ngx-ramblers/src/app/models/member.model";

export async function currentMemberSession(memberId: string): Promise<MemberCookie | null> {
  const document = memberId ? await member.findById(memberId) : null;
  const currentMember = document ? toObjectWithId(document) as Member : null;
  return currentMember && currentMember.groupMember === true && !currentMember.expiredPassword && !currentMember.revoked ? toMemberCookie(currentMember) : null;
}
