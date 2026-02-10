import { ApiResponse, Identifiable } from "./api-response.model";
import { ExternalSystems, Organisation } from "./system.model";
import { CommitteeReferenceData } from "../services/committee/committee-reference-data";
import { BannerConfig } from "./banner-configuration.model";
import { Auditable, HasEmailFirstAndLastName, Member, MemberFilterSelection } from "./member.model";
import { NotificationDirective } from "../notifications/common/notification.directive";
import { AuditStatus } from "./audit";
import { SortDirection } from "./sort.model";

export enum MailSettingsTab {
  EMAIL_CONFIGURATIONS = "Email Configurations",
  BUILT_IN_PROCESS_MAPPINGS = "Built-in Process Mappings",
  MAIL_API_SETTINGS = "Mail API Settings",
  MAIL_LIST_SETTINGS = "Mail List Settings",
  SENDERS = "Senders"
}

export interface NotificationSubject {
  prefixParameter: string;
  text: string;
  suffixParameter: string;
}

export interface NotificationConfigListing {
  mailMessagingConfig: MailMessagingConfig;
  includeWorkflowRelatedConfigs?: boolean;
  includeMemberSelections?: MemberSelection[];
  excludeMemberSelections?: MemberSelection[];
}

export interface NotificationConfig extends Auditable, Identifiable {
  subject: NotificationSubject;
  bannerId: string;
  templateId?: number;
  preSendActions: WorkflowAction[];
  defaultMemberSelection: MemberSelection;
  postSendActions: WorkflowAction[];
  monthsInPast?: number;
  defaultListId?: number;
  ccRoles?: string[];
  signOffRoles?: string[];
  senderRole?: string;
  replyToRole?: string;
  contentPreset?: string;
  help?: string;
}

export enum MemberSelection {
  EXPIRED_MEMBERS = "expired-members",
  MAILING_LIST = "mailing-list",
  MISSING_FROM_BULK_LOAD_MEMBERS = "missing-from-bulk-load-members",
  RECENTLY_ADDED = "recently-added",
}

export enum WorkflowAction {
  GENERATE_GROUP_MEMBER_PASSWORD_RESET_ID = "generate-group-member-password-reset-id",
  DISABLE_GROUP_MEMBER = "disable-group-member",
  BULK_DELETE_GROUP_MEMBER = "bulk-delete-group-member"
}

export interface MemberSelector {
  name: MemberSelection;
  memberMapper: (member: Member) => MemberFilterSelection;
  memberFilter: (member: Member) => boolean;
}

export interface ProcessToTemplateMappings {
  walkNotification: NotificationConfig;
  expenseNotification: NotificationConfig;
  passwordReset: NotificationConfig;
  forgottenPassword: NotificationConfig;
  welcome: NotificationConfig;
  expiredMembers: NotificationConfig;
  expiredMembersWarning: NotificationConfig;
}

export interface EmailAddress {
  email: string;
  name: string;
}

export interface CreateSendSmtpEmailRequest {
  member?: HasEmailFirstAndLastName;
  notificationConfig: NotificationConfig;
  notificationDirective: NotificationDirective;
  bodyContent?: string;
  emailSubject?: string;
  sender?: EmailAddress;
  to?: EmailAddress[];
  replyTo?: EmailAddress;
}

export interface EmailRequest {
  sender: EmailAddress;
  subject: string;
  headers?: object;
  params: SendSmtpEmailParams;
  templateId?: number;
  htmlContent?: string;
}

export interface SendSmtpEmailRequest extends EmailRequest {
  to?: EmailAddress[];
  cc?: EmailAddress[];
  replyTo?: EmailAddress;
}

export interface SendCampaignRequest {
  campaignId: number;
}

export const ADDRESSEE_CONTACT_FIRST_NAME = "Hi {{contact.FIRSTNAME}},";

export interface CreateCampaignRequest extends EmailRequest {
  createAsDraft: boolean;
  tag?: string;
  name: string;
  scheduledAt?: Date;
  replyTo: string;
  toField?: string;
  recipients: { segmentIds?: number[], exclusionListIds?: number[]; listIds?: number[] };
  attachmentUrl?: string;
  inlineImageActivation?: boolean;
  mirrorActive: boolean;
  header?: string;
  footer?: string;
  utmCampaign?: string;
}

