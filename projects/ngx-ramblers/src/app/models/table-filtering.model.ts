import { Member, MemberAuthAudit, MemberBulkLoadUploadedRow, MemberUpdateAuditRow } from "./member.model";

export const DESCENDING = "▼";
export const ASCENDING = "▲";
export const SELECT_ALL = () => true;
export const ALL_MEMBERS_FILTER_TITLE = "All Members";
export const MEMBER_SORT = ["firstName", "lastName"];
export const NOT_RECEIVED_IN_LAST_RAMBLERS_BULK_LOAD = "Not received in last Ramblers Bulk Load";

export interface TableFilterItem {
  title: string;
  group?: string;
  filter: any;
}

export interface MemberTableFilter<T = Member> {
  sortField?: string;
  query?: any;
  sortFunction?: any;
  reverseSort?: boolean;
  sortDirection?: string;
  availableFilters?: TableFilterItem[];
  selectedFilter?: TableFilterItem;
  results: T[];
}

export interface MemberUpdateAuditTableFilter {
  sortField?: string;
  query?: any;
  sortFunction?: any;
  reverseSort?: boolean;
  sortDirection?: string;
  availableFilters?: TableFilterItem[];
  selectedFilter?: TableFilterItem;
  results: MemberUpdateAuditRow[];
}

export type MemberBulkLoadUploadedTableFilter = MemberTableFilter<MemberBulkLoadUploadedRow>;

export interface MemberAuthAuditTableFilter {
  sortField?: string;
  query?: any;
  sortFunction?: any;
  reverseSort?: boolean;
  sortDirection?: string;
  availableFilters?: TableFilterItem[];
  selectedFilter?: TableFilterItem;
  results: MemberAuthAudit[];
}
