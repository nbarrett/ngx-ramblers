import { ApiResponse } from "./api-response.model";
import { AccessLevel } from "./member-resource.model";
import { PageContent } from "./content-text.model";

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
  contactName?: string;
}

export interface SiteSearchGroup {
  type: SiteSearchResultType;
  title: string;
  results: SiteSearchResult[];
}

export interface SiteSearchApiResponse extends ApiResponse {
  response?: SiteSearchResult[];
  indexing?: boolean;
  failed?: boolean;
  total?: number;
}

export interface SiteSearchOutcome {
  results: SiteSearchResult[];
  indexing: boolean;
  failed: boolean;
  total: number;
}

export interface SiteSearchIndexStatus {
  indexed: boolean;
  building: boolean;
  failed: boolean;
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

export interface SearchableSegment {
  text: string;
  level: AccessLevel;
}

export interface SegmentSources {
  albumCaptions: Map<string, string>;
  pagesById: Map<string, PageContent>;
}

export interface PageEntry {
  path: string;
  title: string;
  breadcrumb: string;
  segments: SearchableSegment[];
}
