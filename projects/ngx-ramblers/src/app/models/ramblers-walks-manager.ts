import { ApiResponse } from "./api-response.model";
import { DataQueryOptions } from "./api-request.model";
import { GroupEvent, InputSource } from "./group-event.model";


export enum DateFormat {
  WALKS_MANAGER_CSV = "dd/MM/yyyy",
  WALKS_MANAGER_API = "yyyy-MM-dd",
  FILE_TIMESTAMP = "yyyy-MM-dd-HH-mm-ss",
  EXPORT_FILENAME = "dd-MMMM-yyyy-HH-mm",
  DISPLAY_DATE_FULL = "cccc, d MMMM yyyy"
}

export const WALKS_MANAGER_GO_LIVE_DATE = "2023-04-01";

export interface RamblersWalksUploadRequest {
  fileName: string;
  walkIdDeletionList: string[];
  headings: string[];
  rows: WalkUploadRow[];
  ramblersUser: string;
}

export interface PublishStatus {
  messages: string[];
  actionRequired: boolean;
  publish: boolean;
}

export interface RamblersEventSummaryResponse {
  id: string;
  url: string;
  walksManagerUrl: string;
  title: string;
  startDate: string;
  startDateValue: number;
  start_location: LocationDetails;
  end_location: LocationDetails;
  media: Media[];
}

export interface RamblersEventSummaryApiResponse extends ApiResponse {
  request: any;
  response?: RamblersEventSummaryResponse[];
}

export interface EventQueryParameters {
  inputSource: InputSource;
  suppressEventLinking: boolean;
  groupCode?: string;
  dataQueryOptions?: DataQueryOptions;
  ids?: string[];
  types?: RamblersEventType[];
}

export enum RamblersEventType {
  GROUP_WALK = "group-walk",
  GROUP_EVENT = "group-event",
  WELLBEING_WALK = "wellbeing-walk"
}

export enum WalkStatus {
  DRAFT = "draft",
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
  title: string;
  credit: string;
  caption: string;
  styles: MediaStyle[];
}

export interface BasicMedia {
  alt: string;
  url: string
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

export interface Contact {
  id?: string;
  name: string;
  telephone: string;
  has_email: boolean;
  email_form?: string;
  is_overridden: boolean;
}

export interface LocationDetails {
  latitude: number;
  longitude: number;
  grid_reference_6: string;
  grid_reference_8: string;
  grid_reference_10: string;
  postcode: string;
  description: string;
  w3w: string;
}

export type Difficulty = Metadata

export interface RamblersGroupEventsRawApiResponse {
  summary: SearchResultsSummary;
  data: GroupEvent[];
}

export interface GroupListRequest {
  limit: number;
  groups: string[];
}

export interface EventsListRequest {
  suppressEventLinking: boolean;
  types: RamblersEventType[];
  ids?: string[];
  rawData?: boolean;
  limit?: number;
  groupCode?: string;
  sort?: "date" | "distance";
  order?: "asc" | "desc";
  date?: string;
  dateEnd?: string;
}

export interface RamblersGroupsApiResponseApiResponse extends ApiResponse {
  request: any;
  response?: RamblersGroupsApiResponse[];
}

export interface HasNgSelectAttributes {
  ngSelectAttributes: { label: string; };
}

export interface RamblersGroupWithLabel extends RamblersGroupsApiResponse, HasNgSelectAttributes {
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

export interface RamblersEventsApiResponse extends ApiResponse {
  request: any;
  response?: RamblersGroupEventsRawApiResponse;
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

export const ALL_EVENT_TYPES: RamblersEventType[] = [RamblersEventType.GROUP_WALK, RamblersEventType.GROUP_EVENT, RamblersEventType.WELLBEING_WALK];
export const MAXIMUM_PAGE_SIZE = 300;
