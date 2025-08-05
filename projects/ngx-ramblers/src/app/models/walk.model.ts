// @ts-ignore
import mongoose from "mongoose";
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
  RamblersEventSummaryResponse
} from "./ramblers-walks-manager";
import { HasBasicEventSelection } from "./search.model";
import { Link } from "./page.model";
import { faHouse } from "@fortawesome/free-solid-svg-icons";
import { IconDefinition } from "@fortawesome/fontawesome-common-types";
import { ExtendedGroupEvent, HasGroupCodeAndName, InputSource } from "./group-event.model";
import { FilterCriteria } from "./api-request.model";
import { BulkLoadMemberAndMatchToWalk } from "./member.model";

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

export interface WalkExport {
  displayedWalk: DisplayedWalk;
  validationMessages: string[];
  publishedOnRamblers: boolean;
  publishStatus: PublishStatus;
  selected: boolean;
}


export interface WalkLeaderIdsApiResponse extends ApiResponse {
  request: any;
  response?: string[];
}

export interface WalkLeadersApiResponse extends ApiResponse {
  request: any;
  response?: Contact[];
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

export enum GroupEventField {
  CREATED_BY = "groupEvent.created_by",
  DESCRIPTION = "groupEvent.description",
  GROUP_CODE = "groupEvent.group_code",
  GROUP_NAME = "groupEvent.group_name",
  ID = "groupEvent.id",
  ITEM_TYPE = "groupEvent.item_type",
  LOCATION_DESCRIPTION = "groupEvent.location.description",
  MEDIA = "groupEvent.media",
  START_DATE = "groupEvent.start_date_time",
  TITLE = "groupEvent.title",
  URL = "groupEvent.url",
  WALK_LEADER_NAME = "groupEvent.walk_leader.name"
}

export enum EventField {
  ATTACHMENT = "fields.attachment",
  LINKS = "fields.links",
  CONTACT_DETAILS_DISPLAY_NAME = "fields.contactDetails.displayName",
  CONTACT_DETAILS_MEMBER_ID = "fields.contactDetails.memberId",
  CONTACT_DETAILS_PHONE = "fields.contactDetails.phone",
  INPUT_SOURCE = "fields.inputSource",
  MIGRATED_FROM_ID = "fields.migratedFromId",
}

export enum EventEventField {
  EVENT_TYPE = "events.eventType",
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
  _id: { $in: mongoose.Types.ObjectId[] };
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
  [InputSource.WALKS_MANAGER_IMPORT]: {
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

export interface ImportData {
  inputSource: InputSource;
  importStage: ImportStage;
  fileImportRows: Record<string, string>[];
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
