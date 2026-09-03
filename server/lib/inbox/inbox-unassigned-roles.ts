import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { CommitteeConfig, CommitteeMember, CommitteeRoleMissingMember, roleRecipientMemberIds, UnassignedCommitteeRole } from "../../../projects/ngx-ramblers/src/app/models/committee.model";
import { DeletedMember } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { memberFullName } from "../../../projects/ngx-ramblers/src/app/functions/member-names";
import * as config from "../mongo/controllers/config";
import { member as memberModel } from "../mongo/models/member";
import { deletedMember as deletedMemberModel } from "../mongo/models/deleted-member";

const MONGO_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

export function roleMemberIds(roles: CommitteeMember[]): string[] {
  return [...new Set(roles.flatMap(role => roleRecipientMemberIds(role)))].filter(memberId => MONGO_ID_PATTERN.test(memberId));
}

function missingMember(memberId: string, primary: boolean, deleted: DeletedMember | null): CommitteeRoleMissingMember {
  return {
    memberId,
    primary,
    deletedAt: deleted?.deletedAt ?? null,
    deletedBy: deleted?.deletedBy ?? null,
    fullName: deleted ? memberFullName(deleted) || null : null
  };
}

export function unassignedCommitteeRolesFrom(roles: CommitteeMember[], existingMemberIds: Set<string>, deletedMembersById: Map<string, DeletedMember>): UnassignedCommitteeRole[] {
  return roles
    .map(role => ({
      role,
      missingMembers: [...new Set(roleRecipientMemberIds(role))]
        .filter(memberId => MONGO_ID_PATTERN.test(memberId) && !existingMemberIds.has(memberId))
        .map(memberId => missingMember(memberId, memberId === role.memberId, deletedMembersById.get(memberId) ?? null))
    }))
    .filter(item => item.missingMembers.length > 0);
}

export async function unassignedCommitteeRoles(): Promise<UnassignedCommitteeRole[]> {
  const committeeConfigDocument = await config.queryKey(ConfigKey.COMMITTEE);
  const committeeConfig: CommitteeConfig = committeeConfigDocument?.value;
  const roles = committeeConfig?.roles ?? [];
  const memberIds = roleMemberIds(roles);
  const [members, deletedMembers] = memberIds.length === 0
    ? [[], []]
    : await Promise.all([
      memberModel.find({_id: {$in: memberIds}}).select("_id").lean() as unknown as Promise<{_id: {toString(): string}}[]>,
      deletedMemberModel.find({memberId: {$in: memberIds}}).lean() as unknown as Promise<DeletedMember[]>
    ]);
  const existingMemberIds = new Set(members.map(found => found._id.toString()));
  const deletedMembersById = deletedMembers.reduce((map, deleted) => map.set(deleted.memberId, deleted), new Map<string, DeletedMember>());
  return unassignedCommitteeRolesFrom(roles, existingMemberIds, deletedMembersById);
}