export interface SendSmtpEmailParams {
  messageMergeFields: MessageMergeFields;
  memberMergeFields: MemberMergeFields;
  systemMergeFields: SystemMergeFields;
  accountMergeFields: AccountMergeFields;
}

export interface MessageMergeFields {
  subject: string;
  SIGNOFF_NAMES: string;
  BANNER_IMAGE_SOURCE: string;
  ADDRESS_LINE: string;
  BODY_CONTENT?: string;
}

export interface SystemMergeFields {
  APP_URL: string;
  APP_SHORTNAME: string;
  APP_LONGNAME: string;
  PW_RESET_LINK: string;
  FACEBOOK_URL: string;
  TWITTER_URL: string;
  INSTAGRAM_URL: string;
}

export interface AccountMergeFields {
  STREET: string;
  POSTCODE: string;
  TOWN: string;
}

export interface MemberMergeFields extends MergeFields {
  FULL_NAME: string;
}
export interface MergeFields {
  EMAIL: string;
  FNAME: string;
  LNAME: string;
  MEMBER_NUM: string;
  USERNAME: string;
  PW_RESET: string;
  MEMBER_EXP: string;
}

export const BREVO_DEFAULTS = {
  BASE_URL: "https://app.brevo.com",
  MY_BASE_URL: "https://my.brevo.com",
  EDITOR_URL: "https://editor-app.brevo.com"
} as const;

export interface MailConfig extends BuiltInProcessMappings {
  apiKey: string;
  baseUrl: string;
  myBaseUrl: string;
  editorUrl: string;
  allowUpdateLists: boolean;
  allowSendCampaign: boolean;
  allowSendTransactional: boolean;
  listSettings: ListSetting[];
}

export interface BuiltInProcessMappings {
  expenseNotificationConfigId: string;
  forgotPasswordNotificationConfigId: string;
  walkNotificationConfigId: string;
  contactUsNotificationConfigId: string;
  backupNotificationConfigId: string;
}

export interface NotificationConfigurationApiResponse extends ApiResponse {
  request: any;
  response: NotificationConfig | NotificationConfig[];
}

export interface MailTemplate {
  createdAt: string;
  sender: { name: string; id: number; email: string };
  subject: string;
  modifiedAt: string;
  toField: string;
  name: string;
  replyTo: string;
  doiTemplate: boolean;
  id: number;
  tag: string;
  isActive: boolean;
  testSent: boolean;
  htmlContent: string;
}

export interface MailTemplates {
  count: number;
  templates: MailTemplate[];
}

export interface TemplateOptions extends OptionalRequestOptions {
  templateStatus: boolean;
}

export interface OptionalRequestOptions {
  limit?: number,
  offset?: number,
  sort?: SortDirection,
  options?: {
    headers: {
      [name: string]: string;
    }
  }
}

export const DEFAULT_REQUEST_OPTIONS: OptionalRequestOptions = {
  limit: 50,
  offset: 0
};

export const DEFAULT_TEMPLATE_OPTIONS: TemplateOptions = {
  ...DEFAULT_REQUEST_OPTIONS,
  templateStatus: true,
};

export interface TemplateResponse {
  id: number;
  name: string;
  subject: string;
  isActive: boolean;
  testSent: boolean;
  sender: { name: string; id: number; email: string };
  replyTo: string;
  toField: string;
  tag: string;
  htmlContent: string;
  createdAt: string;
  modifiedAt: string;
  doiTemplate: boolean;
}

export interface MailMessagingConfig {
  externalSystems: ExternalSystems;
  brevo: {
    account: Account;
    accountError?: string;
    folders: FoldersListResponse;
    lists: ListsResponse;
    mailTemplates: MailTemplates;
  };
  group: Organisation;
  mailConfig: MailConfig;
  banners: BannerConfig[];
  committeeReferenceData: CommitteeReferenceData;
  notificationConfigs: NotificationConfig[];
}

export interface Plan {
  creditsType: string;
  credits: number;
  type: string;
}

export interface Account {
  email?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  address?: { zipCode: string; country: string; city: string; street: string };
  plan?: Plan[];
  relay?: { data: { port: number; relay: string; userName: string }; enabled: boolean };
  marketingAutomation?: { key: string; enabled: boolean };
}

