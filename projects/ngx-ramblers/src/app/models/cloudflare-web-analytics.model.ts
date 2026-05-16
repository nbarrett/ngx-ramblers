export interface CloudflareRumSite {
  site_tag: string;
  site_token: string;
  created: string;
  host?: string;
  snippet?: string;
  auto_install: boolean;
  ruleset?: {
    id: string;
    enabled: boolean;
    zone_tag: string;
    zone_name: string;
  };
  rules?: { id?: string; host: string; paths: string[]; inclusive: boolean; is_paused: boolean }[];
}

export interface CreateRumSiteRequest {
  host: string;
  autoInstall?: boolean;
}

export interface CloudflareWebAnalyticsTotals {
  pageViews: number;
  visits: number;
}

export interface CloudflareWebAnalyticsTimeseriesPoint {
  datetime: string;
  pageViews: number;
  visits: number;
}

export interface CloudflareWebAnalyticsBreakdownEntry {
  key: string;
  pageViews: number;
  visits: number;
}

export enum WebVitalMetric {
  LCP = "LCP",
  INP = "INP",
  CLS = "CLS",
  FID = "FID",
  FCP = "FCP",
  TTFB = "TTFB",
}

export interface CloudflareWebAnalyticsWebVitalsEntry {
  metric: WebVitalMetric;
  good: number;
  needsImprovement: number;
  poor: number;
}

export interface CloudflareWebAnalyticsRequest {
  siteTag: string;
  startDate: string;
  endDate: string;
  limit?: number;
}

export interface CloudflareWebAnalyticsSummary {
  totals: CloudflareWebAnalyticsTotals;
  timeseries: CloudflareWebAnalyticsTimeseriesPoint[];
  topPaths: CloudflareWebAnalyticsBreakdownEntry[];
  topCountries: CloudflareWebAnalyticsBreakdownEntry[];
  topReferrers: CloudflareWebAnalyticsBreakdownEntry[];
  deviceTypes: CloudflareWebAnalyticsBreakdownEntry[];
  browsers: CloudflareWebAnalyticsBreakdownEntry[];
  webVitals: CloudflareWebAnalyticsWebVitalsEntry[];
}
