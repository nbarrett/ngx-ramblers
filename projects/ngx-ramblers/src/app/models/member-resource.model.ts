import { ApiResponse, Identifiable } from "./api-response.model";
import { FileNameData } from "./aws-object.model";
import { MailchimpCampaign, MailchimpCampaignVersion2 } from "./mailchimp.model";

export enum AccessLevel {
  HIDDEN = "hidden",
  ENVIRONMENT_ADMIN = "environmentAdmin",
  MEMBER_ADMIN = "memberAdmin",
  EVENT_ADMIN = "eventAdmin",
  EVENT_LEADER = "eventLeader",
  COMMITTEE = "committee",
  LOGGED_IN_MEMBER = "loggedInMember",
  PUBLIC = "public"
}

export const EVENT_SCOPED_ACCESS_LEVELS: AccessLevel[] = [AccessLevel.EVENT_ADMIN, AccessLevel.EVENT_LEADER];

export const EVENT_ACTION_ACCESS_LEVELS: AccessLevel[] = [AccessLevel.HIDDEN, AccessLevel.EVENT_ADMIN, AccessLevel.EVENT_LEADER, AccessLevel.COMMITTEE, AccessLevel.LOGGED_IN_MEMBER];

export function generalAccessLevels(): AccessLevel[] {
  return [AccessLevel.HIDDEN, AccessLevel.ENVIRONMENT_ADMIN, AccessLevel.MEMBER_ADMIN, AccessLevel.COMMITTEE, AccessLevel.LOGGED_IN_MEMBER, AccessLevel.PUBLIC];
}

export interface EventAccessContext {
  loggedIn: boolean;
  committee: boolean;
  memberAdmin: boolean;
  eventAdmin: boolean;
  eventLeader: boolean;
}

export enum ResourceType {
  EMAIL = "email",
  FILE = "file",
  URL = "url",
  PUBLIC = "public"
}

export interface ResourceSubject extends Identifiable {
  description: string;
}

export interface ResourceTypeData extends Identifiable {
  description: string;
  action: string;
  icon: (memberResource?: MemberResource) => string;
  resourceUrl: (memberResource: MemberResource) => string;
}

export interface AccessLevelData extends Identifiable {
  description: string;
  filter: () => boolean;
  includeAccessLevelIds: AccessLevel[];
}
export type MailchimpCampaignMixedVersion = MailchimpCampaign | MailchimpCampaignVersion2 ;
export interface MemberResource extends Identifiable {
  data: {
    campaignSearchTerm?: string;
    campaign?: MailchimpCampaignMixedVersion;
    fileNameData?: FileNameData;
  };
  resourceType: ResourceType;
  accessLevel: AccessLevel;
  createdDate: number;
  createdBy: string;
  title?: string;
  resourceDate?: number;
  description?: string;
  subject?: string;
}

export interface MemberResourceApiResponse extends ApiResponse {
  request: any;
  response?: MemberResource | MemberResource[];
}

export interface MemberResourcesPermissions {
  committee?: boolean;
  delete?: boolean;
  edit?: boolean;
}
