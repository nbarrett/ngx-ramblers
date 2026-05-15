import debug from "debug";
import { startCase } from "es-toolkit/compat";
import { CloudflareConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import {
  EmailRoutingLogEntry,
  EmailRoutingLogsRequest,
  WorkerInvocationSummary,
  WorkerLogsRequest
} from "../../../projects/ngx-ramblers/src/app/models/cloudflare-email-routing.model";
import {
  CloudflareWebAnalyticsBreakdownEntry,
  CloudflareWebAnalyticsRequest,
  CloudflareWebAnalyticsSummary,
  CloudflareWebAnalyticsTimeseriesPoint,
  CloudflareWebAnalyticsWebVitalsEntry,
  WebVitalMetric
} from "../../../projects/ngx-ramblers/src/app/models/cloudflare-web-analytics.model";
import { envConfig } from "../env-config/env-config";
import { cloudflareApi } from "./cloudflare.model";

const debugLog = debug(envConfig.logNamespace("cloudflare:analytics"));
debugLog.enabled = true;
const errorDebugLog = debug("ERROR:" + envConfig.logNamespace("cloudflare:analytics"));
errorDebugLog.enabled = true;

const GRAPHQL_URL = cloudflareApi.graphql();

function humaniseStatus(status: string): string {
  if (!status) {
    return "";
  }
  return startCase(status);
}

function headers(apiToken: string): Record<string, string> {
  return {
    "Authorization": `Bearer ${apiToken}`,
    "Content-Type": "application/json"
  };
}

interface GraphQLResponse<T> {
  data: T;
  errors?: { message: string }[];
}

interface EmailRoutingGraphQLData {
  viewer: {
    zones: {
      emailRoutingAdaptive: {
        datetime: string;
        sessionId: string;
        from: string;
        to: string;
        subject: string;
        status: string;
        spf: string;
        dkim: string;
        dmarc: string;
        errorDetail: string;
      }[];
    }[];
  };
}

interface WorkerInvocationsGraphQLData {
  viewer: {
    accounts: {
      workersInvocationsAdaptive: {
        sum: {
          requests: number;
          errors: number;
          subrequests: number;
        };
        dimensions: {
          datetime: string;
          scriptName: string;
          status: string;
        };
      }[];
    }[];
  };
}

export async function queryEmailRoutingLogs(cloudflareConfig: CloudflareConfig, request: EmailRoutingLogsRequest): Promise<EmailRoutingLogEntry[]> {
  const limit = request.limit || 100;
  const filterParts = [
    `datetime_geq: "${request.startDate}"`,
    `datetime_leq: "${request.endDate}"`
  ];
  if (request.recipientEmail) {
    filterParts.push(`to: "${request.recipientEmail}"`);
  }

  const query = `query {
  viewer {
    zones(filter: {zoneTag: "${cloudflareConfig.zoneId}"}) {
      emailRoutingAdaptive(
        limit: ${limit},
        filter: {${filterParts.join(", ")}},
        orderBy: [datetime_DESC]
      ) {
        datetime
        sessionId
        from
        to
        subject
        status
        spf
        dkim
        dmarc
        errorDetail
      }
    }
  }
}`;

  debugLog("Querying email routing logs with filter:", filterParts.join(", "));

  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: headers(cloudflareConfig.apiToken),
    body: JSON.stringify({query})
  });

  const data: GraphQLResponse<EmailRoutingGraphQLData> = await response.json();
  debugLog("Email routing logs response status: %d, has errors: %s", response.status, !!(data.errors?.length));

  if (data.errors?.length) {
    const errorMsg = data.errors.map(e => e.message).join(", ");
    errorDebugLog("Failed to query email routing logs: %s, full response: %o", errorMsg, data);
    throw new Error(`Failed to query email routing logs: ${errorMsg}`);
  }

  if (!data.data) {
    errorDebugLog("Email routing logs response has no data field. Full response: %o", data);
    throw new Error("Email routing logs response has no data field");
  }

  const zones = data.data?.viewer?.zones || [];
  const entries = zones[0]?.emailRoutingAdaptive || [];
  debugLog("Found %d email routing log entries", entries.length);

  return entries.map(entry => ({
    datetime: entry.datetime,
    sessionId: entry.sessionId,
    from: entry.from,
    to: entry.to,
    subject: entry.subject,
    status: humaniseStatus(entry.status),
    spf: entry.spf,
    dkim: entry.dkim,
    dmarc: entry.dmarc,
    errorDetail: entry.errorDetail
  }));
}

