import { CommitteeMember } from "../models/committee.model";
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
