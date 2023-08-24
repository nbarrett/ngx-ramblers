import { ApiResponse } from "./api-response.model";

export interface RamblersWalksUploadRequest {
  fileName: string;
  walkIdDeletionList: string[];
  headings: string[];
  rows: WalkUploadRow[];
  ramblersUser: string;
}

export interface RamblersWalkResponse {
  id: string;
  url: string;
  walksManagerUrl: string;
  title: string;
  startDate: string;
  startLocationW3w: string;
  startDateValue: number;
}

export interface RamblersWalksApiResponse extends ApiResponse {
  request: any;
  response?: RamblersWalkResponse[];
}

export enum WalkType {
  GROUP_WALK = "group-walk",
  GROUP_EVENT = "group-event",
  WELLBEING_WALK = "wellbeing-walk"
}

export enum WalkStatus {
  CONFIRMED = "confirmed",
  CANCELLED = "cancelled"
}

export interface MediaStyle {
  style: string;
  url: string;
  width: number;
  height: number;
}

export interface Media {
  alt: string;
  styles: [
    MediaStyle
  ];
}

export interface SearchResultsSummary {
  count: number;
  offset: number;
  limit: number;
  total: number;
}

export interface MetadataCode {
  code?: string;
}

export interface MetadataDescription {
  description?: string;
}

export interface Metadata extends MetadataCode, MetadataDescription {
}

export interface GroupWalk {
  item_type: WalkType;
  id: string;
  title: string;
  group_code: string;
  area_code: string;
  group_name: string;
  description: string;
  additional_details: string;
  start_date_time: string;
  end_date_time: string;
  meeting_date_time: string;
  start_location: {
    latitude: number;
    longitude: number;
    grid_reference_6: string;
    grid_reference_8: string;
    postcode: string;
    description: string;
    w3w: string;
  };
  meeting_location: {
    latitude: number;
    longitude: number;
    grid_reference_6: string;
    grid_reference_8: string;
    postcode: string;
    description: string;
    w3w: string;
  };
  end_location: {
    latitude: number;
    longitude: number;
    grid_reference_6: string;
    grid_reference_8: string;
    postcode: string;
    description: string;
    w3w: string;
  };
  distance_km: number;
  distance_miles: number;
  ascent_feet: number;
  ascent_metres: number;
  difficulty: {
    code: string;
    description: string;
  };
  shape: string;
  duration: number;
  walk_leader: {
    name: string;
    telephone: string;
    has_email: true;
    email_form: string;
    is_overridden: false
  };
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

export interface RamblersWalksRawApiResponse {
  summary: SearchResultsSummary;
  data: GroupWalk[];
}

export interface GroupListRequest {
  limit: number;
  groups: string[];
}

export interface WalkListRequest {
  rawData: boolean;
  limit: number;
}

export interface RamblersGroupsApiResponseApiResponse extends ApiResponse {
  request: any;
  response?: RamblersGroupsApiResponse[];
}

export interface RamblersGroupsApiResponse {
  scope: string;
  group_code: string;
  area_code: string;
  groups_in_area: string[];
  name: string;
  url: string;
  external_url: string;
  description: string;
  latitude: number;
  longitude: number;
  date_updated: string;
  date_walks_events_updated: string;
}

export interface RamblersWalksRawApiResponseApiResponse extends ApiResponse {
  request: any;
  response?: RamblersWalksRawApiResponse;
}

export enum WalkUploadColumnHeading {
  DATE = "Date",
  TITLE = "Title",
  DESCRIPTION = "Description",
  ADDITIONAL_DETAILS = "Additional details",
  WEBSITE_LINK = "Website Link",
  WALK_LEADERS = "Walk leaders",
  LINEAR_OR_CIRCULAR = "Linear or Circular",
  START_TIME = "Start time",
  STARTING_LOCATION = "Starting location",
  STARTING_POSTCODE = "Starting postcode",
  STARTING_GRIDREF = "Starting gridref",
  STARTING_LOCATION_DETAILS = "Starting location details",
  MEETING_TIME = "Meeting time",
  MEETING_LOCATION = "Meeting location",
  MEETING_POSTCODE = "Meeting postcode",
  MEETING_GRIDREF = "Meeting gridref",
  MEETING_LOCATION_DETAILS = "Meeting location details",
  EST_FINISH_TIME = "Est finish time",
  FINISHING_LOCATION = "Finishing location",
  FINISHING_POSTCODE = "Finishing postcode",
  FINISHING_GRIDREF = "Finishing gridref",
  FINISHING_LOCATION_DETAILS = "Finishing location details",
  DIFFICULTY = "Difficulty",
  DISTANCE_KM = "Distance km",
  DISTANCE_MILES = "Distance miles",
  ASCENT_METRES = "Ascent metres",
  ASCENT_FEET = "Ascent feet",
  DOG_FRIENDLY = "Dog friendly",
  INTRODUCTORY_WALK = "Introductory walk",
  NO_STILES = "No stiles",
  FAMILY_FRIENDLY = "Family-friendly",
  WHEELCHAIR_ACCESSIBLE = "Wheelchair accessible",
  ACCESSIBLE_BY_PUBLIC_TRANSPORT = "Accessible by public transport",
  CAR_PARKING_AVAILABLE = "Car parking available",
  CAR_SHARING_AVAILABLE = "Car sharing available",
  COACH_TRIP = "Coach trip",
  REFRESHMENTS_AVAILABLE_PUB_CAFE = "Refreshments available (Pub/cafe)",
  TOILETS_AVAILABLE = "Toilets available"
}

export type WalkUploadRow = {
  [column in keyof WalkUploadColumnHeading]?: string;
}
