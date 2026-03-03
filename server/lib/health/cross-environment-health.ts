import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { environmentsConfigFromDatabase } from "../environments/environments-config";
import { baseDomainFrom } from "../environment-setup/environment-context";
import { dateTimeNow } from "../shared/dates";
import {
  CrossEnvironmentHealthResponse,
  CrossEnvironmentHealthSummary,
  EnvironmentHealthCheck,
  EnvironmentHealthCheckStatus,
  HealthResponse,
  HealthStatus
} from "../../../projects/ngx-ramblers/src/app/models/health.model";

const debugLog = debug(envConfig.logNamespace("cross-environment-health"));
debugLog.enabled = true;

const TIMEOUT_MS = 10000;

async function checkSingleEnvironment(environmentName: string, appName: string, baseDomain: string): Promise<EnvironmentHealthCheck> {
  const url = `https://${appName}.fly.dev`;
  const fallbackAdminUrl = `https://${environmentName}.${baseDomain}`;
  const statusUrl = `${url}/api/system-status`;
  const startTime = dateTimeNow().toMillis();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(statusUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    const responseTimeMs = dateTimeNow().toMillis() - startTime;
    const healthResponse: Partial<HealthResponse> = await response.json();
    const adminUrl = healthResponse.group?.href || fallbackAdminUrl;

    const checkStatus = healthResponse.status === HealthStatus.OK
      ? EnvironmentHealthCheckStatus.HEALTHY
      : healthResponse.migrations?.pending > 0 && !healthResponse.migrations?.failed
        ? EnvironmentHealthCheckStatus.PENDING
        : EnvironmentHealthCheckStatus.DEGRADED;

    debugLog("Checked %s: %s (%dms)", environmentName, checkStatus, responseTimeMs);

    return { environment: environmentName, appName, url, adminUrl, checkStatus, healthResponse, responseTimeMs };
  } catch (error) {
    const responseTimeMs = dateTimeNow().toMillis() - startTime;
    debugLog("Failed to reach %s: %s (%dms)", environmentName, error.message, responseTimeMs);

    return {
      environment: environmentName,
      appName,
      url,
      adminUrl: fallbackAdminUrl,
      checkStatus: EnvironmentHealthCheckStatus.UNREACHABLE,
      error: error.message,
      responseTimeMs
    };
  }
}

export async function crossEnvironmentHealth(): Promise<CrossEnvironmentHealthResponse> {
  const environmentsConfig = await environmentsConfigFromDatabase();

  if (!environmentsConfig?.environments?.length) {
    return {
      timestamp: dateTimeNow().toISO(),
      environments: [],
      summary: { total: 0, healthy: 0, degraded: 0, unreachable: 0, pending: 0 }
    };
  }

  const baseDomain = baseDomainFrom(environmentsConfig);

  const results = await Promise.allSettled(
    environmentsConfig.environments.map(env => {
      const appName = env.flyio?.appName || `ngx-ramblers-${env.environment}`;
      return checkSingleEnvironment(env.environment, appName, baseDomain);
    })
  );

  const environments: EnvironmentHealthCheck[] = results.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    const env = environmentsConfig.environments[index];
    const appName = env.flyio?.appName || `ngx-ramblers-${env.environment}`;
    return {
      environment: env.environment,
      appName,
      url: `https://${appName}.fly.dev`,
      adminUrl: `https://${env.environment}.${baseDomain}`,
      checkStatus: EnvironmentHealthCheckStatus.UNREACHABLE,
      error: result.reason?.message || "Unknown error",
      responseTimeMs: 0
    };
  });

  const summary: CrossEnvironmentHealthSummary = {
    total: environments.length,
    healthy: environments.filter(e => e.checkStatus === EnvironmentHealthCheckStatus.HEALTHY).length,
    degraded: environments.filter(e => e.checkStatus === EnvironmentHealthCheckStatus.DEGRADED).length,
    unreachable: environments.filter(e => e.checkStatus === EnvironmentHealthCheckStatus.UNREACHABLE).length,
    pending: environments.filter(e => e.checkStatus === EnvironmentHealthCheckStatus.PENDING).length
  };

  debugLog("Cross-environment health check complete: %o", summary);

  return {
    timestamp: dateTimeNow().toISO(),
    environments,
    summary
  };
}
