import { ApiResponse, Identifiable } from "./api-response.model";

export enum MemberSyncNotificationStatus {
  PENDING = "pending",
  SENT = "sent",
  SUPERSEDED = "superseded",
}

export enum MemberSyncNotificationResolution {
  APPLIED_FROM_HEAD_OFFICE = "applied-from-head-office",
  KEPT_LOCAL_DIVERGENCE = "kept-local-divergence",
}

export interface MemberSyncNotification extends Identifiable {
  memberId: string;
  fieldName: string;
  localValue: string | null;
  headOfficeValue: string | null;
  resolution: MemberSyncNotificationResolution;
  status: MemberSyncNotificationStatus;
  firstSeenAt: number;
  lastSeenInSyncRunAt: number;
  sentAt?: number;
  sentBy?: string;
}

export interface MemberSyncNotificationCandidate {
  memberId: string;
  fieldName: string;
  localValue: string | null;
  headOfficeValue: string | null;
  resolution: MemberSyncNotificationResolution;
}

export interface MemberSyncNotificationContext {
  candidates: MemberSyncNotificationCandidate[];
  processedMemberIds: string[];
}

export interface MemberSyncNotificationReconcileRequest {
  syncRunAt: number;
  candidates: MemberSyncNotificationCandidate[];
  processedMemberIds: string[];
}

export interface MemberSyncNotificationReconcileResult {
  inserted: number;
  updated: number;
  superseded: number;
}

export interface MemberSyncNotificationSendRequest {
  memberIds: string[];
  resend?: boolean;
}

export interface MemberSyncNotificationSendResult {
  sent: number;
  skippedNoEmail: number;
  failed: number;
}

export interface MemberSyncNotificationGroup {
  memberId: string;
  fullName: string;
  email: string | null;
  hasEmail: boolean;
  pendingCount: number;
  notifications: MemberSyncNotification[];
}

export interface MemberSyncNotificationApiResponse extends ApiResponse {
  request: any;
  response?: MemberSyncNotification | MemberSyncNotification[];
}
