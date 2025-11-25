import { ApiResponse, Identifiable } from "./api-response.model";
import { MailchimpSubscription } from "./mailchimp.model";
import { MailIdentifiers, MailSubscription } from "./mail.model";
import { sortBy } from "../functions/arrays";
import { Contact, HasNgSelectAttributes } from "./ramblers-walks-manager";
import { ExtendedGroupEvent } from "./group-event.model";

export enum ProfileUpdateType {
  LOGIN_DETAILS = "login details",
  PERSONAL_DETAILS = "personal details",
  CONTACT_PREFERENCES = "contact preferences"
}

export interface HelpInfo {
  monthsInPast: number;
  showHelp: boolean;
}

export interface MemberFilterSelection {
  id: string;
  order?: number;
  member?: Member;
  memberInformation?: string;
  text?: string;
  memberGrouping: string;
  disabled: boolean;
}

export type IdentifiableOrId = Identifiable | string ;


export interface MailchimpSegmentId {
  segmentId: number;
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

interface MailSettings extends MailIdentifiers {
  subscriptions: MailSubscription[];
}

export interface FirstAndLastName {
  firstName: string;
  lastName: string;
}

export interface Member extends HasEmailFirstAndLastName, MemberPrivileges, Auditable, Identifiable {
  hideSurname?: boolean;
  expiredPassword?: boolean;
  password?: string;
  nameAlias?: string;
  mobileNumber?: string;
  displayName?: string;
  contactId?: string;
  membershipExpiryDate?: number;
  membershipNumber?: string;
  postcode?: string;
  userName?: string;
  mailchimpLists?: {
    walks?: MailchimpSubscription;
    socialEvents?: MailchimpSubscription;
    general?: MailchimpSubscription;
  };
  mail?: MailSettings;
  passwordResetId?: string;
  mailchimpSegmentIds?: MailchimpSegmentIds;
  profileSettingsConfirmed?: boolean;
  profileSettingsConfirmedAt?: number;
  profileSettingsConfirmedBy?: string;
  jointWith?: string;
  title?: string;
  type?: string;
  memberStatus?: string;
  memberTerm?: MemberTerm;
  landlineTelephone?: string;
  emailMarketingConsent?: boolean;
  emailPermissionLastUpdated?: number;
}

export interface MemberWithLabel extends Member, HasNgSelectAttributes {
}

export interface MemberPrivileges {
  groupMember?: boolean;
  memberAdmin?: boolean;
  socialAdmin?: boolean;
  socialMember?: boolean;
  userAdmin?: boolean;
  walkAdmin?: boolean;
  revoked?: boolean;
  contentAdmin?: boolean;
  financeAdmin?: boolean;
  treasuryAdmin?: boolean;
  fileAdmin?: boolean;
  committee?: boolean;
  walkChangeNotifications?: boolean;
}

export interface StatusMessage {
  status: string;
  message: string;
}

export interface HasEmailFirstAndLastName {
  email?: string;
  firstName: string;
  lastName: string;
}

export interface BulkLoadMemberAndMatch {
  memberMatch: MemberAction;
  memberMatchType: string;
  contact: Contact;
  ramblersMember: RamblersMember;
  member: Member;
}

export interface BulkLoadMemberAndMatchToWalk {
  include: boolean;
  bulkLoadMemberAndMatch: BulkLoadMemberAndMatch;
  event: ExtendedGroupEvent;
}

export interface RamblersMemberAndContact {
  contact: Contact;
  ramblersMember: RamblersMember;
}

export interface RamblersMember extends HasEmailFirstAndLastName {
  membershipExpiryDate?: string;
  membershipNumber: string;
  mobileNumber: string;
  postcode: string;
  memberStatus?: string;
  memberTerm?: MemberTerm;
  jointWith: string;
  title: string;
  type: string;
  landlineTelephone: string;
  emailMarketingConsent: string;
  emailPermissionLastUpdated: string;
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

export interface MemberBulkLoadDateMap {
  [membershipNumber: string]: number;
}

export interface MemberLifecycleStatus {
  memberStatus?: string;
  memberTerm?: string;
}

export enum WriteDataRule {
  CHANGED = "changed",
  NO_OLD_VALUE = "no-old-value",
  TRANSITION_TO_TRUE_NEW_VALUE = "true-new-value",
  NOT_REVOKED = "not-revoked"
}

export enum WriteDataType {
  DATE = "date",
  STRING = "string",
  BOOLEAN = "boolean",
}

export enum MemberTerm {
  LIFE = "life",
  ANNUAL = "annual"
}

export interface UpdateAudit {
  fieldsChanged: number;
  fieldsSkipped: number;
  auditMessages: any[];
}

export interface MemberUpdateAudit extends Auditable {
  uploadSessionId: string;
  updateTime: number;
  memberMatch: MemberAction;
  memberAction: MemberAction;
  rowNumber: number;
  changes: number;
  auditMessage: string;
  memberId?: string;
  member?: Member;
  auditErrorMessage?: object;
}

export enum MemberAction {
  matched = "matched",
  found = "found",
  notFound = "not-found",
  created = "created",
  complete = "complete",
  summary = "summary",
  success = "success",
  info = "info",
  updated = "updated",
  error = "error",
  skipped = "skipped"
}

export interface MemberAuthAudit extends Identifiable {
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
  member?: MemberCookie | Member;
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

export interface DeleteDocumentsRequest {
  ids: string[];
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

export interface DisplayMember {
    memberId: string;
    name: string;
    displayName: string;
    contactId: string;
    firstName: string;
    lastName: string;
    membershipNumber: string;
}

export const SORT_BY_NAME = sortBy("order", "member.lastName", "member.firstName");

export const NONE = "(none)";
