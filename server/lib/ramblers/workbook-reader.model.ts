export type WorkbookValue = string | number | boolean | undefined;

export interface WorkbookRow {
  [columnHeading: string]: WorkbookValue;
}

export interface WorkbookExtract {
  sheetNames: string[];
  selectedSheet: string;
  matchedPreferredSheet: boolean;
  rows: WorkbookRow[];
}
