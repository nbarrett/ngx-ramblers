import { ApiResponse } from "./api-response.model";

export enum MemberSyncPolicyMode {
  USE_LEGACY_RULES = "use-legacy-rules",
  ALWAYS_APPLY_HEAD_OFFICE = "always-apply-head-office",
  SKIP = "skip",
}

export const HEAD_OFFICE_ALWAYS_LOCKED_FIELDS = ["membershipNumber", "membershipExpiryDate"];

export function isHeadOfficeLockedField(fieldName: string, mode: MemberSyncPolicyMode): boolean {
  return HEAD_OFFICE_ALWAYS_LOCKED_FIELDS.includes(fieldName) || mode === MemberSyncPolicyMode.ALWAYS_APPLY_HEAD_OFFICE;
}

export interface MemberSyncPolicy {
  defaultMode: MemberSyncPolicyMode;
  overrides: Record<string, MemberSyncPolicyMode>;
}

export const DEFAULT_MEMBER_SYNC_POLICY: MemberSyncPolicy = {
  defaultMode: MemberSyncPolicyMode.USE_LEGACY_RULES,
  overrides: {}
};

export interface MemberSyncPolicyApiResponse extends ApiResponse {
  request: any;
  response?: MemberSyncPolicy;
}
