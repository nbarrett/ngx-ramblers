import { Member } from "../../../../../projects/ngx-ramblers/src/app/models/member.model";
import { AdminUserConfig } from "../../types";
import { dateTimeNowAsValue } from "../../../shared/dates";
import { generateUid } from "../../../shared/string-utils";

export interface AdminMemberParams {
  adminUser: AdminUserConfig;
  groupCode: string;
}

export interface AdminMemberResult {
  member: Member;
  passwordResetId: string;
}

export function createAdminMember(params: AdminMemberParams): AdminMemberResult {
  const { adminUser } = params;
  const createdAt = dateTimeNowAsValue();
  const passwordResetId = generateUid();

  return {
    passwordResetId,
    member: {
      userName: adminUser.email.toLowerCase(),
      passwordResetId,
      expiredPassword: true,
      firstName: adminUser.firstName,
      lastName: adminUser.lastName,
      email: adminUser.email.toLowerCase(),
      displayName: `${adminUser.firstName} ${adminUser.lastName}`,
      groupMember: true,
      memberAdmin: true,
      socialAdmin: true,
      socialMember: true,
      userAdmin: true,
      walkAdmin: true,
      contentAdmin: true,
      financeAdmin: true,
      treasuryAdmin: true,
      fileAdmin: true,
      committee: true,
      walkChangeNotifications: true,
      revoked: false,
      profileSettingsConfirmed: true,
      profileSettingsConfirmedAt: createdAt,
      createdDate: createdAt,
      createdBy: "system-setup",
      updatedDate: createdAt,
      updatedBy: "system-setup"
    }
  };
}

export function createSystemMember(): Partial<Member> {
  const createdAt = dateTimeNowAsValue();

  return {
    memberId: "system",
    firstName: "System",
    lastName: "User",
    displayName: "System User",
    userName: "system",
    createdDate: createdAt,
    createdBy: "system-setup"
  };
}
