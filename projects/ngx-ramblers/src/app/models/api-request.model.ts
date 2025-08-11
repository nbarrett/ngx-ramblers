export interface ApiRequest {
  parameters: object;
  url: string;
  body: object;
}

export interface MongoCriteria {
  [field: string]: any;
}

export interface DataQueryOptions {
  limit?: number;
  criteria?: any;
  select?: any;
  sort?: any;
  update?: any;
}

export interface MongoId {
  _id: string;
}

export enum SortOrder {
  DATE_ASCENDING = "DATE_ASCENDING",
  DATE_DESCENDING = "DATE_DESCENDING",
  CHOOSE = "CHOOSE",
}

export enum FilterCriteria {
  FUTURE_EVENTS = "FUTURE_EVENTS",
  PAST_EVENTS = "PAST_EVENTS",
  ALL_EVENTS = "ALL_EVENTS",
  DATE_RANGE = "DATE_RANGE",
  NO_CONTACT_DETAILS = "NO_CONTACT_DETAILS",
  NO_EVENT_TITLE = "NO_EVENT_TITLE",
  DELETED_EVENTS = "DELETED_EVENTS",
  CHOOSE = "CHOOSE",
}

export const BASIC_FILTER_OPTIONS: FilterCriteria[] = [FilterCriteria.FUTURE_EVENTS, FilterCriteria.PAST_EVENTS, FilterCriteria.ALL_EVENTS];
export const DYNAMIC_CONTENT_FILTER_OPTIONS: FilterCriteria[] = [FilterCriteria.DATE_RANGE].concat(BASIC_FILTER_OPTIONS).concat(FilterCriteria.CHOOSE);
