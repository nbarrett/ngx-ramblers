import { ApiResponse, Identifiable } from "./api-response.model";
import { BannerConfig } from "./banner-configuration.model";
import { MailchimpSubscription } from "./mailchimp.model";

export enum ProfileUpdateType {
  LOGIN_DETAILS = "login details",
  PERSONAL_DETAILS = "personal details",
  CONTACT_PREFERENCES = "contact preferences"
}

export interface MemberFilterSelection {
  id: string;
  order?: number;
  member?: Member;
  memberInformation?: string;
  text?: string;
  memberGrouping?: string;
  disabled?: boolean;
}

export type IdentifiableOrId = Identifiable | string ;

export interface MemberEmailType extends MailchimpSegmentId {
  name: string;
  label?: string;
  monthsInPast: number;
  dateTooltip: string;
  preSend?: () => Promise<void>;
  memberSelectorName: string;
  campaignId: string;
  postSend?: () => Promise<void>;
}

export interface MailchimpSegmentId {
  segmentId: number;
}

export interface MemberSelector {
  name: string;
  memberMapper: (member: Member) => MemberFilterSelection;
  memberFilter: (member: Member) => boolean;
}

export interface EnteredMemberCredentials {
  userName?: string;
  newPassword?: string;
  newPasswordConfirm?: string;
}

export interface MemberCookie {
  memberId: string;
  walkAdmin: boolean;
  socialAdmin: boolean;
  socialMember: boolean;
  contentAdmin: boolean;
  memberAdmin: boolean;
  financeAdmin: boolean;
  committee: boolean;
  treasuryAdmin: boolean;
  fileAdmin: boolean;
  firstName: string;
  postcode: string;
  userName: string;
  lastName: string;
  profileSettingsConfirmed: boolean;
}

export interface SessionStatus {
  title: string;
  status?: string;
}

export interface MailchimpSegmentIds {
  walks?: number;
  socialEvents?: number;
  general?: number;
  directMail?: number;
  expenseApprover?: number;
  expenseTreasurer?: number;
  walkLeader?: number;
  walkCoordinator?: number;
}

export interface Member extends Auditable, Identifiable {
  hideSurname?: boolean;
  expiredPassword?: boolean;
  groupMember?: boolean;
  password?: string;
  nameAlias?: string;
  email?: string;
  mobileNumber?: string;
  displayName?: string;
  contactId?: string;
  firstName?: string;
  lastName?: string;
  memberAdmin?: boolean;
  membershipExpiryDate?: number;
  membershipNumber?: string;
  postcode?: string;
  socialAdmin?: boolean;
  socialMember?: boolean;
  userAdmin?: boolean;
  userName?: string;
  walkAdmin?: boolean;
  revoked?: boolean;
  mailchimpLists?: {
    walks?: MailchimpSubscription;
    socialEvents?: MailchimpSubscription;
    general?: MailchimpSubscription;
  };
  contentAdmin?: boolean;
  passwordResetId?: string;
  financeAdmin?: boolean;
  mailchimpSegmentIds?: MailchimpSegmentIds;
  treasuryAdmin?: boolean;
  fileAdmin?: boolean;
  committee?: boolean;
  profileSettingsConfirmed?: boolean;
  profileSettingsConfirmedAt?: number;
  profileSettingsConfirmedBy?: string;
  walkChangeNotifications?: boolean;
  receivedInLastBulkLoad?: boolean;
  lastBulkLoadDate?: number;
  assembleId?: number;
}

export interface StatusMessage {
  status: string;
  message: string;
}

export interface RamblersMember {
  groupMember?: boolean;
  membershipExpiryDate?: string | number;
  membershipNumber: string;
  mobileNumber: string;
  email: string;
  firstName: string;
  lastName: string;
  postcode: string;
}

export interface MemberBulkLoadAudit extends Auditable {
  files: {
    archive: string;
    data: string;
  };
  error?: string;
  auditLog: StatusMessage[];
  members: RamblersMember[];
}

export interface AuditField {
  fieldName: string;
  writeDataIf: string;
  type: string;
}

export interface MemberUpdateAudit extends Auditable {
  uploadSessionId: string;
  updateTime: number;
  memberAction: MemberAction;
  rowNumber: number;
  changes: number;
  auditMessage: string;
  memberId?: string;
  member?: Member;
  auditErrorMessage?: object;
}

export enum MemberAction {
  created = "created",
  complete = "complete",
  summary = "summary",
  success = "success",
  info = "info",
  updated = "updated",
  error = "error",
  skipped = "skipped"
}

export interface MemberAuthAudit {
  id: string;
  userName: string;
  loginTime: number;
  loginResponse: LoginResponse;
  member: MemberCookie;
}

export interface Auditable extends Identifiable {
  createdDate?: number;
  createdBy?: string;
  updatedDate?: number;
  updatedBy?: string;
}

export interface LoginResponse {
  userName?: string;
  member?: object;
  alertMessage?: string;
  showResetPassword?: boolean;
  memberLoggedIn?: boolean;
}

export interface MemberApiResponse extends ApiResponse {
  request: any;
  response?: Member | Member[];
}

export interface MemberAuthAuditApiResponse extends ApiResponse {
  request: any;
  response?: MemberAuthAudit | MemberAuthAudit[];
}

export interface MemberUpdateAuditApiResponse extends ApiResponse {
  request: any;
  response?: MemberUpdateAudit | MemberUpdateAudit[];
}

export interface MemberBulkLoadAuditApiResponse extends ApiResponse {
  request: any;
  response?: MemberBulkLoadAudit | MemberBulkLoadAudit[];
}

export interface DuplicateMember {
  fieldName: string;
  fieldValue: string;
  duplicates: Member[];
}

export interface DeletedMember {
  deletedAt: number;
  deletedBy: string;
  memberId: string;
  membershipNumber: string;
}

export interface DeletedMemberApiResponse extends ApiResponse {
  request: any;
  response?: DeletedMember | DeletedMember[];
}
