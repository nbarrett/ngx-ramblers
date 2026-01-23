import { ApiResponse } from "./api-response.model";
import { WalkAccessMode } from "./walk-edit-mode.model";
import { WalkEventType } from "./walk-event-type.model";
import {
  BasicMedia,
  Contact,
  Difficulty,
  HasNgSelectAttributes,
  LocationDetails,
  MetadataDescription,
  PublishStatus,
  RamblersEventSummaryResponse,
  WalkStatus,
  WalkLeaderContact
} from "./ramblers-walks-manager";
import { HasBasicEventSelection } from "./search.model";
import { Link } from "./page.model";
import { faHouse } from "@fortawesome/free-solid-svg-icons";
import { IconDefinition } from "@fortawesome/fontawesome-common-types";
import { ExtendedGroupEvent, HasGroupCodeAndName, InputSource } from "./group-event.model";
import { FilterCriteria } from "./api-request.model";
import { BulkLoadMemberAndMatchToWalk } from "./member.model";
import { FileNameData } from "./aws-object.model";

export interface GoogleMapsConfig {
  apiKey: string;
  zoomLevel: number;
}

export interface ValueAndFormatted {
  value: number;
  valueAsString: string;
  formatted: string;
}

export enum DistanceUnit {
  FEET = "ft",
  KILOMETRES = "km",
  METRES = "m",
  MILES = "mi",
  UNKNOWN = "unknown",
}

export enum ImageSource {
  NONE = "NONE",
  LOCAL = "LOCAL",
  WALKS_MANAGER = "WALKS_MANAGER"
}

export enum ServerDownloadStatusType {
  ACTIVE = "ACTIVE",
  COMPLETED = "COMPLETED",
  ERROR = "ERROR",
  HUNG = "HUNG"
}

export interface OperationResult {
  success: boolean;
  message: string;
}

export interface DownloadConflictResponse {
  allowed: boolean;
  reason?: string;
  activeDownload?: ServerDownloadStatus;
}

export interface WalkDistance {
  rawData: string;
  miles: ValueAndFormatted;
  kilometres: ValueAndFormatted;
  validationMessage?: string;
}

export interface WalkAscent {
  rawData: number;
  feet: ValueAndFormatted;
  metres: ValueAndFormatted;
  validationMessage?: string;
}

export interface Links {
  meetup: Link;
  osMapsRoute: Link;
  venue: Link;
}

export interface EventLinkConfig extends MetadataDescription {
  code: LinkSource;
  image?: string;
  icon?: IconDefinition;
}

export interface WalkGrade extends Difficulty {
  image: string;
}

export const MODERATE: WalkGrade = {code: "moderate", description: "Moderate", image: "moderate.png"};
export const WALK_GRADES: WalkGrade[] = [
  {code: "easy-access", description: "Easy access", image: "easy.png"},
  {code: "easy", description: "Easy", image: "easy.png"},
  {code: "leisurely", description: "Leisurely", image: "leisurely.png"},
  MODERATE,
  {code: "strenuous", description: "Strenuous", image: "strenuous.png"},
  {code: "technical", description: "Technical", image: "strenuous.png"}];

export enum LinkSource {
  FACEBOOK = "facebook",
  LOCAL = "local",
  MEETUP = "meetup",
  OS_MAPS = "os-maps",
  RAMBLERS = "ramblers",
  VENUE = "venue",
  W3W = "w3w",
}

export const LINK_CONFIG: EventLinkConfig[] = [
  {code: LinkSource.FACEBOOK, description: "Facebook", image: "ordnance-survey.png"},
  {code: LinkSource.OS_MAPS, description: "OS Maps", image: "ordnance-survey.png"},
  {code: LinkSource.RAMBLERS, description: "Ramblers", image: "favico.ico"},
  {code: LinkSource.MEETUP, description: "Meetup", image: "meetup.ico"},
  {code: LinkSource.W3W, description: "What3Words", image: "w3w.png"},
  {code: LinkSource.VENUE, description: "Venue", icon: faHouse}
];

export interface LocalAndRamblersWalk {
  localWalk: ExtendedGroupEvent;
  ramblersWalk: RamblersEventSummaryResponse;
}

export interface ExtendedGroupEventWithLabel extends ExtendedGroupEvent, HasNgSelectAttributes {

}

export interface LinkWithSource extends Link {
  source: LinkSource;
}

export interface Publish {
  contactName: string;
  publish: boolean;
}

export interface ImageConfig {
  source: ImageSource;
  importFrom: {
    areaCode: string;
    groupCode: string;
    filterParameters: HasBasicEventSelection;
    walkId?: string;
  };
}

export interface RiskAssessmentRecord {
  confirmationText?: string;
  memberId: string;
  confirmed: boolean;
  confirmationDate: number;
  riskAssessmentSection: string;
  riskAssessmentKey: string;
}

