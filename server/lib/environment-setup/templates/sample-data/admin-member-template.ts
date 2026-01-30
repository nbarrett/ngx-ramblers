import { hash } from "bcryptjs";
import { Member } from "../../../../../projects/ngx-ramblers/src/app/models/member.model";
import { AdminUserConfig } from "../../types";
import { dateTimeNowAsValue } from "../../../shared/dates";

export interface AdminMemberParams {
  adminUser: AdminUserConfig;
  groupCode: string;
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 10);
}

export async function createAdminMember(params: AdminMemberParams): Promise<Member> {
  const { adminUser, groupCode } = params;
  const hashedPassword = await hashPassword(adminUser.password);
  const createdAt = dateTimeNowAsValue();

  return {
    userName: adminUser.email.toLowerCase(),
    password: hashedPassword,
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
