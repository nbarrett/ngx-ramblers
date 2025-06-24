import map from "lodash-es/map";
import { ApiResponse, Identifiable } from "./api-response.model";
import { FileNameData } from "./aws-object.model";
import { DateValue } from "./date.model";
import { NotificationConfig } from "./mail.model";
import { Link } from "./page.model";

export interface GroupEventType {
  eventType: string;
  area: string;
  description: string;
}
export const DEFAULT_COST_PER_MILE = 0.28;

export const uploadGroupEventType: GroupEventType = {
  area: "upload",
  eventType: "Upload Date",
  description: "Upload Date"
};

export const GroupEventTypes: { [image: string]: GroupEventType } = {
  WALK: {
    area: "walks",
    eventType: "walk",
    description: "Walk"
  },
  SOCIAL: {
    area: "social",
    eventType: "socialEvent",
    description: "Social Event"
  },
  COMMITTEE: {
    area: "committee",
    eventType: "AGM & Committee",
    description: "Committee Event"
  }
};

export function groupEventTypeFor(item: string): GroupEventType {
  return map(GroupEventTypes, (item) => item).find((eventType: GroupEventType) => eventType.description === item || eventType.area === item || eventType.eventType === item);
}

export interface CommitteeFile extends Identifiable {
  eventDate?: number;
  createdDate?: number;
  postcode?: string;
  fileType: string;
  fileNameData?: FileNameData;
}

export interface CommitteeFileApiResponse extends ApiResponse {
  request: any;
  response?: CommitteeFile[] | CommitteeFile;
}

export interface GroupEventSummary extends Identifiable {
  image?: string;
  slug: string;
  selected: boolean;
  eventType: GroupEventType;
  eventDate: number;
  eventTime?: string;
  distance?: string;
  location: string;
  postcode: string;
  title: string;
  description: string;
  contactName: string;
  contactPhone?: string;
  contactEmail: string;
}

interface NotificationImage {
  src: string;
  alt: string;
  link: Link;
}

export interface NotificationItem extends Identifiable {
  callToAction: Link;
  text: string;
  subject: string;
  image: NotificationImage;
}

export enum RoleType {
  COMMITTEE_MEMBER = "COMMITTEE_MEMBER",
  GROUP_MEMBER = "GROUP_MEMBER",
  SYSTEM_ROLE = "SYSTEM_ROLE"
}

export enum BuiltInRole {
  WALKS_CO_ORDINATOR = "WALKS_CO_ORDINATOR",
  SOCIAL_CO_ORDINATOR = "SOCIAL_CO_ORDINATOR",
  TREASURER = "TREASURER"
}

export interface CommitteeMember {
  description: string;
  email: string;
  fullName: string;
  memberId?: string;
  nameAndDescription?: string;
  type: string;
  vacant?: boolean;
  roleType: RoleType;
  builtInRoleMapping?: BuiltInRole;
}

export interface CommitteeRolesChangeEvent {
  committeeMember: CommitteeMember;
  roles: string[];
}

export interface CommitteeFileType {
  description: string;
  public?: boolean;
}

export interface ExpensesConfig {
  costPerMile: number;
}

export interface CommitteeConfig {
  roles: CommitteeMember[],
  contactUs?: {
    chairman: CommitteeMember;
    secretary: CommitteeMember;
    treasurer: CommitteeMember;
    membership: CommitteeMember;
    social: CommitteeMember;
    walks: CommitteeMember;
    support: CommitteeMember;
  };
  fileTypes: CommitteeFileType [];
  expenses: ExpensesConfig;
}

export interface GroupEventsFilter {
  includeImage: boolean;
  selectAll: boolean;
  eventIds?: string[];
  search: string;
  fromDate: DateValue;
  toDate: DateValue;
  includeContact: boolean;
  includeDescription: boolean;
  includeLocation: boolean;
  includeWalks: boolean;
  includeSocialEvents: boolean;
  includeCommitteeEvents: boolean;
  sortBy?: string;
}

export interface IncludedStringValue {
  include?: boolean;
  value?: string;
}

export interface IncludedStringValues {
  include?: boolean;
  value?: string[];
}

export interface NotificationContent {
  notificationConfig: NotificationConfig;
  addresseeType?: string;
  attachment?: IncludedStringValue;
  customCampaignType?: string;
  description?: IncludedStringValue;
  listId?: number;
  includeDownloadInformation?: boolean;
  attendees?: { include?: boolean };
  eventDetails?: IncludedStringValue;
  replyTo?: IncludedStringValue;
  selectedMemberIds?: string[];
  signoffAs?: IncludedStringValue;
  signoffText?: IncludedStringValue;
  text?: IncludedStringValue;
  title?: IncludedStringValue;
}

export interface Notification {
  cancelled?: boolean;
  content?: NotificationContent;
  groupEventsFilter?: GroupEventsFilter;
  groupEvents?: GroupEventSummary[];
}

export interface CommitteeYear {
  year: number;
  latestYear: boolean;
}

export interface ContactFormDetails {
  timestamp: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  sendCopy: boolean;
}

export interface ValidateTokenRequest {
  captchaToken: string;
}

export interface ValidateTokenResponse {
  message: string;
}

export interface ValidateTokenApiResponse extends ApiResponse {
  response?: ValidateTokenResponse;
}