export interface WalkExportData {
  displayedWalk: DisplayedWalk;
  validationMessages: string[];
  publishedOnRamblers: boolean;
  publishStatus: PublishStatus;
  selected: boolean;
  ramblersStatus?: WalkStatus;
  ramblersUrl?: string;
}


export interface WalkLeaderIdsApiResponse extends ApiResponse {
  request: any;
  response?: string[];
  labels?: WalkLeaderLabelRecord[];
}

export interface WalkLeaderLabelRecord {
  id: string;
  label: string;
  allLabels?: string[];
}

export interface WalkLeadersApiResponse extends ApiResponse {
  request: any;
  response?: WalkLeaderContact[];
}

export enum WalkType {
  CIRCULAR = "Circular",
  LINEAR = "Linear"
}

export enum MapDisplay {
  SHOW_START_POINT = "show-start-point",
  SHOW_END_POINT = "show-end-point",
  SHOW_DRIVING_DIRECTIONS = "show-driving-directions"
}

export enum EventType {
  AWAITING_LEADER = "awaitingLeader",
  AWAITING_WALK_DETAILS = "awaitingWalkDetails",
  WALK_DETAILS_REQUESTED = "walkDetailsRequested",
  WALK_DETAILS_UPDATED = "walkDetailsUpdated",
  WALK_DETAILS_COPIED = "walkDetailsCopied",
  AWAITING_APPROVAL = "awaitingApproval",
  APPROVED = "approved",
  DELETED = "deleted",
  LOCATION_GEOCODED = "locationGeocoded",
  FINISH_TIME_FIXED = "finishTimeFixed",
  UNKNOWN = "unknown"
}

export interface WalkFilter {
  value: FilterCriteria;
  description: string;
  localWalkPopulationOnly?: boolean;
  selected?: boolean;
  adminOnly?: boolean;
}

export enum WalkViewMode {
  CARD = "card",
  VIEW = "view",
  VIEW_SINGLE = "view-single",
  EDIT = "edit",
  EDIT_FULL_SCREEN = "edit-full-screen",
  LIST = "list"
}

export const ID = "_id";

export enum DocumentField {
  ID = "_id",
  LAST_SYNCED_AT = "lastSyncedAt",
  RAMBLERS_ID = "ramblersId",
  SOURCE = "source",
  SYNCED_VERSION = "syncedVersion"
}

export enum GroupEventField {
  ACCESSIBILITY = "groupEvent.accessibility",
  ADDITIONAL_DETAILS = "groupEvent.additional_details",
  AREA_CODE = "groupEvent.area_code",
  ASCENT_FEET = "groupEvent.ascent_feet",
  ASCENT_METRES = "groupEvent.ascent_metres",
  CANCELLATION_REASON = "groupEvent.cancellation_reason",
  CREATED_BY = "groupEvent.created_by",
  DATE_CREATED = "groupEvent.date_created",
  DATE_UPDATED = "groupEvent.date_updated",
  DESCRIPTION = "groupEvent.description",
  DIFFICULTY = "groupEvent.difficulty",
  DISTANCE_KM = "groupEvent.distance_km",
  DISTANCE_MILES = "groupEvent.distance_miles",
  DURATION = "groupEvent.duration",
  END_DATE_TIME = "groupEvent.end_date_time",
  END_LOCATION = "groupEvent.end_location",
  EVENT_ORGANISER = "groupEvent.event_organiser",
  EVENT_ORGANISER_ID = "groupEvent.event_organiser.id",
  EVENT_ORGANISER_NAME = "groupEvent.event_organiser.name",
  EXTERNAL_URL = "groupEvent.external_url",
  FACILITIES = "groupEvent.facilities",
  GROUP_CODE = "groupEvent.group_code",
  GROUP_NAME = "groupEvent.group_name",
  ID = "groupEvent.id",
  ITEM_TYPE = "groupEvent.item_type",
  LINKED_EVENT = "groupEvent.linked_event",
  LOCATION = "groupEvent.location",
  LOCATION_DESCRIPTION = "groupEvent.location.description",
  LOCATION_GRID_REFERENCE_6 = "groupEvent.location.grid_reference_6",
  LOCATION_GRID_REFERENCE_8 = "groupEvent.location.grid_reference_8",
  LOCATION_GRID_REFERENCE_10 = "groupEvent.location.grid_reference_10",
  LOCATION_LATITUDE = "groupEvent.location.latitude",
  LOCATION_LONGITUDE = "groupEvent.location.longitude",
  LOCATION_POSTCODE = "groupEvent.location.postcode",
  MEDIA = "groupEvent.media",
  MEETING_DATE_TIME = "groupEvent.meeting_date_time",
  MEETING_LOCATION = "groupEvent.meeting_location",
  SHAPE = "groupEvent.shape",
  START_LOCATION = "groupEvent.start_location",
  START_DATE = "groupEvent.start_date_time",
  START_LOCATION_COORDINATES = "groupEvent.start_location.coordinates",
  START_LOCATION_DESCRIPTION = "groupEvent.start_location.description",
  START_LOCATION_GRID_REFERENCE_6 = "groupEvent.start_location.grid_reference_6",
  START_LOCATION_GRID_REFERENCE_8 = "groupEvent.start_location.grid_reference_8",
  START_LOCATION_GRID_REFERENCE_10 = "groupEvent.start_location.grid_reference_10",
  START_LOCATION_LATITUDE = "groupEvent.start_location.latitude",
  START_LOCATION_LONGITUDE = "groupEvent.start_location.longitude",
  START_LOCATION_NAME = "groupEvent.start_location.name",
  START_LOCATION_POSTCODE = "groupEvent.start_location.postcode",
  START_LOCATION_TOWN = "groupEvent.start_location.town",
  STATUS = "groupEvent.status",
  TITLE = "groupEvent.title",
  TRANSPORT = "groupEvent.transport",
  URL = "groupEvent.url",
  WALK_LEADER_EMAIL = "groupEvent.walk_leader.email",
  WALK_LEADER_ID = "groupEvent.walk_leader.id",
  WALK_LEADER_NAME = "groupEvent.walk_leader.name",
  WALK_LEADER_TELEPHONE = "groupEvent.walk_leader.telephone"
}

