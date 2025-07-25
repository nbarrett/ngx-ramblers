import { ApiResponse, Identifiable } from "./api-response.model";
import {
  Contact,
  Difficulty,
  LocationDetails,
  Media,
  Metadata,
  RamblersEventType,
  WalkStatus
} from "./ramblers-walks-manager";
import { WalkEvent } from "./walk-event.model";
import { MeetupConfig } from "./meetup-config.model";
import { Venue } from "./event-venue.model";
import { Notification } from "./committee.model";
import { FileNameData } from "./aws-object.model";
import { ImageConfig, LinkWithSource, Publish, RiskAssessmentRecord } from "./walk.model";

export interface HasStartAndEndTime {
  start_date_time: string;
  end_date_time: string;
}

export interface GroupEventUniqueKey {
  start_date_time: string;
  title: string;
  item_type: RamblersEventType;
  group_code: string;
}

export interface HasGroupCodeAndName {
  group_code: string;
  group_name: string;
}

export interface GroupEvent extends Identifiable, GroupEventUniqueKey, HasStartAndEndTime, HasGroupCodeAndName {
  area_code: string;
  description: string;
  additional_details: string;
  meeting_date_time: string;
  event_organiser?: Contact,
  location?: LocationDetails;
  start_location: LocationDetails;
  meeting_location: LocationDetails;
  end_location: LocationDetails;
  distance_km: number;
  distance_miles: number;
  ascent_feet: number;
  ascent_metres: number;
  difficulty: Difficulty;
  shape: string;
  duration: number;
  walk_leader: Contact;
  url: string;
  external_url: string;
  status: WalkStatus;
  cancellation_reason: string;
  accessibility: Metadata[];
  facilities: Metadata[];
  transport: Metadata[];
  media: Media[];
  linked_event: string;
  date_created: string;
  date_updated: string;
}

export interface ContactDetails {
  contactId: string;
  memberId: string;
  displayName: string;
  email: string;
  phone: string;
}

export interface Publishing {
  meetup: Publish;
  ramblers: Publish;
}

export interface ExtendedFields {
  migratedFromId: string;
  attachment?: FileNameData;
  attendees: Identifiable[];
  contactDetails: ContactDetails;
  imageConfig?: ImageConfig;
  links: LinkWithSource[];
  meetup: MeetupConfig;
  milesPerHour: number;
  notifications: Notification[];
  publishing: Publishing;
  riskAssessment: RiskAssessmentRecord[];
  venue?: Venue;
}

export interface ExtendedGroupEvent extends Identifiable {
  groupEvent: GroupEvent;
  fields: ExtendedFields;
  events: WalkEvent[];
}

export interface ExtendedGroupEventApiResponse extends ApiResponse {
  request: any;
  response?: ExtendedGroupEvent | ExtendedGroupEvent[];
}
export const FEET_TO_METRES_FACTOR = 0.3048;

export enum EventViewDispatch {
  PENDING = "pending",
  VIEW = "view",
  LIST = "list",
  DYNAMIC_CONTENT = "dynamic-content"
}

export interface EventViewDispatchWithEvent {
  eventView: EventViewDispatch;
  event?: Promise<ExtendedGroupEvent>;
}

export interface EventStatsRequest {
  itemType: RamblersEventType,
  groupCode: string,
}

export interface EditableEventStats extends EventStats {
  edited: boolean;
  editedGroupName: string;
  editedGroupCode: string;
}

export interface EventStats extends EventStatsRequest {
  groupName: string,
  walkCount: number,
  minDate: Date,
  maxDate: Date,
  uniqueCreators: string[],
  selected: boolean
}
