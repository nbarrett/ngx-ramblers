import { ApiResponse } from "./api-response.model";
import { DataQueryOptions } from "./api-request.model";
import { GroupEvent, InputSource } from "./group-event.model";
import { RamblersWalksManagerDateFormat } from "./date-format.model";
import { SortDirection } from "./sort.model";

export { RamblersWalksManagerDateFormat as DateFormat } from "./date-format.model";

export const WALKS_MANAGER_GO_LIVE_DATE = "2023-04-01";

export interface WalkCancellation {
  walkId: string;
  reason: string;
}

export interface WalkUploadInfo {
  walkId: string;
  date: string;
  title: string;
}

export interface WalkImageUploadSource {
  alternativeText: string;
  fileName: string;
  sourceUrl: string;
}

export interface WalkImagesUpload {
  date: string;
  images: WalkImageUploadSource[];
  walkId: string | null;
  title: string;
  fieldChanges: WalkFieldChange[];
  imagesChanged: boolean;
}

export interface RamblersWalksUploadRequest {
  fileName: string;
  walkIdDeletionList: string[];
  walkIdUploadList: WalkUploadInfo[];
  walkCancellations: WalkCancellation[];
  walkUncancellations: string[];
  headings: string[];
  rows: WalkUploadRow[];
  ramblersUser: string;
  walkImageUploads: WalkImagesUpload[];
}

export interface PublishStatus {
  messages: string[];
  actionRequired: boolean;
  publish: boolean;
}

export const WALK_PUBLISHED_AND_MATCHING = "Walk is published to Ramblers and the date, location, title and description match";
export const WALK_PUBLISHED_WITH_PROBLEMS = `${WALK_PUBLISHED_AND_MATCHING} — but it can't be re-uploaded until the problems above are fixed`;

export interface RamblersEventSummaryResponse {
  id: string;
  url: string;
  walksManagerUrl: string;
  title: string;
  description: string;
  startDate: string;
  startDateValue: number;
  start_location: LocationDetails;
  end_location: LocationDetails;
  media: Media[];
  status: WalkStatus;
  cancellation_reason: string;
  groupEvent: GroupEvent;
}

export enum WalkEditField {
  TITLE = "title",
  DATE = "date",
  START_TIME = "start time",
  DESCRIPTION = "description",
  ADDITIONAL_DETAILS = "additional details",
  WEBSITE_LINK = "website link",
  WALK_TYPE = "linear or circular",
  MEETING_TIME = "meeting time",
  DIFFICULTY = "difficulty",
  DISTANCE_KM = "distance km",
  DISTANCE_MILES = "distance miles",
  ASCENT_METRES = "ascent metres",
  ASCENT_FEET = "ascent feet",
  FINISH_TIME = "estimated finish time"
}

export interface WalkFieldChange {
  field: WalkEditField;
  value: string;
  existingValue: string;
}

export enum WalkEditStep {
  BASIC_INFORMATION = "basic-information",
  DESCRIPTION = "description",
  LOCATION = "meet-start-point",
  GRADING = "details"
}

export const WALK_EDIT_FIELD_STEPS: Record<WalkEditField, WalkEditStep> = {
  [WalkEditField.TITLE]: WalkEditStep.BASIC_INFORMATION,
  [WalkEditField.DATE]: WalkEditStep.BASIC_INFORMATION,
  [WalkEditField.START_TIME]: WalkEditStep.BASIC_INFORMATION,
  [WalkEditField.DESCRIPTION]: WalkEditStep.DESCRIPTION,
  [WalkEditField.ADDITIONAL_DETAILS]: WalkEditStep.DESCRIPTION,
  [WalkEditField.WEBSITE_LINK]: WalkEditStep.DESCRIPTION,
  [WalkEditField.WALK_TYPE]: WalkEditStep.LOCATION,
  [WalkEditField.MEETING_TIME]: WalkEditStep.LOCATION,
  [WalkEditField.DIFFICULTY]: WalkEditStep.GRADING,
  [WalkEditField.DISTANCE_KM]: WalkEditStep.GRADING,
  [WalkEditField.DISTANCE_MILES]: WalkEditStep.GRADING,
  [WalkEditField.ASCENT_METRES]: WalkEditStep.GRADING,
  [WalkEditField.ASCENT_FEET]: WalkEditStep.GRADING,
  [WalkEditField.FINISH_TIME]: WalkEditStep.GRADING
};

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

export enum EventsListSortBy {
  DATE = "date",
  DISTANCE = "distance"
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

export interface WalkLeaderContact extends Contact {
  slug?: string;
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
  sort?: EventsListSortBy;
  order?: SortDirection;
  date?: string;
  dateEnd?: string;
  inputSource?: string;
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
  WALK_ID = "Walk ID",
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

export interface CsvZipFile {
  name: string;
  content: string;
}

export interface CsvZipRequest {
  fileName: string;
  files: CsvZipFile[];
}

export interface CsvZipFileWithCount extends CsvZipFile {
  eventCount: number;
}

export const ALL_EVENT_TYPES: RamblersEventType[] = [RamblersEventType.GROUP_WALK, RamblersEventType.GROUP_EVENT, RamblersEventType.WELLBEING_WALK];
export const MAXIMUM_PAGE_SIZE = 300;
