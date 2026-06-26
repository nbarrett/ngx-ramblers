import { ApiResponse } from "./api-response.model";

export enum MemberSyncPolicyMode {
  USE_LEGACY_RULES = "use-legacy-rules",
  ALWAYS_APPLY_HEAD_OFFICE = "always-apply-head-office",
  SKIP = "skip",
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