export function DEFAULT_MAIL_MESSAGING_CONFIG(): MailMessagingConfig {
  return {
    externalSystems: null,
    brevo: {
      mailTemplates: null,
      folders: null,
      lists: null,
      account: null,
      accountError: null
    },
    notificationConfigs: null,
    committeeReferenceData: null,
    group: null,
    mailConfig: null,
    banners: null
  };
}
export const APP_SHORT_NAME_PREFIX_PARAMETER = "systemMergeFields.APP_SHORTNAME";
export const FULL_NAME_SUFFIX_PARAMETER = "memberMergeFields.FULL_NAME";
export const NOTIFICATION_CONFIG_DEFAULTS: NotificationConfig[] = [
  {
    subject: {
      prefixParameter: APP_SHORT_NAME_PREFIX_PARAMETER,
      text: "Website Password Reset Instructions",
      suffixParameter: FULL_NAME_SUFFIX_PARAMETER
    },
    preSendActions: [WorkflowAction.GENERATE_GROUP_MEMBER_PASSWORD_RESET_ID],
    postSendActions: [],
    defaultMemberSelection: MemberSelection.RECENTLY_ADDED,
    contentPreset: null,
    templateId: null,
    monthsInPast: 1,
    bannerId: null,
    senderRole: "membership",
    replyToRole: "support",
    signOffRoles: ["membership"],
  },
  {
    subject: {
      prefixParameter: APP_SHORT_NAME_PREFIX_PARAMETER,
      text: "Forgotten Password Reset",
      suffixParameter: FULL_NAME_SUFFIX_PARAMETER
    },
    preSendActions: [WorkflowAction.GENERATE_GROUP_MEMBER_PASSWORD_RESET_ID],
    postSendActions: [],
    defaultMemberSelection: MemberSelection.RECENTLY_ADDED,
    templateId: null,
    monthsInPast: 1,
    bannerId: null,
    signOffRoles: ["membership"],
    senderRole: "membership",
    replyToRole: "membership",
  },
  {
    subject: {
      prefixParameter: APP_SHORT_NAME_PREFIX_PARAMETER,
      text: "Welcome to The Group",
      suffixParameter: FULL_NAME_SUFFIX_PARAMETER
    },
    preSendActions: [WorkflowAction.GENERATE_GROUP_MEMBER_PASSWORD_RESET_ID],
    postSendActions: [],
    defaultMemberSelection: MemberSelection.RECENTLY_ADDED,
    monthsInPast: 1,
    templateId: null,
    senderRole: "membership",
    replyToRole: "membership",
    signOffRoles: ["chairman", "secretary", "treasurer", "membership", "social", "walks", "support"],
    bannerId: null,
  },
  {
    subject: {
      prefixParameter: APP_SHORT_NAME_PREFIX_PARAMETER,
      text: "Expired Membership",
      suffixParameter: FULL_NAME_SUFFIX_PARAMETER
    },
    preSendActions: [WorkflowAction.GENERATE_GROUP_MEMBER_PASSWORD_RESET_ID],
    postSendActions: [],
    defaultMemberSelection: MemberSelection.EXPIRED_MEMBERS,
    monthsInPast: 1,
    templateId: 11,
    senderRole: "membership",
    replyToRole: "membership",
    signOffRoles: ["membership"],
    bannerId: null
  },
  {
    subject: {
      prefixParameter: APP_SHORT_NAME_PREFIX_PARAMETER,
      text: "Expired Members Warning",
      suffixParameter: FULL_NAME_SUFFIX_PARAMETER
    },
    preSendActions: [],
    postSendActions: [],
    defaultMemberSelection: MemberSelection.EXPIRED_MEMBERS,
    monthsInPast: 1,
    templateId: null,
    senderRole: "membership",
    replyToRole: "membership",
    signOffRoles: ["membership"],
    bannerId: null
  },
  {
    subject: {
      prefixParameter: null,
      text: "Walk Change Notification",
      suffixParameter: null
    },
    preSendActions: [],
    postSendActions: [],
    defaultMemberSelection: MemberSelection.RECENTLY_ADDED,
    monthsInPast: 1,
    templateId: null,
    senderRole: "walks",
    replyToRole: "walks",
    signOffRoles: ["walks"],
    bannerId: null
  },
  {
    subject: {
      prefixParameter: APP_SHORT_NAME_PREFIX_PARAMETER,
      text: "Contact Us",
      suffixParameter: null
    },
    preSendActions: [],
    postSendActions: [],
    defaultMemberSelection: MemberSelection.RECENTLY_ADDED,
    monthsInPast: 1,
    templateId: null,
    senderRole: "support",
    replyToRole: "support",
    signOffRoles: ["support"],
    bannerId: null
  },
  {
    subject: {
      prefixParameter: APP_SHORT_NAME_PREFIX_PARAMETER,
      text: "Expense Notification",
      suffixParameter: null
    },
    preSendActions: [],
    postSendActions: [],
    defaultMemberSelection: MemberSelection.RECENTLY_ADDED,
    monthsInPast: 1,
    templateId: null,
    senderRole: "treasurer",
    replyToRole: "treasurer",
    signOffRoles: ["treasurer"],
    bannerId: null
  },
  {
    subject: {
      prefixParameter: APP_SHORT_NAME_PREFIX_PARAMETER,
      text: "Newsletter",
      suffixParameter: null
    },
    preSendActions: [],
    postSendActions: [],
    defaultMemberSelection: MemberSelection.MAILING_LIST,
    monthsInPast: 1,
    templateId: null,
    senderRole: "membership",
    replyToRole: "membership",
    signOffRoles: ["chairman", "secretary", "membership"],
    bannerId: null
  },
  {
    subject: {
      prefixParameter: APP_SHORT_NAME_PREFIX_PARAMETER,
      text: "Social Event Notification",
      suffixParameter: null
    },
    preSendActions: [],
    postSendActions: [],
    defaultMemberSelection: MemberSelection.MAILING_LIST,
    monthsInPast: 2,
    templateId: null,
    senderRole: "social",
    replyToRole: "social",
    signOffRoles: ["social"],
    bannerId: null
  },
  {
    subject: {
      prefixParameter: APP_SHORT_NAME_PREFIX_PARAMETER,
      text: "Your NGX-Ramblers Login",
      suffixParameter: FULL_NAME_SUFFIX_PARAMETER
    },
    preSendActions: [WorkflowAction.GENERATE_GROUP_MEMBER_PASSWORD_RESET_ID],
    postSendActions: [],
    defaultMemberSelection: MemberSelection.RECENTLY_ADDED,
    monthsInPast: 2,
    templateId: null,
    senderRole: "membership",
    replyToRole: "membership",
    signOffRoles: ["membership"],
    bannerId: null
  }
];

