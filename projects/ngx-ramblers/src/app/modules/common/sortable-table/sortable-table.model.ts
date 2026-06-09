export enum SortableTableAlignment {
  LEFT = "left",
  CENTER = "center",
  RIGHT = "right"
}

export interface SortableTableColumn<T = any> {
  key: string;
  label: string;
  sortKey?: string;
  align?: SortableTableAlignment;
  cellGetter?: (row: T) => any;
  headerClass?: string;
  cellClass?: string;
}

export interface SortableTableSortState {
  key: string | null;
  direction: string;
}

export interface SortableTableGroup<T = any> {
  key: string;
  rows: T[];
}
