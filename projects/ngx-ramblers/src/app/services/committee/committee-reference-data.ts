import { BuiltInRole, CommitteeConfig, CommitteeMember, ExpensesConfig, roleRecipientMemberIds } from "../../models/committee.model";
import { committeeRoleForMemberId } from "../../functions/committee-members";
import { MemberLoginService } from "../member/member-login.service";
import { FileType } from "./committee-file-type.model";
import { isArray } from "es-toolkit/compat";
import { kebabCase } from "es-toolkit/compat";

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
    return this.loggedOnRoles()[0];
  }

  loggedOnRoles(): CommitteeMember[] {
    const memberId = this.memberLoginService.loggedInMember().memberId;
    if (!memberId) return [];
    return this.committeeMembers().filter(role => roleRecipientMemberIds(role).includes(memberId));
  }

  committeeMemberForMember(memberId: string): CommitteeMember {
    return committeeRoleForMemberId(this.committeeMembers(), memberId);
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
    const exact = this.committeeMembers().find(member => member.type === role);
    if (exact) {
      return exact;
    }
    if (role === "enquiries") {
      const aliased = this.committeeMembers().find(member => member.builtInRoleMapping === BuiltInRole.CONTACT_US);
      if (aliased) {
        return aliased;
      }
    }
    return this.committeeMembers().find(member => this.roleMatch(member, role));
  }

  committeeMemberForBuiltInRole(builtInRole: BuiltInRole): CommitteeMember {
    return this.committeeMembers().find(member => member.builtInRoleMapping === builtInRole);
  }

  committeeMemberForPreferredRoles(role: string[] | string): CommitteeMember | undefined {
    const preferred = this.toRoles(role) || [];
    const contactable = (member: CommitteeMember) => Boolean(member?.email) && !member.vacant;
    for (const preferredRole of preferred) {
      const match = this.committeeMemberForRole(preferredRole);
      if (contactable(match)) {
        return match;
      }
    }
    const contactUs = this.committeeMemberForBuiltInRole(BuiltInRole.CONTACT_US);
    if (contactable(contactUs)) {
      return contactUs;
    }
    return this.committeeMembers().find(contactable);
  }

  contactDisplayName(member: CommitteeMember): string {
    return member?.contactUsLabel || member?.description || member?.fullName || "the committee";
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
