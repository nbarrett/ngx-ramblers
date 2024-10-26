import { BuiltInRole, CommitteeConfig, CommitteeMember, ExpensesConfig } from "../../models/committee.model";
import { MemberLoginService } from "../member/member-login.service";
import { FileType } from "./committee-file-type.model";
import isArray from "lodash-es/isArray";
import kebabCase from "lodash-es/kebabCase";

export class CommitteeReferenceData {

  constructor(private injectedCommitteeMembers: CommitteeMember[] = [],
              private injectedFileTypes: FileType[],
              private expenses: ExpensesConfig,
              private memberLoginService: MemberLoginService) {
  }

  static create(committeeConfig: CommitteeConfig, memberLoginService: MemberLoginService) {
    return new CommitteeReferenceData(committeeConfig.roles, committeeConfig.fileTypes, committeeConfig.expenses, memberLoginService);
  }

  createFrom(injectedCommitteeMembers: CommitteeMember[]) {
    return new CommitteeReferenceData(injectedCommitteeMembers, this.injectedFileTypes, this.expenses, this.memberLoginService);
  }

  committeeMembers(): CommitteeMember[] {
    return this.injectedCommitteeMembers;
  }

  loggedOnRole(): CommitteeMember {
    const memberId = this.memberLoginService.loggedInMember().memberId;
    return this.committeeMembers().find((role) => {
      return role.memberId === memberId;
    });
  }

  fileTypes(): FileType[] {
    return this.injectedFileTypes;
  }

  expensesConfig(): ExpensesConfig {
    return this.expenses;
  }

  committeeMembersForRole(role: string[] | string): CommitteeMember[] {
    const roles = this.toRoles(role);
    return this.committeeMembers().filter(member => roles.filter(role => this.roleMatch(member, role)).length > 0);
  }

  public toRoles(role: string[] | string) {
    return isArray(role) ? role : role?.split(",").map(item => item.trim());
  }

  committeeMemberForRole(role: string): CommitteeMember {
    return this.committeeMembers().find(member => member.type === role)
      || this.committeeMembers().find(member => this.roleMatch(member, role));
  }

  committeeMemberForBuiltInRole(builtInRole: BuiltInRole): CommitteeMember {
    return this.committeeMembers().find(member => member.builtInRoleMapping === builtInRole);
  }

  private roleMatch(member: CommitteeMember, role: string) {
    return kebabCase(member?.type)?.toLowerCase().includes(kebabCase(role));
  }

  contactUsField(role: BuiltInRole | string, field: string): string {
    const committeeMember: CommitteeMember = this.committeeMemberForRole(role);
    return committeeMember?.[field];
  }

  contactUsFieldForBuiltInRole(role: BuiltInRole, field: string): string {
    const committeeMember: CommitteeMember = this.committeeMemberForBuiltInRole(role);
    return committeeMember?.[field];
  }

  memberId(role: string): string {
    return this.contactUsField(role, "memberId");
  }

  email(role: string): string {
    return this.contactUsField(role, "email");
  }

  description(role: string): string {
    return this.contactUsField(role, "description");
  }

  fullName(role: string): string {
    return this.contactUsField(role, "fullName");
  }

  isPublic(fileTypeDescription: string): boolean {
    const found = this.fileTypes()?.find(fileType => fileType.description === fileTypeDescription);
    return found && found.public;
  }
}
