import { DateTime } from "luxon";
import { EventSource, ExtendedGroupEvent } from "./group-event.model";
import { WalksAdminSegment, WALKS_LEADER_SEGMENT } from "./walks-route-paths.model";
import { LinkSource } from "./walk.model";

export enum ProgrammeOverviewStatus {
  AWAITING_LEADER = "awaitingLeader",
  AWAITING_WALK_DETAILS = "awaitingWalkDetails",
  AWAITING_APPROVAL = "awaitingApproval",
  APPROVED = "approved",
  DRAFT = "draft",
  PUBLISHED = "publishedToRamblers",
  CANCELLED = "cancelled"
}

export type ProgrammeStatusCounts = Partial<Record<ProgrammeOverviewStatus, number>>;

export enum ProgrammeSortDirection {
  ASC = "asc",
  DESC = "desc"
}

export interface ProgrammeStatusDescriptor {
  status: ProgrammeOverviewStatus;
  title: string;
  shortTitle: string;
  colour: string;
  textColour: string;
  actionable: boolean;
  localPopulationOnly: boolean;
  walksManagerOnly?: boolean;
}

export interface WalkProgrammeSummaryRow {
  id: string;
  status: ProgrammeOverviewStatus;
  startDateTime: string;
  title: string;
  url: string;
  distanceMiles: number;
  gradeCode: string;
  gradeDescription: string;
  shape: string;
  leaderName: string;
  leaderMemberId: string;
  hasLocation: boolean;
  itemType: string;
  groupCode: string;
  groupName: string;
  thumbnailUrl: string;
}

export interface WalkProgrammeSummaryPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface WalkProgrammeSummaryResponse {
  counts: ProgrammeStatusCounts;
  response: WalkProgrammeSummaryRow[];
  pagination: WalkProgrammeSummaryPagination;
}

export interface WalkProgrammeSummaryRequest {
  dateFrom: number;
  dateTo: number;
  status?: ProgrammeOverviewStatus;
  page?: number;
  limit?: number;
  sortDirection?: ProgrammeSortDirection;
}

export enum CalendarViewMode {
  MONTH = "month",
  WEEK = "week"
}

export interface CalendarDay {
  value: number;
  dayOfMonth: number;
  inCurrentPeriod: boolean;
  isToday: boolean;
  isWeekend: boolean;
  entries: CalendarEntry[];
}

export interface CalendarWeek {
  label: string;
  walkCount: number;
  days: CalendarDay[];
}

export interface CalendarEntry {
  id: string;
  displayedWalk: import("./walk.model").DisplayedWalk;
  isGroupEvent: boolean;
  colour: string;
  title: string;
  time: string;
  dateValue: number;
}

export const PROGRAMME_STATUS_DESCRIPTORS: ProgrammeStatusDescriptor[] = [
  {
    status: ProgrammeOverviewStatus.AWAITING_LEADER,
    title: "Awaiting Leader",
    shortTitle: "No leader",
    colour: "rgb(246, 176, 157)",
    textColour: "rgb(64, 65, 65)",
    actionable: true,
    localPopulationOnly: true
  },
  {
    status: ProgrammeOverviewStatus.AWAITING_WALK_DETAILS,
    title: "Awaiting Walk Details",
    shortTitle: "No details",
    colour: "rgb(240, 128, 80)",
    textColour: "#ffffff",
    actionable: true,
    localPopulationOnly: true
  },
  {
    status: ProgrammeOverviewStatus.AWAITING_APPROVAL,
    title: "Awaiting Approval",
    shortTitle: "To approve",
    colour: "rgb(249, 177, 4)",
    textColour: "rgb(64, 65, 65)",
    actionable: true,
    localPopulationOnly: true
  },
  {
    status: ProgrammeOverviewStatus.APPROVED,
    title: "Approved",
    shortTitle: "Approved",
    colour: "rgb(155, 200, 171)",
    textColour: "rgb(64, 65, 65)",
    actionable: true,
    localPopulationOnly: true
  },
  {
    status: ProgrammeOverviewStatus.DRAFT,
    title: "Draft",
    shortTitle: "Draft",
    colour: "rgb(120, 148, 196)",
    textColour: "#ffffff",
    actionable: true,
    localPopulationOnly: false,
    walksManagerOnly: true
  },
  {
    status: ProgrammeOverviewStatus.PUBLISHED,
    title: "Published",
    shortTitle: "Published",
    colour: "rgb(0, 151, 164)",
    textColour: "#ffffff",
    actionable: false,
    localPopulationOnly: false
  },
  {
    status: ProgrammeOverviewStatus.CANCELLED,
    title: "Cancelled",
    shortTitle: "Cancelled",
    colour: "rgb(153, 153, 153)",
    textColour: "#ffffff",
    actionable: false,
    localPopulationOnly: false
  }
];