export async function queryWorkerInvocationLogs(cloudflareConfig: CloudflareConfig, request: WorkerLogsRequest): Promise<WorkerInvocationSummary[]> {
  const limit = request.limit || 100;
  const filterParts = [
    `datetime_geq: "${request.startDate}"`,
    `datetime_leq: "${request.endDate}"`
  ];
  if (request.scriptName) {
    filterParts.push(`scriptName: "${request.scriptName}"`);
  }

  const query = `query {
  viewer {
    accounts(filter: {accountTag: "${cloudflareConfig.accountId}"}) {
      workersInvocationsAdaptive(
        limit: ${limit},
        filter: {${filterParts.join(", ")}},
        orderBy: [datetime_DESC]
      ) {
        sum {
          requests
          errors
          subrequests
        }
        dimensions {
          datetime
          scriptName
          status
        }
      }
    }
  }
}`;

  debugLog("Querying worker invocation logs with filter:", filterParts.join(", "));

  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: headers(cloudflareConfig.apiToken),
    body: JSON.stringify({query})
  });

  const data: GraphQLResponse<WorkerInvocationsGraphQLData> = await response.json();
  debugLog("Worker invocation logs response status: %d, has errors: %s", response.status, !!(data.errors?.length));

  if (data.errors?.length) {
    const errorMsg = data.errors.map(e => e.message).join(", ");
    errorDebugLog("Failed to query worker invocation logs: %s, full response: %o", errorMsg, data);
    throw new Error(`Failed to query worker invocation logs: ${errorMsg}`);
  }

  if (!data.data) {
    errorDebugLog("Worker invocation logs response has no data field. Full response: %o", data);
    throw new Error("Worker invocation logs response has no data field");
  }

  const accounts = data.data?.viewer?.accounts || [];
  const invocations = accounts[0]?.workersInvocationsAdaptive || [];
  debugLog("Found %d worker invocation entries", invocations.length);

  return invocations.map(entry => ({
    datetime: entry.dimensions.datetime,
    scriptName: entry.dimensions.scriptName,
    status: entry.dimensions.status,
    requests: entry.sum.requests,
    errors: entry.sum.errors,
    subrequests: entry.sum.subrequests
  }));
}

interface RumGroupRow<D> {
  count: number;
  sum: { visits: number };
  dimensions: D;
}

interface WebAnalyticsGraphQLData {
  viewer: {
    accounts: {
      totals: RumGroupRow<Record<string, never>>[];
      timeseries: RumGroupRow<{ ts: string }>[];
      paths: RumGroupRow<{ requestPath: string }>[];
      countries: RumGroupRow<{ countryName: string }>[];
      referrers: RumGroupRow<{ refererHost: string }>[];
      devices: RumGroupRow<{ deviceType: string }>[];
      browsers: RumGroupRow<{ userAgentBrowser: string }>[];
      webVitals: { sum: Record<string, number> }[];
    }[];
  };
}

function chooseTimeBucket(startDate: string, endDate: string): string {
  const start = Date.parse(startDate);
  const end = Date.parse(endDate);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return "datetimeHour";
  }
  const rangeHours = (end - start) / (1000 * 60 * 60);
  if (rangeHours <= 2) {
    return "datetimeFiveMinutes";
  }
  if (rangeHours <= 24) {
    return "datetimeFifteenMinutes";
  }
  if (rangeHours <= 24 * 7) {
    return "datetimeHour";
  }
  return "date";
}

function toBreakdown<D>(
  rows: RumGroupRow<D>[],
  keyExtractor: (dimensions: D) => string,
  fallback = "(unknown)"
): CloudflareWebAnalyticsBreakdownEntry[] {
  return rows.map(row => ({
    key: keyExtractor(row.dimensions) || fallback,
    pageViews: row.count || 0,
    visits: row.sum?.visits || 0
  }));
}

const webVitalMetrics: { metric: WebVitalMetric; prefix: string }[] = [
  {metric: WebVitalMetric.LCP, prefix: "lcp"},
  {metric: WebVitalMetric.INP, prefix: "inp"},
  {metric: WebVitalMetric.CLS, prefix: "cls"},
  {metric: WebVitalMetric.FID, prefix: "fid"},
  {metric: WebVitalMetric.FCP, prefix: "fcp"},
  {metric: WebVitalMetric.TTFB, prefix: "ttfb"}
];

function toWebVitals(rows: { sum: Record<string, number> }[]): CloudflareWebAnalyticsWebVitalsEntry[] {
  const sum = rows[0]?.sum;
  if (!sum) {
    return [];
  }
  return webVitalMetrics
    .map(({metric, prefix}) => ({
      metric,
      good: sum[`${prefix}Good`] || 0,
      needsImprovement: sum[`${prefix}NeedsImprovement`] || 0,
      poor: sum[`${prefix}Poor`] || 0
    }))
    .filter(entry => entry.good + entry.needsImprovement + entry.poor > 0);
}

