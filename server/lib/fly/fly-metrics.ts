import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { FlyMachineStats, FlyMetricHistory, FlyMetricSeries, FlyTargetApp } from "../../../projects/ngx-ramblers/src/app/models/health.model";
import {
  FlyAppDetailsResponse,
  FlyMetricDefinition,
  PrometheusRangeResponse,
  PrometheusRangeResult,
  PrometheusResponse,
  PrometheusResult
} from "./fly.model";
import { flyAuthorizationHeader, MACHINES_API_BASE, missingFlyConfig } from "./fly-env";
import { toMb } from "../shared/units";
import { dateTimeNow } from "../shared/dates";
import { flyRuntimeConfig } from "./fly-runtime-config";

const debugLog = debug(envConfig.logNamespace("fly:metrics"));
debugLog.enabled = true;

const BYTES_PER_KB = 1024;
const BYTES_PER_MB = 1048576;
const resolvedOrganisations = new Map<string, string>();
const APP_SCOPED_TOKEN_ERROR = "This environment's Fly API token can manage the app but is not authorised to read metrics (403 from Fly Prometheus). Replace this environment's flyio apiKey with an org-scoped token to enable metrics - restart is unaffected.";

function selector(appName: string, machineId: string, extra?: string): string {
  const parts = [`app="${appName}"`, machineId ? `instance="${machineId}"` : null, extra].filter(Boolean);
  return `{${parts.join(", ")}}`;
}

export const FLY_METRIC_DEFINITIONS: FlyMetricDefinition[] = [
  {
    key: "memory",
    unit: "MB",
    series: [
      {
        label: "Memory used",
        scale: 1 / BYTES_PER_MB,
        promQuery: (appName, machineId) => `(fly_instance_memory_mem_total${selector(appName, machineId)} - fly_instance_memory_mem_available${selector(appName, machineId)})`
      },
      {
        label: "Memory total",
        dashed: true,
        scale: 1 / BYTES_PER_MB,
        promQuery: (appName, machineId) => `fly_instance_memory_mem_total${selector(appName, machineId)}`
      }
    ]
  },
  {
    key: "cpu",
    unit: "%",
    series: [
      {
        label: "CPU busy",
        scale: 1,
        promQuery: (appName, machineId, rateWindowSeconds) => `(1 - (sum by (app) (rate(fly_instance_cpu${selector(appName, machineId, `mode="idle"`)}[${rateWindowSeconds}s])) / sum by (app) (rate(fly_instance_cpu${selector(appName, machineId)}[${rateWindowSeconds}s])))) * 100`
      }
    ]
  },
  {
    key: "loadAverage",
    unit: "load",
    series: ["1", "5", "15"].map(minutes => ({
      label: `${minutes}m average`,
      scale: 1,
      promQuery: (appName: string, machineId: string) => `fly_instance_load_average${selector(appName, machineId, `minutes="${minutes}"`)}`
    }))
  },
  {
    key: "network",
    unit: "KB/s",
    series: [
      {
        label: "Received",
        scale: 1 / BYTES_PER_KB,
        promQuery: (appName, machineId, rateWindowSeconds) => `sum by (app) (rate(fly_instance_net_recv_bytes${selector(appName, machineId)}[${rateWindowSeconds}s]))`
      },
      {
        label: "Sent",
        scale: 1 / BYTES_PER_KB,
        promQuery: (appName, machineId, rateWindowSeconds) => `sum by (app) (rate(fly_instance_net_sent_bytes${selector(appName, machineId)}[${rateWindowSeconds}s]))`
      }
    ]
  },
  {
    key: "httpResponses",
    unit: "responses/min",
    series: ["2", "3", "4", "5"].map(statusClass => ({
      label: `${statusClass}xx`,
      scale: 1,
      promQuery: (appName: string, _machineId: string, rateWindowSeconds: number) => `sum by (app) (rate(fly_app_http_responses_count{app="${appName}", status=~"${statusClass}.."}[${rateWindowSeconds}s])) * 60`
    }))
  }
];

async function organisationSlug(apiToken: string, appName: string, configured: string): Promise<string> {
  const cached = resolvedOrganisations.get(appName);
  if (cached) {
    return cached;
  }
  try {
    const response = await fetch(`${MACHINES_API_BASE}/apps/${appName}`, { headers: { Authorization: flyAuthorizationHeader(apiToken) } });
    if (!response.ok) {
      throw new Error(`App lookup failed: ${response.status}`);
    }
    const body: FlyAppDetailsResponse = await response.json();
    const slug = body?.organization?.slug;
    if (!slug) {
      throw new Error("App details contained no organization slug");
    }
    debugLog(`Resolved organisation ${slug} for app ${appName} via Machines API`);
    resolvedOrganisations.set(appName, slug);
    return slug;
  } catch (error) {
    debugLog(`Organisation resolution failed for app ${appName}, using configured value ${configured || "(none)"}:`, error);
    if (configured) {
      return configured;
    }
    throw error;
  }
}

function isNotAuthorisedForOrg(error: Error): boolean {
  return (error?.message || "").includes("403");
}