export interface ListCreateRequest {
  name: string;
  folderId?: number;
}

export interface ListUpdateRequest extends ListCreateRequest, HasListId {
}

export interface ListCreateResponse {
  id: number;
}

export interface ListInfo {
  totalBlacklisted: number;
  name: string;
  id: number;
  totalSubscribers: number;
  uniqueSubscribers: number;
  folderId: number;
}

export interface SegmentInfo {
  id: number;
  segmentName: string;
  categoryName: string;
  updatedAt: string;
}

export interface ListsResponse {
  lists: ListInfo[];
  count: number;
}

export interface SegmentsResponse {
  segments: SegmentInfo[];
  count: number;
}

export interface CreateContactRequest {
  email?: string;
  extId?: string;
  emailBlacklisted?: boolean;
  smsBlacklisted?: boolean;
  listIds?: number[];
  updateEnabled?: boolean;
  smtpBlacklistSender?: string[];
}

export interface CreateContactRequestWithAttributes extends CreateContactRequest {
  attributes?: Attributes;
}

export interface CreateContactRequestWithObjectAttributes extends CreateContactRequest {
  attributes?: ObjectAttributes;
}

export interface Attributes extends NamedAttributes {
  [key: string]: string;
}

export interface NamedAttributes {
  EMAIL?: string;
  BLACKLIST?: string;
  CLICKERS?: string;
  FIRSTNAME?: string;
  LASTNAME?: string;
  READERS?: string;
  SMS?: string;
  WHATSAPP?: string;
}

export interface ObjectAttributes extends NamedObjectAttributes {
  [key: string]: object;
}

export interface NamedObjectAttributes {
  EMAIL?: object;
  BLACKLIST?: object;
  CLICKERS?: object;
  FIRSTNAME?: object;
  LASTNAME?: object;
  READERS?: object;
  SMS?: object;
  WHATSAPP?: object;
}

export interface Contact extends MailIdentifiers {
  createdAt: string;
  listIds: number[];
  smsBlacklisted: boolean;
  listUnsubscribed: boolean;
  modifiedAt: string;
  emailBlacklisted: boolean;
  attributes: Attributes;
  extId?: string;
}

export interface ContactsListResponse {
  contacts: Contact[];
  count: number;
}

export interface SendersResponse {
  senders: Sender[];
}

