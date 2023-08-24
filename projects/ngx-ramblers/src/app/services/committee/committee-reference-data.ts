import map from "lodash-es/map";
import { CommitteeConfig, CommitteeMember } from "../../models/committee.model";
import { MemberLoginService } from "../member/member-login.service";
import { FileType } from "./committee-file-type.model";

export class CommitteeReferenceData {

  constructor(private injectedCommitteeMembers: CommitteeMember[] = [],
              private injectedFileTypes: FileType[],
              private memberLoginService: MemberLoginService) {
  }

  static create(committeeConfig: CommitteeConfig, memberLoginService: MemberLoginService) {
    return new CommitteeReferenceData(CommitteeReferenceData.toCommitteeMembers(committeeConfig), committeeConfig.fileTypes, memberLoginService);
  }

  public static toCommitteeMembers(committeeConfig: CommitteeConfig): CommitteeMember[] {
    return map(committeeConfig?.contactUs, (data, type) => ({
      type,
      fullName: data.fullName,
      memberId: data.memberId,
      nameAndDescription: data.description + " (" + data.fullName + ")",
      description: data.description,
      email: data.email
    })) || [];
  }

  createFrom(injectedCommitteeMembers: CommitteeMember[]) {
    return new CommitteeReferenceData(injectedCommitteeMembers, this.injectedFileTypes, this.memberLoginService);
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

  committeeMembersForRole(role): CommitteeMember[] {
    const roles = role.split(",").map(value => value.trim());
    return this.committeeMembers().filter(member => roles.includes(member.type));
  }

  contactUsField(role, field): string {
    const committeeMember = this.committeeMembers().find(member => member.type === role);
    return committeeMember && committeeMember[field];
  }

  memberId(role): string {
    return this.contactUsField(role, "memberId");
  }

  email(role): string {
    return this.contactUsField(role, "email");
  }

  description(role): string {
    return this.contactUsField(role, "description");
  }

  fullName(role): string {
    return this.contactUsField(role, "fullName");
  }

  isPublic(fileTypeDescription): boolean {
    const found = this.fileTypes()?.find(fileType => fileType.description === fileTypeDescription);
    return found && found.public;
  }
}
