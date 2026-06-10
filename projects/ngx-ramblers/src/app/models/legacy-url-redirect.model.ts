import { ApiResponse, Identifiable } from "./api-response.model";

export enum RedirectConfidence {
  HIGH = "high",
  MEDIUM = "medium",
  LOW = "low",
  UNMAPPED = "unmapped"
}

export enum RedirectMappingStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  REJECTED = "rejected",
  IGNORED = "ignored"
}

export enum RedirectMatchMethod {
  SLUG = "slug",
  TITLE = "title",
  PATTERN = "pattern",
  WALK_URL = "walk-url",
  MANUAL = "manual"
}

export enum SortDirection {
  ASC = "asc",
  DESC = "desc"
}

export interface LegacyUrlMapping extends Identifiable {
  legacyDomain: string;
  legacyPath: string;
  legacyFragment?: string;
  legacyFullUrl: string;
  title?: string;
  httpStatus?: number;
  contentType?: string;
  lastModified?: string;
  targetPath?: string;
  confidence: RedirectConfidence;
  matchMethod?: RedirectMatchMethod;
  status: RedirectMappingStatus;
  redirectType: number;
  hitCount: number;
  lastHitDate?: number;
  createdDate: number;
  updatedDate: number;
  updatedBy?: string;
  scrapeBatchId?: string;
}

export interface LegacyUrlMappingApiResponse extends ApiResponse {
  response: LegacyUrlMapping | LegacyUrlMapping[];
}

export interface LegacyScrapeAuditLog {
  time: number;
  status: string;
  message: string;
}

export interface LegacyScrapeRun extends Identifiable {
  legacyDomain: string;
  startedDate: number;
  completedDate?: number;
  status: string;
  urlsDiscovered: number;
  urlsMapped: number;
  urlsUnmapped: number;
  auditLog: LegacyScrapeAuditLog[];
}

export interface LegacyScrapeRunApiResponse extends ApiResponse {
  response: LegacyScrapeRun | LegacyScrapeRun[];
}

export interface LegacyRedirectSummary {
  total: number;
  byConfidence: Record<RedirectConfidence, number>;
  byStatus: Record<RedirectMappingStatus, number>;
}

export interface LegacyRedirectConfig {
  legacyDomains: string[];
  cacheRefreshMinutes: number;
  hitFlushIntervalSeconds: number;
}

export interface BulkStatusUpdateRequest {
  ids: string[];
  status: RedirectMappingStatus;
}

export interface BulkDeleteRequest {
  ids: string[];
}

export interface AutoMapRequest {
  legacyDomain: string;
}

export interface AutoMapResult {
  total: number;
  high: number;
  medium: number;
  low: number;
  unmapped: number;
}

export interface LegacyScrapeRequest {
  legacyDomain: string;
  respectRobotsTxt?: boolean;
  maxPages?: number;
  delayMs?: number;
}
