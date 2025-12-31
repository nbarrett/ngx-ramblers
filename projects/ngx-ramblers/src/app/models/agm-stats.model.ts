import { IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { LeaderStats } from "./group-event.model";

export interface SummaryRow {
  metric: string;
  order?: number;
  values?: Array<number | string>;
  displayValues?: Array<number | string>;
  totalForPeriod?: number;
  current: number;
  previous: number;
  changeDisplay: string;
  changeValue: number;
}

export type SortedRowsFn = <T>(rows: T[], key: string) => T[];
export type ToggleSortFn = (listKey: string, column: string) => void;
export type SortIconFn = (listKey: string, column: string) => IconDefinition | null;
export type ChangeClassFn = (current: number, previous: number) => string;
export type GetYearLabelFn = (periodLabel: string) => string;

export interface SocialRow {
  date: number;
  description: string;
  organiserName?: string;
  id?: string;
  link?: string;
  groupEvent?: {
    url?: string;
    external_url?: string;
    title?: string;
    description?: string;
    item_type?: string;
  };
}

export interface RankedLeaderRow extends LeaderStats {
  rank: number;
}

export interface PayeeRow {
  id: string;
  name: string;
  totalCost: number;
  totalItems: number;
  claimCount: number;
  items: Array<{ description: string; cost: number; paidDate: number | null }>;
}

export interface ExpenseYearStats {
  year: number;
  periodFrom: number;
  periodTo: number;
  expenses: {
    payees: PayeeRow[];
  };
}
