import { MemberBulkLoadAudit } from "./member.model";

export interface SalesforceConfig {
  endpointBaseUrl: string;
  apiKeysByGroupCode: Record<string, string>;
  enabled: boolean;
  enableGranularConsent?: boolean;
  lastSyncedAt?: number;
  lastSyncCursor?: string;
}

export interface GroupCodeToken {
  groupCode: string;
  token: string;
}

export enum SalesforceMemberTerm {
  Life = "life",
  Annual = "annual",
}

export enum SalesforceChangeType {
  Added = "added",
  Updated = "updated",
  Removed = "removed",
}

export enum SalesforceRemovalReason {
  Expired = "expired",
  Transferred = "transferred",
  Deceased = "deceased",
  Other = "other",
}

export interface SalesforceGroupRoles {
  walkLeader?: boolean;
  emailSender?: boolean;
  viewMembershipData?: boolean;
}

export interface SalesforceAreaRoles {
  emailSender?: boolean;
}

export interface SalesforceGroupMembership {
  groupCode: string;
  primary: boolean;
  roles?: SalesforceGroupRoles;
}

export interface SalesforceAreaMembership {
  areaCode: string;
  roles?: SalesforceAreaRoles;
}

export interface SalesforceMember {
  salesforceId: string;
  membershipNumber?: string;
  firstName?: string;
  preferredName?: string;
  initials?: string;
  lastName: string;
  title?: string;
  email?: string;
  mobileNumber?: string;
  landlineTelephone?: string;
  address1?: string;
  address2?: string;
  address3?: string;
  town?: string;
  county?: string;
  country?: string;
  postcode?: string;
  groupName?: string;
  groupCode?: string;
  groupJoinedDate?: string;
  memberType?: string;
  memberTerm?: SalesforceMemberTerm;
  memberStatus?: string;
  membershipType?: string;
  jointWith?: string;
  membershipExpiryDate?: string;
  ramblersJoinDate?: string;
  areaName?: string;
  areaJoinedDate?: string;
  groupMemberships?: SalesforceGroupMembership[];
  areaMemberships?: SalesforceAreaMembership[];
  volunteer?: boolean;
  affiliateMemberPrimaryGroup?: string;
  emailMarketingConsent: boolean;
  emailPermissionLastUpdated?: string;
  postDirectMarketing?: boolean;
  postPermissionLastUpdated?: string;
  telephoneDirectMarketing?: boolean;
  telephonePermissionLastUpdated?: string;
  walkProgrammeOptOut?: boolean;
  groupMarketingConsent?: boolean;
  areaMarketingConsent?: boolean;
  otherMarketingConsent?: boolean;
}

export interface SalesforceMemberChange {
  member: SalesforceMember;
  changeType: SalesforceChangeType;
  changedAt: string;
  removalReason?: SalesforceRemovalReason;
}

export interface SalesforceMemberListResponse {
  groupCode: string;
  groupName: string;
  totalCount: number;
  since?: string;
  members: SalesforceMember[];
  changes?: SalesforceMemberChange[];
}

export interface SalesforceTestConnectionResult {
  success: boolean;
  status?: number;
  latencyMs?: number;
  message?: string;
  errorCode?: string;
}

export enum SalesforceConsentSource {
  NgxRamblers = "ngx-ramblers",
  Mailman = "mailman",
}

export interface SalesforceConsentUpdateRequest {
  emailMarketingConsent?: boolean;
  groupMarketingConsent?: boolean;
  areaMarketingConsent?: boolean;
  otherMarketingConsent?: boolean;
  source: SalesforceConsentSource;
  timestamp: string;
  reason?: string;
}

export interface SalesforceConsentUpdateResponse {
  membershipNumber: string;
  emailMarketingConsent?: boolean;
  groupMarketingConsent?: boolean;
  areaMarketingConsent?: boolean;
  otherMarketingConsent?: boolean;
  updatedAt: string;
  success: boolean;
}

export interface SalesforceSyncRequest {
  fullSync?: boolean;
}

export interface SalesforceSyncApiResponse {
  action?: string;
  request?: SalesforceSyncRequest;
  response?: MemberBulkLoadAudit;
  error?: any;
}

export const SALESFORCE_BULK_LOAD_SOURCE = "salesforce-api";
export const INSIGHT_HUB_BULK_LOAD_SOURCE = "insight-hub-xlsx";

export type MemberBulkLoadSource = typeof SALESFORCE_BULK_LOAD_SOURCE | typeof INSIGHT_HUB_BULK_LOAD_SOURCE;

export interface ConsentWritebackContext {
  membershipNumber?: string;
  reason?: string;
}

export enum ConsentWritebackSkipReason {
  Disabled = "DISABLED",
  NotConfigured = "NOT_CONFIGURED",
  NoMembershipNumber = "NO_MEMBERSHIP_NUMBER",
}

export interface ConsentWritebackOutcome {
  attempted: boolean;
  success?: boolean;
  status?: number;
  errorCode?: string;
  errorMessage?: string;
  latencyMs?: number;
  skippedReason?: ConsentWritebackSkipReason;
}
