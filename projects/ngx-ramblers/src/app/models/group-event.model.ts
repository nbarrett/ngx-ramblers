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
  inputSource: InputSource;
  gpxFile?: FileNameData;
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
  itemType: RamblersEventType;
  groupCode: string;
  groupName: string,
  inputSource: InputSource;
  selected: boolean
}

export interface EditableEventStats extends EventStatsRequest, EventStats {
  edited: boolean;
  editedGroupName: string;
  editedGroupCode: string;
  editedInputSource: InputSource;
}

export interface EventStats extends EventStatsRequest {
  eventCount: number,
  minDate: Date,
  maxDate: Date,
  uniqueCreators: string[],
}

export interface AGMStatsRequest {
  fromDate: number;
  toDate: number;
}

export interface LeaderStats {
  id: string;
  name: string;
  email: string;
  walkCount: number;
  totalMiles: number;
}

export interface WalkListItem {
  id: string;
  title: string;
  startDate: number;
  walkDate: string;
  walkLeader?: string;
  distance?: number;
  url?: string;
}

export interface WalkAGMStats {
  totalWalks: number;
  confirmedWalks: number;
  morningWalks: number;
  cancelledWalks: number;
  cancelledWalksList: WalkListItem[];
  eveningWalks?: number;
  eveningWalksList: WalkListItem[];
  totalMiles: number;
  totalAttendees: number;
  activeLeaders: number;
  newLeaders: number;
  newLeadersList: LeaderStats[];
  topLeader: LeaderStats;
  allLeaders: LeaderStats[];
  unfilledSlots: number;
  unfilledSlotsList: WalkListItem[];
  morningWalksList: WalkListItem[];
}

export interface DateWithLink {
  date: number;
  description: string;
  link?: string;
  linkTitle?: string;
}

export interface OrganiserStats {
  id: string;
  name: string;
  eventCount: number;
}

export interface SocialAGMStats {
  totalSocials: number;
  socialsList: DateWithLink[];
  uniqueOrganisers: number;
  organisersList: OrganiserStats[];
}

export interface ExpenseItem {
  description: string;
  cost: number;
  paidDate: number | null;
}

export interface PayeeStats {
  id: string;
  name: string;
  totalCost: number;
  totalItems: number;
  claimCount: number;
  items: ExpenseItem[];
}

export interface UnpaidExpenseItem {
  id: string;
  claimantName: string;
  description: string;
  cost: number;
  expenseDate: number;
}

export interface ExpenseAGMStats {
  totalClaims: number;
  totalItems: number;
  totalCost: number;
  totalUnpaidCost: number;
  payees: PayeeStats[];
  unpaidExpenses: UnpaidExpenseItem[];
}

export interface MembershipAGMStats {
  totalMembers: number;
  newJoiners: number;
  leavers: number;
  deletions: number;
}

export interface YearComparison {
  year: number;
  periodFrom: number;
  periodTo: number;
  walks: WalkAGMStats;
  socials: SocialAGMStats;
  expenses: ExpenseAGMStats;
  membership: MembershipAGMStats;
}

export interface AGMStatsResponse {
  currentYear: YearComparison;
  previousYear: YearComparison | null;
  twoYearsAgo: YearComparison | null;
  earliestDate?: number;
  yearlyStats?: YearComparison[];
}

export enum InputSource {
  FILE_IMPORT = "file-import",
  WALKS_MANAGER_IMPORT = "walks-manager-import",
  URL_TO_ID_LOOKUP = "url-to-id-lookup",
  MANUALLY_CREATED = "manually-created",
  UNKNOWN = "unknown",
}
