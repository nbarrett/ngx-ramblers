import {
  Member,
  MemberAction,
  MemberBulkLoadUploadedRow,
  MemberUpdateAudit,
  MemberUpdateAuditRow,
  RamblersMember
} from "../models/member.model";
import { memberDisambiguatedLabel, memberFullName } from "./member-names";

export function memberForUpdateAudit(audit: MemberUpdateAudit, members: Member[]): Member | null {
  const memberId = audit.memberId || audit.member?.id;
  const fromList = memberId ? members.find(member => member.id === memberId) : null;
  return fromList || audit.member || null;
}

export function memberUpdateAuditRow(audit: MemberUpdateAudit, members: Member[]): MemberUpdateAuditRow {
  const member = memberForUpdateAudit(audit, members);
  const memberName = member ? memberDisambiguatedLabel(member) : "";
  return {
    ...audit,
    memberName,
    searchableText: [
      memberName,
      memberFullName(member),
      member?.email,
      member?.membershipNumber,
      member?.firstName,
      member?.lastName,
      audit.memberAction,
      audit.rowNumber,
      audit.changes
    ].filter(value => value !== null && value !== undefined && value !== "").join(" ")
  };
}

export function memberUpdateAuditRows(audits: MemberUpdateAudit[], members: Member[]): MemberUpdateAuditRow[] {
  return (audits || []).map(audit => memberUpdateAuditRow(audit, members));
}

export function memberBulkLoadUploadedRows(
  uploadedMembers: RamblersMember[],
  audits: MemberUpdateAudit[],
  members: Member[]
): MemberBulkLoadUploadedRow[] {
  const membershipNumberByMemberId = (members || []).reduce((acc: Record<string, string>, member) => {
    if (member.id && member.membershipNumber) {
      acc[member.id] = member.membershipNumber;
    }
    return acc;
  }, {});
  const auditsByRowNumber = (audits || []).reduce((acc: Record<number, MemberUpdateAudit>, audit) => {
    if (audit.rowNumber) {
      acc[audit.rowNumber] = audit;
    }
    return acc;
  }, {});
  const auditsByMembershipNumber = (audits || []).reduce((acc: Record<string, MemberUpdateAudit>, audit) => {
    const membershipNumber = audit.member?.membershipNumber
      || (audit.memberId ? membershipNumberByMemberId[audit.memberId] : null);
    if (membershipNumber && !acc[membershipNumber]) {
      acc[membershipNumber] = audit;
    }
    return acc;
  }, {});
  return (uploadedMembers || []).map((ramblersMember, index) => {
    const rowNumber = index + 1;
    const audit = auditsByRowNumber[rowNumber]
      || (ramblersMember.membershipNumber ? auditsByMembershipNumber[ramblersMember.membershipNumber] : null);
    const memberAction: MemberAction | null = audit?.memberAction || null;
    return {
      ...ramblersMember,
      rowNumber,
      memberAction,
      searchableText: [
        ramblersMember.membershipNumber,
        ramblersMember.mobileNumber,
        ramblersMember.email,
        ramblersMember.firstName,
        ramblersMember.lastName,
        ramblersMember.postcode,
        memberAction
      ].filter(value => value !== null && value !== undefined && value !== "").join(" ")
    };
  });
}