export async function queryWebAnalyticsSummary(cloudflareConfig: CloudflareConfig, request: CloudflareWebAnalyticsRequest): Promise<CloudflareWebAnalyticsSummary> {
  const limit = request.limit || 10;
  const timeBucket = chooseTimeBucket(request.startDate, request.endDate);
  const filterParts = [
    `datetime_geq: "${request.startDate}"`,
    `datetime_leq: "${request.endDate}"`,
    `siteTag: "${request.siteTag}"`
  ];
  const filter = `{${filterParts.join(", ")}}`;

  const query = `query {
  viewer {
    accounts(filter: {accountTag: "${cloudflareConfig.accountId}"}) {
      totals: rumPageloadEventsAdaptiveGroups(limit: 1, filter: ${filter}) {
        count
        sum { visits }
      }
      timeseries: rumPageloadEventsAdaptiveGroups(limit: 500, filter: ${filter}, orderBy: [${timeBucket}_ASC]) {
        count
        sum { visits }
        dimensions { ts: ${timeBucket} }
      }
      paths: rumPageloadEventsAdaptiveGroups(limit: ${limit}, filter: ${filter}, orderBy: [count_DESC]) {
        count
        sum { visits }
        dimensions { requestPath }
      }
      countries: rumPageloadEventsAdaptiveGroups(limit: ${limit}, filter: ${filter}, orderBy: [count_DESC]) {
        count
        sum { visits }
        dimensions { countryName }
      }
      referrers: rumPageloadEventsAdaptiveGroups(limit: ${limit}, filter: ${filter}, orderBy: [count_DESC]) {
        count
        sum { visits }
        dimensions { refererHost }
      }
      devices: rumPageloadEventsAdaptiveGroups(limit: ${limit}, filter: ${filter}, orderBy: [count_DESC]) {
        count
        sum { visits }
        dimensions { deviceType }
      }
      browsers: rumPageloadEventsAdaptiveGroups(limit: ${limit}, filter: ${filter}, orderBy: [count_DESC]) {
        count
        sum { visits }
        dimensions { userAgentBrowser }
      }
      webVitals: rumWebVitalsEventsAdaptiveGroups(limit: 1, filter: ${filter}) {
        sum {
          lcpGood lcpNeedsImprovement lcpPoor
          inpGood inpNeedsImprovement inpPoor
          clsGood clsNeedsImprovement clsPoor
          fidGood fidNeedsImprovement fidPoor
          fcpGood fcpNeedsImprovement fcpPoor
          ttfbGood ttfbNeedsImprovement ttfbPoor
        }
      }
    }
  }
}`;

  debugLog("Querying web analytics summary for siteTag=%s range=%s..%s bucket=%s", request.siteTag, request.startDate, request.endDate, timeBucket);

  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: headers(cloudflareConfig.apiToken),
    body: JSON.stringify({query})
  });

  const data: GraphQLResponse<WebAnalyticsGraphQLData> = await response.json();
  debugLog("Web analytics response status: %d, has errors: %s", response.status, !!(data.errors?.length));

  if (data.errors?.length) {
    const errorMsg = data.errors.map(e => e.message).join(", ");
    errorDebugLog("Failed to query web analytics: %s, full response: %o", errorMsg, data);
    throw new Error(`Failed to query web analytics: ${errorMsg}`);
  }

  if (!data.data) {
    errorDebugLog("Web analytics response has no data field. Full response: %o", data);
    throw new Error("Web analytics response has no data field");
  }

  const account = data.data?.viewer?.accounts?.[0];
  if (!account) {
    return {
      totals: {pageViews: 0, visits: 0},
      timeseries: [],
      topPaths: [],
      topCountries: [],
      topReferrers: [],
      deviceTypes: [],
      browsers: [],
      webVitals: []
    };
  }

  const totalsRow = account.totals?.[0];
  const timeseries: CloudflareWebAnalyticsTimeseriesPoint[] = (account.timeseries || []).map(row => ({
    datetime: row.dimensions.ts,
    pageViews: row.count || 0,
    visits: row.sum?.visits || 0
  }));

  return {
    totals: {
      pageViews: totalsRow?.count || 0,
      visits: totalsRow?.sum?.visits || 0
    },
    timeseries,
    topPaths: toBreakdown(account.paths || [], d => d.requestPath),
    topCountries: toBreakdown(account.countries || [], d => d.countryName),
    topReferrers: toBreakdown(account.referrers || [], d => d.refererHost, "(direct)"),
    deviceTypes: toBreakdown(account.devices || [], d => d.deviceType),
    browsers: toBreakdown(account.browsers || [], d => d.userAgentBrowser),
    webVitals: toWebVitals(account.webVitals || [])
  };
}
