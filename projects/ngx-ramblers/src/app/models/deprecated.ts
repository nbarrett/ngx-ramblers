import { ApiResponse, Identifiable } from "./api-response.model";
import { HasMedia } from "./social-events.model";
import { ImageConfig, RiskAssessmentRecord, ValueAndFormatted, WalkType } from "./walk.model";
import { LocationDetails, Metadata, RamblersEventType } from "./ramblers-walks-manager";
import { WalkEvent } from "./walk-event.model";
import { MeetupConfig } from "./meetup-config.model";
import { Venue } from "./event-venue.model";
import { Group } from "./system.model";
import { FileNameData } from "./aws-object.model";
import { Notification } from "./committee.model";

export interface Walk extends Identifiable, HasMedia {
  contactName?: string;
  walkType?: WalkType;
  eventType: RamblersEventType;
  briefDescriptionAndStartPoint?: string;
  contactEmail?: string;
  contactId?: string;
  contactPhone?: string;
  displayName?: string;
  distance?: string;
  milesPerHour?: number;
  ascent?: string;
  events: WalkEvent[];
  grade?: string;
  longerDescription?: string;
  config?: { meetup: MeetupConfig };
  meetupEventTitle?: string;
  meetupEventDescription?: string;
  meetupEventUrl?: string;
  meetupPublish?: boolean;
  osMapsRoute?: string;
  osMapsTitle?: string;
  ramblersWalkId?: string;
  ramblersWalkUrl?: string;
  ramblersPublish?: boolean;
  startTime?: string;
  finishTime?: string;
  walkDate?: number;
  walkLeaderMemberId?: string;
  venue?: Venue;
  riskAssessment?: RiskAssessmentRecord[];
  group?: Group;
  features?: Metadata[];
  additionalDetails?: string;
  organiser?: string;
  imageConfig?: ImageConfig;
  start_location?: LocationDetails;
  meeting_location?: LocationDetails;
  end_location?: LocationDetails;
}

export interface SocialEventApiResponse extends ApiResponse {
  request: any;
  response?: SocialEvent | SocialEvent[];
}

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
  link?: string;
  linkTitle?: string;
  location?: string;
  longerDescription?: string;
  notification?: Notification;
  postcode?: string;
  thumbnail?: string;
}

export interface WalkApiResponse extends ApiResponse {
  request: any;
  response?: Walk | Walk[];
}

export interface LegacyWalkAscent {
  rawData: string;
  feet: ValueAndFormatted;
  metres: ValueAndFormatted;
  validationMessage?: string;
}
