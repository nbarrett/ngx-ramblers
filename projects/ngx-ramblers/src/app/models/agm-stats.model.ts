import { IconDefinition } from "@fortawesome/fontawesome-common-types";
import { GroupEvent, LeaderStats, PayeeStats, YearComparison } from "./group-event.model";

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
