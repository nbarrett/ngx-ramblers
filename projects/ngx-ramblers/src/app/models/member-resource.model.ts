import { ApiResponse, Identifiable } from "./api-response.model";
import { FileNameData } from "./aws-object.model";
import { MailchimpCampaign, MailchimpCampaignVersion2 } from "./mailchimp.model";

export enum AccessLevel {
  HIDDEN = "hidden",
  ENVIRONMENT_ADMIN = "environmentAdmin",
  COMMITTEE = "committee",
  LOGGED_IN_MEMBER = "loggedInMember",
  PUBLIC = "public"
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