export enum EventField {
  ATTACHMENT = "fields.attachment",
  ATTENDEES = "fields.attendees",
  CONTACT_DETAILS = "fields.contactDetails",
  CONTACT_DETAILS_CONTACT_ID = "fields.contactDetails.contactId",
  CONTACT_DETAILS_DISPLAY_NAME = "fields.contactDetails.displayName",
  CONTACT_DETAILS_EMAIL = "fields.contactDetails.email",
  CONTACT_DETAILS_MEMBER_ID = "fields.contactDetails.memberId",
  CONTACT_DETAILS_PHONE = "fields.contactDetails.phone",
  GPX_FILE = "fields.gpxFile",
  GPX_FILE_AWS_FILE_NAME = "fields.gpxFile.awsFileName",
  IMAGE_CONFIG = "fields.imageConfig",
  IMAGE_CONFIG_IMPORT_FROM_AREA_CODE = "fields.imageConfig.importFrom.areaCode",
  IMAGE_CONFIG_IMPORT_FROM_FILTER_PARAMETERS_SELECT_TYPE = "fields.imageConfig.importFrom.filterParameters.selectType",
  IMAGE_CONFIG_IMPORT_FROM_GROUP_CODE = "fields.imageConfig.importFrom.groupCode",
  IMAGE_CONFIG_IMPORT_FROM_WALK_ID = "fields.imageConfig.importFrom.walkId",
  IMAGE_CONFIG_SOURCE = "fields.imageConfig.source",
  INPUT_SOURCE = "fields.inputSource",
  LINKS = "fields.links",
  MEETUP = "fields.meetup",
  MEETUP_ANNOUNCE = "fields.meetup.announce",
  MEETUP_GUEST_LIMIT = "fields.meetup.guestLimit",
  MEETUP_PUBLISH_STATUS = "fields.meetup.publishStatus",
  MIGRATED_FROM_ID = "fields.migratedFromId",
  MILES_PER_HOUR = "fields.milesPerHour",
  NOTIFICATIONS = "fields.notifications",
  PUBLISHING = "fields.publishing",
  PUBLISHING_MEETUP = "fields.publishing.meetup",
  PUBLISHING_MEETUP_PUBLISH = "fields.publishing.meetup.publish",
  PUBLISHING_RAMBLERS = "fields.publishing.ramblers",
  PUBLISHING_RAMBLERS_CONTACT_NAME = "fields.publishing.ramblers.contactName",
  PUBLISHING_RAMBLERS_PUBLISH = "fields.publishing.ramblers.publish",
  RISK_ASSESSMENT = "fields.riskAssessment",
  VENUE = "fields.venue",
  VENUE_ADDRESS1 = "fields.venue.address1",
  VENUE_ADDRESS2 = "fields.venue.address2",
  VENUE_NAME = "fields.venue.name",
  VENUE_POSTCODE = "fields.venue.postcode",
  VENUE_PUBLISH = "fields.venue.venuePublish",
  VENUE_TYPE = "fields.venue.type",
  VENUE_URL = "fields.venue.url"
}

