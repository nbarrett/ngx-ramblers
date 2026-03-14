import { BuiltInRole, CommitteeMember, ExpensesConfig } from "./committee.model";

export interface CommitteeReferenceDataLike {
  createFrom(injectedCommitteeMembers: CommitteeMember[]): CommitteeReferenceDataLike;
  committeeMembers(): CommitteeMember[];
  loggedOnRole(): CommitteeMember;
  fileTypes(): { description?: string; public?: boolean }[];
  expensesConfig(): ExpensesConfig;
  committeeMembersForRole(role: string[] | string): CommitteeMember[];
  toRoles(role: string[] | string): string[];
  committeeMemberForRole(role: string): CommitteeMember;
  committeeMemberForBuiltInRole(builtInRole: BuiltInRole): CommitteeMember;
  contactUsField(role: BuiltInRole | string, field: string): string;
  contactUsFieldForBuiltInRole(role: BuiltInRole, field: string): string;
  memberId(role: string): string;
  email(role: string): string;
  description(role: string): string;
  fullName(role: string): string;
  isPublic(fileTypeDescription: string): boolean;
}
