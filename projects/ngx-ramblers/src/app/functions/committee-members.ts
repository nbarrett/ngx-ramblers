import { kebabCase } from "es-toolkit/compat";
import {
  CommitteeAssignedEmail,
  CommitteeAssignedMailboxGroup,
  CommitteeMember,
  CommitteeMemberTab,
  committeeMailboxAddresses,
  roleEmailAddresses,
  roleRecipientMemberIds
} from "../models/committee.model";
import { StoredValue } from "../models/ui-actions";
import { normaliseEmail } from "./strings";

export function uniqueCommitteeMembersByType(members: CommitteeMember[]): CommitteeMember[] {
  return (members || []).reduce((unique, member) => {
    const already = unique.some(existing => existing.type === member.type);
    return already ? unique : [...unique, member];
  }, [] as CommitteeMember[]);
}

export function committeeMemberTrackKey(member: CommitteeMember): string {
  return [member?.type, member?.memberId, member?.fullName, member?.email].filter(Boolean).join("|");
}

export function memberRecordId(member: {id?: string | null; memberId?: string | null}): string | null {
  return member?.id || member?.memberId || null;
}

export function committeeRoleForMemberId(roles: CommitteeMember[] | null | undefined, memberId: string | null): CommitteeMember | undefined {
  return memberId ? (roles ?? []).find(role => role.memberId === memberId && !!role.email) : undefined;
}

export function committeeRolesHeldByMemberId(roles: CommitteeMember[] | null | undefined, memberId: string | null): CommitteeMember[] {
  return memberId ? (roles ?? []).filter(role => role.memberId === memberId || roleRecipientMemberIds(role).includes(memberId)) : [];
}

export function memberHoldsCommitteeRole(member: {id?: string | null; memberId?: string | null}, roles: CommitteeMember[] | null | undefined): boolean {
  const id = memberRecordId(member);
  return !!id && (roles ?? []).some(role => role.memberId === id);
}

export function committeeOutboundEmailQueryParams(roleType: string): Record<string, string> {
  return {
    [StoredValue.TAB]: "committee-members",
    [StoredValue.EDIT]: roleType,
    [StoredValue.SUB_TAB]: kebabCase(CommitteeMemberTab.OUTBOUND_EMAIL)
  };
}

export function committeeMembersSettingsQueryParams(roleType?: string | null): Record<string, string> {
  return roleType
    ? committeeOutboundEmailQueryParams(roleType)
    : {[StoredValue.TAB]: "committee-members"};
}

export function committeeRoleList(groups: CommitteeAssignedMailboxGroup[]): string {
  return groups.map(group => group.roleDescription).join(", ");
}

export function committeeAssignedMailboxGroupsForMemberId(roles: CommitteeMember[] | null | undefined, memberId: string | null): CommitteeAssignedMailboxGroup[] {
  return committeeRolesHeldByMemberId(roles, memberId)
    .map(role => ({
      roleType: role.type,
      roleDescription: role.description || role.type,
      fullName: role.fullName || "",
      addresses: committeeMailboxAddresses(role)
    }))
    .filter(group => group.addresses.length > 0);
}

export function committeeAssignedEmailsForMemberId(roles: CommitteeMember[] | null | undefined, memberId: string | null): CommitteeAssignedEmail[] {
  return committeeAssignedMailboxGroupsForMemberId(roles, memberId)
    .flatMap(group => group.addresses.map(item => ({
      email: item.email,
      roleDescription: group.roleDescription,
      roleType: group.roleType
    })))
    .reduce<CommitteeAssignedEmail[]>((unique, entry) => {
      const seen = unique.some(existing => existing.email.toLowerCase() === entry.email.toLowerCase());
      return seen ? unique : unique.concat(entry);
    }, []);
}

export function outboundEmailForMember(member: {id?: string | null; memberId?: string | null; email?: string | null}, roles: CommitteeMember[] | null | undefined): string {
  const role = committeeRoleForMemberId(roles, memberRecordId(member));
  return role?.email || member?.email || "";
}

export function committeeRoleEmailDiffersFromPersonal(member: {id?: string | null; memberId?: string | null; email?: string | null}, roles: CommitteeMember[] | null | undefined): boolean {
  const outbound = outboundEmailForMember(member, roles);
  return !!outbound && !!member?.email && normaliseEmail(outbound) !== normaliseEmail(member.email);
}

export function outboundEmailForRecipient(options: {
  memberId?: string | null;
  email?: string | null;
  roles: CommitteeMember[] | null | undefined;
  members: {id?: string | null; memberId?: string | null; email?: string | null}[];
}): string {
  const byId = committeeRoleForMemberId(options.roles, options.memberId ?? null);
  if (byId?.email) {
    return byId.email;
  } else {
    const wanted = normaliseEmail(options.email);
    const member = wanted
      ? (options.members ?? []).find(item => normaliseEmail(item.email) === wanted)
      : undefined;
    return member ? outboundEmailForMember(member, options.roles) : (options.email || "");
  }
}