async function queryPrometheus(organisation: string, apiToken: string, promQuery: string): Promise<PrometheusResult[]> {
  const url = `https://api.fly.io/prometheus/${organisation}/api/v1/query?query=${encodeURIComponent(promQuery)}`;
  const response = await fetch(url, { headers: { Authorization: flyAuthorizationHeader(apiToken) } });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Prometheus query failed: ${response.status} ${text}`.trim());
  }
  const body: PrometheusResponse = await response.json();
  if (body.status !== "success") {
    throw new Error(`Prometheus query returned status ${body.status}`);
  }
  return body.data.result;
}

async function queryPrometheusRange(organisation: string, apiToken: string, promQuery: string, startSeconds: number, endSeconds: number, stepSeconds: number): Promise<PrometheusRangeResult[]> {
  const url = `https://api.fly.io/prometheus/${organisation}/api/v1/query_range?query=${encodeURIComponent(promQuery)}&start=${startSeconds}&end=${endSeconds}&step=${stepSeconds}`;
  const response = await fetch(url, { headers: { Authorization: flyAuthorizationHeader(apiToken) } });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Prometheus range query failed: ${response.status} ${text}`.trim());
  }
  const body: PrometheusRangeResponse = await response.json();
  if (body.status !== "success") {
    throw new Error(`Prometheus range query returned status ${body.status}`);
  }
  return body.data.result;
}

export async function flyMachineMemoryStats(target: FlyTargetApp = FlyTargetApp.ENVIRONMENT): Promise<FlyMachineStats> {
  const { apiToken, metricsToken, appName, organisation, machineId } = await flyRuntimeConfig(target);
  const token = metricsToken || apiToken;
  const missing = missingFlyConfig({ FLY_API_TOKEN: token, FLY_APP_NAME: appName });
  if (missing) {
    return { available: false, error: `Fly stats are not configured for this environment (missing ${missing})` };
  }
  debugLog(`Querying Fly memory stats for ${appName} machine ${machineId || "(any)"}`);
  try {
    const org = await organisationSlug(token, appName, organisation);
    const [totalResult, availableResult] = await Promise.all([
      queryPrometheus(org, token, `fly_instance_memory_mem_total${selector(appName, machineId)}`),
      queryPrometheus(org, token, `fly_instance_memory_mem_available${selector(appName, machineId)}`)
    ]);
    if (!totalResult.length || !availableResult.length) {
      return {
        available: false,
        error: `No memory metrics found for app ${appName}${machineId ? ` machine ${machineId}` : ""} in org ${org} - the machine may have just restarted`
      };
    }
    const totalBytes = Number(totalResult[0].value?.[1] ?? 0);
    const availableBytes = Number(availableResult[0].value?.[1] ?? 0);
    return {
      available: true,
      appName,
      machineId,
      memoryUsedMb: toMb(totalBytes - availableBytes),
      memoryTotalMb: toMb(totalBytes)
    };
  } catch (error) {
    if (isNotAuthorisedForOrg(error)) {
      return { available: false, error: APP_SCOPED_TOKEN_ERROR };
    }
    throw error;
  }
}

export async function flyMetricHistory(metricKey: string, minutes: number, target: FlyTargetApp = FlyTargetApp.ENVIRONMENT): Promise<FlyMetricHistory> {
  const definition = FLY_METRIC_DEFINITIONS.find(item => item.key === metricKey);
  if (!definition) {
    return { available: false, error: `Unknown metric ${metricKey}`, series: [] };
  }
  const { apiToken, metricsToken, appName, organisation, machineId } = await flyRuntimeConfig(target);
  const token = metricsToken || apiToken;
  const missing = missingFlyConfig({ FLY_API_TOKEN: token, FLY_APP_NAME: appName });
  if (missing) {
    return { available: false, error: `Fly stats are not configured for this environment (missing ${missing})`, series: [] };
  }
  const endSeconds = Math.floor(dateTimeNow().toSeconds());
  const startSeconds = endSeconds - minutes * 60;
  const stepSeconds = Math.max(15, Math.round((minutes * 60) / 200));
  const rateWindowSeconds = Math.max(60, stepSeconds * 4);
  debugLog(`Querying Fly ${metricKey} history for ${appName} machine ${machineId || "(any)"} over ${minutes} minutes at ${stepSeconds}s resolution`);
  try {
    const org = await organisationSlug(token, appName, organisation);
    const results = await Promise.all(definition.series.map(seriesDefinition =>
      queryPrometheusRange(org, token, seriesDefinition.promQuery(appName, machineId, rateWindowSeconds), startSeconds, endSeconds, stepSeconds)));
    const series: FlyMetricSeries[] = definition.series
      .map((seriesDefinition, index) => ({
        label: seriesDefinition.label,
        dashed: seriesDefinition.dashed,
        samples: (results[index][0]?.values || []).map(([time, value]) => ({
          time: time * 1000,
          value: Math.round(Number(value) * seriesDefinition.scale * 10) / 10
        }))
      }))
      .filter(item => item.samples.length);
    if (!series.length) {
      return {
        available: false,
        error: `No ${metricKey} metrics found for app ${appName}${machineId ? ` machine ${machineId}` : ""} in org ${org}`,
        series: []
      };
    }
    return { available: true, appName, machineId, metric: metricKey, unit: definition.unit, series };
  } catch (error) {
    if (isNotAuthorisedForOrg(error)) {
      return { available: false, error: APP_SCOPED_TOKEN_ERROR, series: [] };
    }
    throw error;
  }
}
