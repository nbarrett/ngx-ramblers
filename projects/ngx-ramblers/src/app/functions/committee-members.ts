import { CommitteeMember } from "../models/committee.model";

export function uniqueCommitteeMembersByType(members: CommitteeMember[]): CommitteeMember[] {
  return (members || []).reduce((unique, member) => {
    const already = unique.some(existing => existing.type === member.type);
    return already ? unique : [...unique, member];
  }, [] as CommitteeMember[]);
}

export function committeeMemberTrackKey(member: CommitteeMember): string {
  return [member?.type, member?.memberId, member?.fullName, member?.email].filter(Boolean).join("|");
}