export enum EventEventField {
  DATA = "events.data",
  DATE = "events.date",
  DESCRIPTION = "events.description",
  EVENT_TYPE = "events.eventType",
  MEMBER_ID = "events.memberId",
  NOTES = "events.notes",
  REASON = "events.reason"
}

export enum WalkCopyOption {
  COPY_SELECTED_WALK_LEADER = "copy-selected-walk-leader",
  COPY_WITH_OS_MAPS_ROUTE_SELECTED = "copy-with-os-maps-route-selected"
}

export interface CopyFrom {
  walkTemplate: ExtendedGroupEvent;
  walkTemplates: ExtendedGroupEvent[];
}

export enum WalkImportField {
  INCLUDE = "include",
  DATE = `event.${GroupEventField.START_DATE}`,
  TITLE = `event.${GroupEventField.TITLE}`,
  EVENT_WALK_LEADER = `event.${GroupEventField.WALK_LEADER_NAME}`,
  MEMBER_MATCH = "bulkLoadMemberAndMatch.memberMatch",
  MEMBER_ALLOCATION = "bulkLoadMemberAndMatch.member.displayName",
}

export const EventStartDateAscending = {[GroupEventField.START_DATE]: 1};
export const EventStartDateDescending = {[GroupEventField.START_DATE]: -1};
export interface MongoIdsSupplied {
  _id: { $in: string[] };
}

export interface EventStartDateGreaterThanOrEqualTo {
  [GroupEventField.START_DATE]: { $gte: string };
}

export interface EventStartDateLessThan {
  [GroupEventField.START_DATE]: { $lt: string };
}

export interface EventStartDateLessThanOrEqualTo {
  [GroupEventField.START_DATE]: { $lte: string };
}

export interface DisplayedWalk {
  walk: ExtendedGroupEvent;
  walkAccessMode: WalkAccessMode;
  status: EventType;
  latestEventType?: WalkEventType;
  walkLink?: string;
  ramblersLink?: string;
  showEndpoint: boolean;
  hasFeatures: boolean;
  searchableText?: string;
}

export interface LocalContact {
  id?: string;
  contactName?: string;
  email?: string;
  displayName?: string;
  telephone?: string;
}

export const INITIALISED_LOCATION: LocationDetails = {
  w3w: "",
  postcode: "",
  description: "",
  grid_reference_6: "",
  grid_reference_8: "",
  grid_reference_10: "",
  latitude: null,
  longitude: null
};

export const FALLBACK_MEDIA: BasicMedia = {
  alt: "placeholder image",
  url: "/assets/images/ramblers/placeholder-image.png"
};

export enum WalkListView {
  TABLE = "table",
  CARDS = "cards",
  MAP = "map",
}

export enum ImportType {
  EXISTING_GROUP = "existing-group",
  UNLISTED_GROUP = "unlisted-group"
}

export const IMPORT_SOURCE_MAPPING = {
  [InputSource.WALKS_MANAGER_CACHE]: {
    name: "ramblers-import-help-page",
    description: "Ramblers import help page"
  },
  [InputSource.FILE_IMPORT]: {
    name: "file-import-help-page",
    description: "File import help page"
  },
};

export enum ImportStage {
  NONE = "none",
  SAVING = "saving",
  IMPORTING = "importing",
  MATCHING = "matching",
  MATCHING_COMPLETE = "matching-complete",
}

export interface WalkImageRow {
  "Walk ID": string;
  "Image GUID": string;
  "Local Filename": string;
  "Image Order": string;
}

export interface GpxFileListItem {
  fileData: FileNameData;
  startLat: number;
  startLng: number;
  name: string;
  walkTitle?: string;
  walkDate?: number;
  uploadDate?: number;
  distance?: number;
  displayLabel?: string;
}

export interface ImportData {
  inputSource: InputSource;
  importStage: ImportStage;
  fileImportRows: Record<string, string>[];
  imageImportRows?: WalkImageRow[];
  imageFiles?: File[];
  maxImageSize?: number;
  imageUploadProgress?: number;
  bulkLoadMembersAndMatchesToWalks: BulkLoadMemberAndMatchToWalk[];
  existingWalksWithinRange: ExtendedGroupEvent[];
  messages: string[];
  errorMessages: string[];
  groupCodeAndName: HasGroupCodeAndName;
}

export interface ImportTypeOptions {
  importType: ImportType;
  existingGroupCodeAndName: HasGroupCodeAndName;
  unlistedGroupCodeAndName: HasGroupCodeAndName;
}

export interface ServerDownloadStatus {
  fileName: string;
  status: ServerDownloadStatusType;
  startTime: number;
  processId?: number;
  canOverride: boolean;
  lastActivity?: number;
}

export enum WalkExportTab {
  WALK_UPLOAD_SELECTION = "walk-upload-selection",
  WALK_UPLOAD_AUDIT = "walk-upload-audit"
}
