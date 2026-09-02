import { IconDefinition } from "@fortawesome/fontawesome-common-types";
import { DateRangeSliderPreset } from "./date.model";
import { GroupEvent, LeaderStats, PayeeStats, YearComparison } from "./group-event.model";
import { DateDirection } from "./search.model";

export enum AgmChartType {
  BAR = "bar",
  LINE = "line"
}

export enum AgmStatsSection {
  WALKS = "walks",
  SOCIALS = "socials",
  EXPENSES = "expenses",
  MEMBERSHIP = "membership"
}

export enum AgmStatsPreset {
  CUSTOM = "custom",
  SINCE_COMMITTEE_EVENT = "since-committee-event",
  BETWEEN_COMMITTEE_EVENTS = "between-committee-events",
  LAST_1_YEAR = "last-1-year",
  LAST_2_YEARS = "last-2-years",
  LAST_3_YEARS = "last-3-years",
  LAST_4_YEARS = "last-4-years",
  LAST_5_YEARS = "last-5-years",
  ALL_TIME = "all-time"
}

export const AGM_STATS_DATE_RANGE_PRESETS: DateRangeSliderPreset[] = [
  {id: AgmStatsPreset.LAST_1_YEAR, label: "Last 1 year", groupLabel: "Reporting period", relativeDateRange: {direction: DateDirection.PAST, duration: {years: 1}}},
  {id: AgmStatsPreset.LAST_2_YEARS, label: "Last 2 years", groupLabel: "Reporting period", relativeDateRange: {direction: DateDirection.PAST, duration: {years: 2}}},
  {id: AgmStatsPreset.LAST_3_YEARS, label: "Last 3 years", groupLabel: "Reporting period", relativeDateRange: {direction: DateDirection.PAST, duration: {years: 3}}},
  {id: AgmStatsPreset.LAST_4_YEARS, label: "Last 4 years", groupLabel: "Reporting period", relativeDateRange: {direction: DateDirection.PAST, duration: {years: 4}}},
  {id: AgmStatsPreset.LAST_5_YEARS, label: "Last 5 years", groupLabel: "Reporting period", relativeDateRange: {direction: DateDirection.PAST, duration: {years: 5}}},
  {id: AgmStatsPreset.ALL_TIME, label: "All time", groupLabel: "Reporting period"},
  {id: AgmStatsPreset.SINCE_COMMITTEE_EVENT, label: "Since a committee event", groupLabel: "Committee events"},
  {id: AgmStatsPreset.BETWEEN_COMMITTEE_EVENTS, label: "Between committee events", groupLabel: "Committee events"}
];

export enum AGMStatsTab {
  WALKS = "Walks",
  SOCIALS = "Socials",
  MEMBERSHIP = "Membership",
  EXPENSES = "Expenses"
}

export interface CommitteeStatisticsEvent {
  date: number;
  label: string;
}

export enum AgmStatsEmailSection {
  WALKS = "walks",
  SOCIALS = "socials",
  MEMBERSHIP = "membership",
  EXPENSES = "expenses"
}

export interface AgmStatsEmailSectionOption {
  key: AgmStatsEmailSection;
  label: string;
}

export const AGM_STATS_EMAIL_SECTION_OPTIONS: AgmStatsEmailSectionOption[] = [
  {key: AgmStatsEmailSection.WALKS, label: "Walks"},
  {key: AgmStatsEmailSection.SOCIALS, label: "Socials"},
  {key: AgmStatsEmailSection.MEMBERSHIP, label: "Membership"},
  {key: AgmStatsEmailSection.EXPENSES, label: "Expenses"}
];

export const AGM_STATS_CURRENCY_METRICS = ["Total Cost", "Total Paid", "Total Unpaid"];

export interface AgmStatsExcelExportRequest {
  fileName: string;
  data: AgmStatsEmailData;
}

export interface AgmStatsEmailData {
  fromDateLabel: string;
  toDateLabel: string;
  periodLabels: string[];
  summaries: Record<AgmStatsEmailSection, SummaryRow[]>;
}

export interface SummaryRow {
  metric: string;
  values: number[];
  order?: number;
  previous?: number;
  current?: number;
  changeValue?: number;
  changeDisplay?: string;
  displayValues?: number[];
  totalForPeriod?: number;
}

export interface SocialRow {
  id?: string;
  date: number;
  description: string;
  organiserName?: string;
  link?: string;
  linkTitle?: string;
  groupEvent?: Partial<GroupEvent>;
}

export interface RankedLeaderRow extends LeaderStats {
  rank: number;
}

export type SortedRowsFn = <T>(rows: T[], key: string) => T[];
export type ToggleSortFn = (listKey: string, column: string) => void;
export type SortIconFn = (listKey: string, column: string) => IconDefinition | null;
export type ChangeClassFn = (current: number, previous: number) => string;
export type GetYearLabelFn = (periodLabel: string) => string;

export type PayeeRow = PayeeStats;
export interface ExpenseYearStats extends YearComparison {}
