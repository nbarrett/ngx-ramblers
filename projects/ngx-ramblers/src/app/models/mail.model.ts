import { ApiResponse, Identifiable } from "./api-response.model";
import { Organisation } from "./system.model";
import { CommitteeReferenceData } from "../services/committee/committee-reference-data";
import { BannerConfig } from "./banner-configuration.model";
import { Auditable, Member, MemberFilterSelection } from "./member.model";
import { NotificationDirective } from "../notifications/common/notification.directive";

export interface NotificationSubject {
  prefixParameter: string;
  text: string;
  suffixParameter: string;
}

export interface NotificationConfig extends Auditable, Identifiable {
  subject: NotificationSubject;
  bannerId: string;
  templateId?: number;
  preSendActions: WorkflowAction[];
  defaultMemberSelection: MemberSelection;
  postSendActions: WorkflowAction[];
  monthsInPast?: number;
  signOffRoles?: string[];
  senderRole?: string;
  replyToRole?: string;
  contentPreset?: string;
  help?: string;
}

export enum MemberSelection {
  RECENTLY_ADDED = "recently-added",
  EXPIRED_MEMBERS = "expired-members",
  MISSING_FROM_BULK_LOAD_MEMBERS = "missing-from-bulk-load-members",
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
  member: Member;
  notificationConfig: NotificationConfig;
  notificationDirective: NotificationDirective;
  bodyContent?: string;
  emailSubject?: string;
}

export interface SendSmtpEmailRequest {
  sender: EmailAddress;
  subject: string;
  to?: EmailAddress[];
  cc?: EmailAddress[];
  replyTo?: EmailAddress;
  headers?: object;
  params: SendSmtpEmailParams;
  templateId?: number;
  htmlContent?: string;
}

export interface SendSmtpEmailParams {
  messageMergeFields: MessageMergeFields;
  memberMergeFields: MemberMergeFields;
  systemMergeFields: SystemMergeFields;
}

export interface MessageMergeFields {
  subject: string;
  SIGNOFF_NAMES: string;
  BANNER_IMAGE_SOURCE: string;
  BODY_CONTENT?: string;
}

export interface SystemMergeFields {
  APP_URL: string;
  APP_SHORTNAME: string;
  APP_LONGNAME: string;
  PW_RESET_LINK: string;
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

export interface MailConfig extends BuiltInProcessMappings {
  apiKey: string;
  baseUrl: string;
  allowUpdateLists: boolean;
  allowSendCampaign: boolean;
  allowSendTransactional: boolean;
}

export interface BuiltInProcessMappings {
  forgotPasswordNotificationConfigId: string;
  walkNotificationConfigId: string;
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

export interface MailTemplatesApiResponse extends ApiResponse {
  request: any;
  response: MailTemplates;
}

export interface TemplateOptions {
  templateStatus: boolean,
  limit?: number,
  offset?: number,
  sort?: "asc" | "desc",
  options?: {
    headers: {
      [name: string]: string;
    }
  }
}

export const DEFAULT_TEMPLATE_OPTIONS: TemplateOptions = {
  templateStatus: true,
  limit: 50,
  offset: 0
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
  group: Organisation;
  mailConfig: MailConfig;
  banners: BannerConfig[];
  mailTemplates: MailTemplates;
  committeeReferenceData: CommitteeReferenceData;
  notificationConfigs: NotificationConfig[];
}

export interface Plan {
  creditsType: string;
  credits: number;
  type: string;
}

export interface Account {
  email: string;
  firstName: string;
  lastName: string;
  companyName: string;
  address: { zipCode: string; country: string; city: string; street: string };
  plan: Plan[];
  relay: { data: { port: number; relay: string; userName: string }; enabled: boolean };
  marketingAutomation: { key: string; enabled: boolean };
}

export function DEFAULT_MAIL_MESSAGING_CONFIG(): MailMessagingConfig {
  return {
    mailTemplates: null,
    notificationConfigs: null,
    committeeReferenceData: null,
    group: null,
    mailConfig: null,
    banners: null
  };
}

export const NOTIFICATION_CONFIG_DEFAULTS: NotificationConfig[] = [
  {
    subject: {
      prefixParameter: "systemMergeFields.APP_SHORTNAME",
      text: "Website Password Reset Instructions",
      suffixParameter: "memberMergeFields.FULL_NAME"
    },
    preSendActions: [WorkflowAction.GENERATE_GROUP_MEMBER_PASSWORD_RESET_ID],
    postSendActions: [],
    defaultMemberSelection: null,
    contentPreset: null,
    templateId: null,
    monthsInPast: 2,
    bannerId: null,
    senderRole: "membership",
    replyToRole: "support",
    signOffRoles: ["membership"],
  },
  {
    subject: {
      prefixParameter: "systemMergeFields.APP_SHORTNAME",
      text: "Forgotten Password Reset",
      suffixParameter: "memberMergeFields.FULL_NAME"
    },
    preSendActions: [WorkflowAction.GENERATE_GROUP_MEMBER_PASSWORD_RESET_ID],
    postSendActions: [],
    defaultMemberSelection: null,
    templateId: null,
    monthsInPast: 2,
    bannerId: null,
    signOffRoles: ["membership"],
    senderRole: "membership",
    replyToRole: "membership",
  },
  {
    subject: {
      prefixParameter: "systemMergeFields.APP_SHORTNAME",
      text: "Welcome to The Group",
      suffixParameter: "memberMergeFields.FULL_NAME"
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
      prefixParameter: "systemMergeFields.APP_SHORTNAME",
      text: "Expired Membership",
      suffixParameter: "memberMergeFields.FULL_NAME"
    },
    preSendActions: [WorkflowAction.GENERATE_GROUP_MEMBER_PASSWORD_RESET_ID],
    postSendActions: [],
    defaultMemberSelection: MemberSelection.EXPIRED_MEMBERS,
    monthsInPast: 2,
    templateId: 11,
    senderRole: "membership",
    replyToRole: "membership",
    signOffRoles: ["membership"],
    bannerId: null
  },
  {
    subject: {
      prefixParameter: "systemMergeFields.APP_SHORTNAME",
      text: "Expired Members Warning",
      suffixParameter: "memberMergeFields.FULL_NAME"
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
    defaultMemberSelection: null,
    templateId: null,
    senderRole: "walks",
    replyToRole: "walks",
    signOffRoles: ["walks"],
    bannerId: null
  }
];
