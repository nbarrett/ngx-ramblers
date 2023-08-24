import { DateCriteria } from "./api-request.model";
import { ApiResponse, Identifiable } from "./api-response.model";
import { FileNameData } from "./aws-object.model";
import { Notification } from "./committee.model";
import { FilterParametersSearch } from "./member-resource.model";

export interface FilterParameters extends FilterParametersSearch {
  selectType: DateCriteria;
  fieldSort: number;
}

export interface SocialEvent extends Identifiable {
  attachment?: FileNameData;
  attendees: Identifiable[];
  briefDescription?: string;
  contactEmail?: string;
  contactPhone?: string;
  displayName?: string;
  eventContactMemberId?: string;
  eventDate?: number;
  eventTimeEnd?: string;
  eventTimeStart?: string;
  fileNameData?: FileNameData;
  link?: string;
  linkTitle?: string;
  location?: string;
  longerDescription?: string;
  mailchimp?: any;
  notification?: Notification;
  postcode?: string;
  thumbnail?: string;
}

export interface SocialEventApiResponse extends ApiResponse {
  request: any;
  response?: SocialEvent | SocialEvent[];
}

export interface SocialEventsPermissions {
  detailView?: boolean;
  summaryView?: boolean;
  delete?: boolean;
  edits?: boolean;
  copy?: boolean;
  contentEdits?: boolean;
}
