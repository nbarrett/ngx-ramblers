// @ts-ignore
import mongoose from "mongoose";
import { ApiResponse, Identifiable } from "./api-response.model";
import { MeetupConfig } from "./meetup-config.model";
import { FilterParametersSearch } from "./member-resource.model";
import { Group } from "./system.model";
import { WalkAccessMode } from "./walk-edit-mode.model";
import { WalkEventType } from "./walk-event-type.model";
import { WalkEvent } from "./walk-event.model";
import { WalkVenue } from "./walk-venue.model";
import { Contact, LocationDetails, Metadata, RamblersEventType } from "./ramblers-walks-manager";
import { HasMedia } from "./social-events.model";

export interface GoogleMapsConfig {
  apiKey: string;
  zoomLevel: number;
}

export interface ValueAndFormatted {
  value: number;
  valueAsString: string;
  formatted: string;
};

export enum DistanceUnit {
  FEET,
  KILOMETRES,
  METRES,
  MILES,
  UNKNOWN,
}

export interface WalkDistance {
  rawData: string;
  miles: ValueAndFormatted;
  kilometres: ValueAndFormatted;
  validationMessage?: string;
}

export interface WalkAscent {
  rawData: string;
  feet: ValueAndFormatted;
  metres: ValueAndFormatted;
  validationMessage?: string;
}

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
  venue?: WalkVenue;
  riskAssessment?: RiskAssessmentRecord[];
  group?: Group;
  features?: Metadata[];
  additionalDetails?: string;
  organiser?: string;
  start_location?: LocationDetails;
  meeting_location?: LocationDetails;
  end_location?: LocationDetails;
  // deprecated fields
  postcode?: string; // maps to start_location.postcode
  gridReference?: string; // maps to start_location.grid_reference_10 (e.g. TR 05559 46726)
  nearestTown?: string; // maps to start_location.description
  startLocation?: string;// maps to start_location.description if nearestTown not populated
  postcodeFinish?: string; // maps to end_location.postcode
  gridReferenceFinish?: string; // maps to end_location.grid_reference_10 (e.g. TR 05559 46726)
  startLocationW3w?: string; // maps to start_location.w3w
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
  selected: boolean;
}

export interface WalkApiResponse extends ApiResponse {
  request: any;
  response?: Walk | Walk[];
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
  value: number;
  description: string;
  localWalkPopulationOnly?: boolean;
  selected?: boolean;
  adminOnly?: boolean;
}

export enum WalkViewMode {
  VIEW = "view",
  VIEW_SINGLE = "view-single",
  EDIT = "edit",
  EDIT_FULL_SCREEN = "edit-full-screen",
  LIST = "list"
}

export const WalkDateAscending = {walkDate: 1};
export const WalkDateDescending = {walkDate: -1};

export interface MongoIdsSupplied {
  _id: { $in: mongoose.Types.ObjectId[] };
}

export interface WalkDateGreaterThanOrEqualTo {
  walkDate: { $gte: number };
}

export interface WalkDateLessThan {
  walkDate: { $lt: number };
}

export interface WalkDateLessThanOrEqualTo {
  walkDate: { $lte: number };
}

export interface WalkLocation {
  latitude: number;
  longitude: number;
}

export interface DisplayedWalk {
  walk: Walk;
  walkAccessMode: WalkAccessMode;
  status: EventType;
  latestEventType?: WalkEventType;
  walkLink?: string;
  ramblersLink?: string;
  showEndpoint: boolean;
}

export interface FilterParameters extends FilterParametersSearch {
  selectType: number;
  ascending: boolean;
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
