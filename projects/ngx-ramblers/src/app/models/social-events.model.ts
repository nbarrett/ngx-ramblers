import { ApiResponse, Identifiable } from "./api-response.model";
import { FileNameData } from "./aws-object.model";
import { Notification } from "./committee.model";
import { Media, RamblersEventType } from "./ramblers-walks-manager";
import { HasMaxColumns } from "./content-text.model";

export interface SocialEvent extends Identifiable, HasMedia {
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

export interface HasMedia {
  media?: Media[];
}

export interface SocialEventApiResponse extends ApiResponse {
  request: any;
  response?: SocialEvent | SocialEvent[];
}

export interface SocialEventsPermissions {
  admin?: boolean;
  detailView?: boolean;
  summaryView?: boolean;
  delete?: boolean;
  edits?: boolean;
  copy?: boolean;
  contentEdits?: boolean;
}

export interface EventsData extends HasMaxColumns {
  fromDate: number;
  toDate: number;
  allow: {
    autoTitle?: boolean;
    quickSearch?: boolean,
    pagination?: boolean,
    addNew?: boolean
  };
  eventTypes: RamblersEventType[];
}