export interface Sender {
  name: string;
  active: boolean;
  id?: number;
  ips?: any[];
  email: string;
}

export enum SenderSortField {
  NAME = "name",
  EMAIL = "email",
  MAPPED = "mapped",
  ACTIVE = "active"
}

export interface CreateSenderResponse extends Identifiable {
  spfError: boolean;
  dkimError: boolean;
}

export interface FoldersListResponse {
  folders: ListInfo[];
  count: number;
}

export interface MailListAuditApiResponse extends ApiResponse {
  request: any;
  response?: MailListAudit | MailListAudit[];
}

export interface MailListAudit extends HasListId {
  id?: string;
  memberId: string;
  createdBy: string;
  timestamp: number;
  status: AuditStatus;
  audit: any;
}

export type NumberOrString = number | string;

export interface ContactsDeleteRequest {
  ids: NumberOrString[];
}

export interface ContactsAddOrRemoveRequest extends HasListId {
  ids: number[];
}

export interface HasListType {
  listType: string;
}
export interface HasListId {
  listId: number;
}

export interface ContactAddOrRemoveResponse {
  success: number[];
  failure: number[];
}

export interface MailSubscription {
  subscribed?: boolean;
  id?: number;
}

export interface ListSetting {
  memberSubscribable: boolean;
  autoSubscribeNewMembers: boolean;
  requiresMemberEmailMarketingConsent: boolean;
  id: number;
}

export interface MailIdentifiers {
  email: string;
  id: number;
  extId?: string;
}

export interface ContactCreatedResponse extends StatusMappedResponseSingleInput {
  responseBody: { id: number };
}

export interface ContactToMember {
  contact: Contact;
  member: Member;
  memberUpdateRequired?: boolean;
  listIdsToRemoveFromContact?: number[];
}

export interface ContactIdToListId {
  contactId: number;
  listId: number;
}

export interface StatusMappedResponseSingleInput extends StatusMappedResponse {
  id: any;
}

export interface StatusMappedResponseMultipleInputs extends StatusMappedResponse {
  ids: any[];
}

export interface StatusMappedResponse {
  responseBody: any;
  success: boolean;
  message: string;
  status: number;
}

export interface CreateTemplateRequest {
  templateName: string;
  htmlContent: string;
  subject: string;
  isActive?: boolean;
  senderName?: string;
  senderEmail?: string;
}

export interface UpdateTemplateRequest {
  templateId: number;
  htmlContent?: string;
  subject?: string;
  templateName?: string;
  isActive?: boolean;
  senderName?: string;
  senderEmail?: string;
  senderId?: number;
}

export interface CreateTemplateResponse {
  id: number;
}

export enum ForgotPasswordIdentificationMethod {
  EMAIL_OR_USERNAME = "email-or-username",
  MEMBERSHIP_DETAILS = "membership-details"
}

export interface ForgotPasswordEmailRequest {
  identificationMethod: ForgotPasswordIdentificationMethod;
  emailOrUsername?: string;
  membershipNumber?: string;
  postcode?: string;
}

export interface ForgotPasswordEmailResponse {
  message: string;
}

export interface PushDefaultTemplateRequest {
  templateId: number;
  templateName: string;
}

export interface PushDefaultTemplateResponse {
  templateId: number;
  templateName: string;
  pushed: boolean;
  message: string;
}

export interface TemplateDiffRequest {
  templateId: number;
  templateName: string;
}

export interface TemplateDiffResponse {
  templateId: number;
  templateName: string;
  hasLocalTemplate: boolean;
  matchesLocal: boolean;
  brevoContentLength: number;
  localContentLength: number;
}

export interface SnapshotTemplatesRequest {
  templateIds?: number[];
  templateNames?: string[];
  templateStatus?: boolean;
  sanitiseHtml?: boolean;
}

export interface SnapshotTemplateSaved {
  templateId: number;
  templateName: string;
  filePath: string;
}

export interface SnapshotTemplateFailure {
  templateId: number;
  templateName: string;
  reason: string;
}

export interface SnapshotTemplatesResponse {
  totalTemplates: number;
  templatesRequested: number;
  outputDirectory: string;
  sanitisedHtml: boolean;
  createdCount: number;
  updatedCount: number;
  unchangedCount: number;
  savedCount: number;
  savedTemplates: SnapshotTemplateSaved[];
  failedTemplates: SnapshotTemplateFailure[];
}