export function programmeStatusDescriptor(status: ProgrammeOverviewStatus): ProgrammeStatusDescriptor {
  return PROGRAMME_STATUS_DESCRIPTORS.find(descriptor => descriptor.status === status)
    || PROGRAMME_STATUS_DESCRIPTORS.find(descriptor => descriptor.status === ProgrammeOverviewStatus.APPROVED);
}

export function programmeStatusDescriptorsFor(walksManagerPopulation: boolean): ProgrammeStatusDescriptor[] {
  return PROGRAMME_STATUS_DESCRIPTORS.filter(descriptor => walksManagerPopulation
    ? !descriptor.localPopulationOnly
    : !descriptor.walksManagerOnly);
}

export const GROUP_EVENT_CALENDAR_COLOUR = "rgb(133, 173, 146)";

export function hasRamblersPublicationIdentity(extendedGroupEvent: ExtendedGroupEvent): boolean {
  const ramblersId = extendedGroupEvent?.groupEvent?.id?.trim();
  const eventUrl = extendedGroupEvent?.groupEvent?.url?.trim();
  const hasRamblersUrl = /^https?:\/\/(?:www\.)?ramblers\.org\.uk\//i.test(eventUrl || "")
    || (extendedGroupEvent?.fields?.links || []).some(link => link.source === LinkSource.RAMBLERS && !!link.href?.trim());
  return !!ramblersId && hasRamblersUrl;
}

export function displayedWalkProgrammeStatus(extendedGroupEvent: ExtendedGroupEvent, derivedEventStatus: string): ProgrammeOverviewStatus {
  const ramblersStatus = (extendedGroupEvent?.groupEvent?.status || "").toLowerCase();
  const walksManagerSourced = extendedGroupEvent?.source === EventSource.WALKS_MANAGER;
  if (ramblersStatus === ProgrammeOverviewStatus.CANCELLED) {
    return ProgrammeOverviewStatus.CANCELLED;
  } else if (derivedEventStatus === ProgrammeOverviewStatus.PUBLISHED || hasRamblersPublicationIdentity(extendedGroupEvent)) {
    return ProgrammeOverviewStatus.PUBLISHED;
  } else if (walksManagerSourced && ramblersStatus === ProgrammeOverviewStatus.DRAFT) {
    return ProgrammeOverviewStatus.DRAFT;
  } else if (walksManagerSourced) {
    return ProgrammeOverviewStatus.PUBLISHED;
  } else {
    const match = PROGRAMME_STATUS_DESCRIPTORS.find(descriptor => descriptor.status === derivedEventStatus);
    return match ? match.status : ProgrammeOverviewStatus.APPROVED;
  }
}

export enum ProgrammeViewKey {
  OVERVIEW = "overview",
  CALENDAR = "calendar",
  MAP = "map",
  LEADER = "leader"
}

export interface ProgrammeView {
  view: ProgrammeViewKey;
  segment: string;
  label: string;
}

export const PROGRAMME_VIEWS: ProgrammeView[] = [
  {view: ProgrammeViewKey.OVERVIEW, segment: WalksAdminSegment.PROGRAMME, label: "Overview"},
  {view: ProgrammeViewKey.CALENDAR, segment: WalksAdminSegment.CALENDAR, label: "Calendar"},
  {view: ProgrammeViewKey.MAP, segment: WalksAdminSegment.MAP, label: "Map"},
  {view: ProgrammeViewKey.LEADER, segment: WALKS_LEADER_SEGMENT, label: "My Walks"}
];

export interface DateRangeBounds {
  minDate: DateTime;
  maxDate: DateTime;
}
