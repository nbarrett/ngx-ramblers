import { Member, MemberAuthAudit, MemberUpdateAudit } from "./member.model";

export const DESCENDING = "▼";
export const ASCENDING = "▲";
export const SELECT_ALL = () => true;
export const MEMBER_SORT = ["firstName", "lastName"];
export const NOT_RECEIVED_IN_LAST_RAMBLERS_BULK_LOAD = "Not received in last Ramblers Bulk Load";

export interface TableFilterItem {
  title: string;
  group?: string;
  filter: any;
}

export interface MemberTableFilter {
  sortField?: string;
  query?: any;
  sortFunction?: any;
  reverseSort?: boolean;
  sortDirection?: string;
  availableFilters?: TableFilterItem[];
  selectedFilter?: TableFilterItem;
  results: Member[];
}

export interface MemberUpdateAuditTableFilter {
  sortField?: string;
  query?: any;
  sortFunction?: any;
  reverseSort?: boolean;
  sortDirection?: string;
  availableFilters?: TableFilterItem[];
  selectedFilter?: TableFilterItem;
  results: MemberUpdateAudit[];
}

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
