import map from "lodash-es/map";
import { CommitteeConfig, CommitteeMember, ExpensesConfig } from "../../models/committee.model";
import { MemberLoginService } from "../member/member-login.service";
import { FileType } from "./committee-file-type.model";
import isArray from "lodash-es/isArray";

export class CommitteeReferenceData {

  constructor(private injectedCommitteeMembers: CommitteeMember[] = [],
              private injectedFileTypes: FileType[],
              private expenses: ExpensesConfig,
              private memberLoginService: MemberLoginService) {
  }

  static create(committeeConfig: CommitteeConfig, memberLoginService: MemberLoginService) {
    return new CommitteeReferenceData(CommitteeReferenceData.toCommitteeMembers(committeeConfig), committeeConfig.fileTypes, committeeConfig.expenses, memberLoginService);
  }

  public static toCommitteeMembers(committeeConfig: CommitteeConfig): CommitteeMember[] {
    return map(committeeConfig?.contactUs, (data, type) => ({
      type,
      fullName: data.fullName,
      memberId: data.memberId,
      nameAndDescription: data.description + " (" + data.fullName + ")",
      description: data.description,
      email: data.email,
      vacant: data.vacant
    })).filter(item => !item.vacant) || [];
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
    return this.committeeMembers().filter(member => roles.includes(member.type));
  }

  public toRoles(role: string[] | string) {
    return isArray(role) ? role : role?.split(",").map(item => item.trim());
  }

  committeeMemberForRole(role: string): CommitteeMember {
    return this.committeeMembers().find(member => member.type === role);
  }

  contactUsField(role: string, field: string): string {
    const committeeMember = this.committeeMemberForRole(role);
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
