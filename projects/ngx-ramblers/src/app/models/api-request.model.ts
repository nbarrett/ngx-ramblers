export interface ApiRequest {
  parameters?: object;
  url?: string;
  body?: object;
}

export interface DataQueryOptions {
  limit?: number;
  criteria?: object;
  select?: object;
  sort?: object;
}

export interface MongoId {
  _id: string;
}

export enum DateCriteria {
  CURRENT_OR_FUTURE_DATES = 1,
  PAST_DATES = 2,
  ALL_DATES = 3
}
