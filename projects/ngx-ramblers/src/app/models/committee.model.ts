import map from "lodash-es/map";
import { ApiResponse, Identifiable } from "./api-response.model";
import { FileNameData } from "./aws-object.model";
import { DateValue } from "./date.model";

export const committeeYearsPath = "committee#committee-years";

export interface GroupEventType {
  eventType: string;
  area: string;
  description: string;
}
export const DEFAULT_COST_PER_MILE = 0.28;
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

export interface GroupEvent extends Identifiable {
  selected: boolean;
  eventType: GroupEventType;
  eventDate: number;
  eventTime?: string;
  distance?: string;
  postcode: string;
  title: string;
  description: string;
  contactName: string;
  contactPhone?: string;
  contactEmail: string;
}

export interface CommitteeMember {
  description: string;
  email: string;
  fullName: string;
  memberId?: string;
  nameAndDescription?: string;
  type: string;
}

export interface CommitteeFileType {
  description: string;
  public?: boolean;
}

export interface ExpensesConfig {
  costPerMile: number;
}

export interface CommitteeConfig {
  contactUs: {
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

export interface NotificationContent {
  addresseeType?: string;
  attachment?: { include?: boolean; value?: string; };
  campaignId?: string;
  customCampaignType?: string;
  description?: { include: boolean; value?: string; };
  destinationType?: string;
  includeDownloadInformation?: boolean;
  list?: string;
  attendees?: { include?: boolean };
  eventDetails?: { include?: boolean; value: string };
  replyTo?: { include?: boolean; value: string; };
  selectedMemberIds?: string[];
  signoffAs?: { include?: boolean; value?: string; };
  signoffText?: { include?: boolean; value?: string; };
  text?: { include?: boolean; value?: string; };
  title?: { include?: boolean; value?: string; };
}

export interface Notification {
  cancelled?: boolean;
  content?: NotificationContent;
  groupEventsFilter?: GroupEventsFilter;
  groupEvents?: GroupEvent[];
}

export interface CommitteeYear {
  year: number;
  latestYear: boolean;
}
