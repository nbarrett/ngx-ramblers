import { ApiResponse } from "./api-response.model";

export enum SiteSearchResultType {
  PAGE = "page",
  WALK = "walk",
  EVENT = "event"
}

export enum SiteSearchRelevance {
  HIGH = "high",
  MEDIUM = "medium",
  LOW = "low"
}

export interface SiteSearchResult {
  type: SiteSearchResultType;
  title: string;
  path: string;
  breadcrumb: string;
  excerpt: string;
  score: number;
  relevance: SiteSearchRelevance;
  matchedIn: string;
  date?: string;
}

export interface SiteSearchGroup {
  type: SiteSearchResultType;
  title: string;
  results: SiteSearchResult[];
}

export interface SiteSearchApiResponse extends ApiResponse {
  response?: SiteSearchResult[];
  indexing?: boolean;
  total?: number;
}

export interface SiteSearchOutcome {
  results: SiteSearchResult[];
  indexing: boolean;
  total: number;
}

export interface SiteSearchIndexStatus {
  indexed: boolean;
  building: boolean;
  pages: number;
  events: number;
  builtAtMillis: number | null;
  ageMinutes: number | null;
  ttlMinutes: number;
}

export interface SiteSearchIndexStatusApiResponse extends ApiResponse {
  response?: SiteSearchIndexStatus;
}

export interface SiteMapPagesApiResponse extends ApiResponse {
  response?: string[];
  indexing?: boolean;
}

export interface SiteMapPagesOutcome {
  paths: string[];
  indexing: boolean;
}
