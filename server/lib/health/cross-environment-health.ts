import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { environmentsConfigFromDatabase } from "../environments/environments-config";
import { baseDomainFrom } from "../environment-setup/environment-context";
import { probeHttp } from "./public-http-probe";
import { dateTimeNow, dateTimeNowAsValue } from "../shared/dates";
import { queryCertificates } from "../fly/fly-certificates";
import { EnvironmentConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import {
  CrossEnvironmentHealthResponse,
  CrossEnvironmentHealthSummary,
  EnvironmentHealthCheck,
  EnvironmentHealthCheckName,
  EnvironmentHealthCheckStatus,
  EnvironmentHealthFinding,
  EnvironmentHealthFindingSeverity,
  HealthResponse
} from "../../../projects/ngx-ramblers/src/app/models/health.model";
import {
  CERT_EXPIRY_WARNING_DAYS,
  certificateFinding,
  environmentHealthFromFindings,
  visitorHostnameFromSiteUrl,
  publicHttpSucceeded,
  publicSiteFailureMessage
} from "./environment-check-status";

const debugLog = debug(envConfig.logNamespace("cross-environment-health"));
debugLog.enabled = true;

const TIMEOUT_MS = 10000;

function firstFailMessage(findings: EnvironmentHealthFinding[]): string | undefined {
  const fail = findings.find(finding => finding.severity === EnvironmentHealthFindingSeverity.FAIL);
  const warning = findings.find(finding => finding.severity === EnvironmentHealthFindingSeverity.WARNING);
  return fail?.message || warning?.message;
}

async function certificateFindingsFor(env: EnvironmentConfig, hostnames: string[]): Promise<EnvironmentHealthFinding[]> {
  const apiToken = env.flyio?.apiKey;
  const appName = env.flyio?.appName || `ngx-ramblers-${env.environment}`;
  if (!apiToken) {
    return hostnames.map(hostname => ({
      name: EnvironmentHealthCheckName.CERTIFICATE,
      severity: EnvironmentHealthFindingSeverity.WARNING,
      message: `No Fly API token, so the certificate for ${hostname} could not be checked`
    }));
  } else {
    try {
      const certs = await queryCertificates({ apiToken, appName });
      const nowMillis = dateTimeNowAsValue();
      return hostnames.map(hostname => certificateFinding({
        hostname,
        cert: certs.find(item => item.hostname === hostname),
        nowMillis,
        warningDays: CERT_EXPIRY_WARNING_DAYS
      }));
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : String(caught);
      return [{
        name: EnvironmentHealthCheckName.CERTIFICATE,
        severity: EnvironmentHealthFindingSeverity.WARNING,
        message: `Could not query Fly certificates: ${detail}`
      }];
    }
  }
}

async function checkSingleEnvironment(env: EnvironmentConfig, baseDomain: string): Promise<EnvironmentHealthCheck> {
  const environmentName = env.environment;
  const appName = env.flyio?.appName || `ngx-ramblers-${environmentName}`;
  const url = `https://${appName}.fly.dev`;
  const fallbackAdminUrl = `https://${environmentName}.${baseDomain}`;
  const statusUrl = `${url}/api/system-status`;
  const startTime = dateTimeNow().toMillis();
  const findings: EnvironmentHealthFinding[] = [];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const response = await fetch(statusUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    const healthResponse: Partial<HealthResponse> = await response.json();
    findings.push({
      name: EnvironmentHealthCheckName.MACHINE,
      severity: EnvironmentHealthFindingSeverity.OK,
      message: `Fly app responded at ${url}`
    });

    const siteHref = healthResponse.group?.href;
    const visitorHost = visitorHostnameFromSiteUrl(siteHref, environmentName, baseDomain);
    const ngxHost = `${environmentName}.${baseDomain}`;
    const publicUrl = `https://${visitorHost}`;
    const publicProbe = await probeHttp(visitorHost);
    const ngxProbe = visitorHost === ngxHost || publicHttpSucceeded(publicProbe.httpStatus)
      ? publicProbe
      : await probeHttp(ngxHost);
    if (publicHttpSucceeded(publicProbe.httpStatus)) {
      findings.push({
        name: EnvironmentHealthCheckName.PUBLIC_HTTP,
        severity: EnvironmentHealthFindingSeverity.OK,
        message: `${publicUrl} returned HTTP ${publicProbe.httpStatus}`
      });
    } else if (publicHttpSucceeded(ngxProbe.httpStatus)) {
      findings.push({
        name: EnvironmentHealthCheckName.PUBLIC_HTTP,
        severity: EnvironmentHealthFindingSeverity.WARNING,
        message: `${visitorHost} did not respond; ${ngxHost} is up`
      });
    } else {
      findings.push({
        name: EnvironmentHealthCheckName.PUBLIC_HTTP,
        severity: EnvironmentHealthFindingSeverity.FAIL,
        message: publicSiteFailureMessage(publicUrl, publicProbe.httpStatus)
      });
    }
    findings.push(...await certificateFindingsFor(env, [visitorHost]));

    if (healthResponse.migrations?.failed) {
      findings.push({
        name: EnvironmentHealthCheckName.MIGRATIONS,
        severity: EnvironmentHealthFindingSeverity.FAIL,
        message: "One or more database migrations have failed"
      });
    } else if ((healthResponse.migrations?.pending || 0) === 0) {
      findings.push({
        name: EnvironmentHealthCheckName.MIGRATIONS,
        severity: EnvironmentHealthFindingSeverity.OK,
        message: "Database migrations are up to date"
      });
    }

    const checkStatus = environmentHealthFromFindings({
      findings,
      pendingMigrations: healthResponse.migrations?.pending || 0,
      failedMigrations: healthResponse.migrations?.failed === true,
      machineHealthStatus: healthResponse.status
    });
    const responseTimeMs = dateTimeNow().toMillis() - startTime;
    debugLog("Checked %s: %s (%dms)", environmentName, checkStatus, responseTimeMs);
    return {
      environment: environmentName,
      appName,
      url,
      adminUrl: publicHttpSucceeded(publicProbe.httpStatus)
        ? (siteHref || `https://${visitorHost}`)
        : (publicHttpSucceeded(ngxProbe.httpStatus) ? `https://${ngxHost}` : (siteHref || `https://${visitorHost}`)),
      checkStatus,
      healthResponse,
      error: firstFailMessage(findings),
      findings,
      responseTimeMs
    };
  } catch (caught) {
    const flyError = caught instanceof Error ? caught.message : String(caught);
    findings.push({
      name: EnvironmentHealthCheckName.MACHINE,
      severity: EnvironmentHealthFindingSeverity.FAIL,
      message: `Fly app did not respond at ${url}: ${flyError}`
    });
    const publicHostname = visitorHostnameFromSiteUrl(undefined, environmentName, baseDomain);
    const publicUrl = `https://${publicHostname}`;
    const publicProbe = await probeHttp(publicHostname);
    if (publicHttpSucceeded(publicProbe.httpStatus)) {
      findings.push({
        name: EnvironmentHealthCheckName.PUBLIC_HTTP,
        severity: EnvironmentHealthFindingSeverity.OK,
        message: `${publicUrl} returned HTTP ${publicProbe.httpStatus}`
      });
    } else {
      findings.push({
        name: EnvironmentHealthCheckName.PUBLIC_HTTP,
        severity: EnvironmentHealthFindingSeverity.FAIL,
        message: publicSiteFailureMessage(publicUrl, publicProbe.httpStatus)
      });
    }
    findings.push(...await certificateFindingsFor(env, [`${environmentName}.${baseDomain}`]));
    const checkStatus = environmentHealthFromFindings({
      findings,
      pendingMigrations: 0,
      failedMigrations: false
    });
    const responseTimeMs = dateTimeNow().toMillis() - startTime;
    debugLog("Failed to reach %s via Fly: %s public=%s (%dms)", environmentName, flyError, publicProbe.httpStatus, responseTimeMs);
    return {
      environment: environmentName,
      appName,
      url,
      adminUrl: fallbackAdminUrl,
      checkStatus,
      error: firstFailMessage(findings),
      findings,
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
  } else {
    const baseDomain = baseDomainFrom(environmentsConfig);
    const results = await Promise.allSettled(
      environmentsConfig.environments.map(env => checkSingleEnvironment(env, baseDomain))
    );
    const environments: EnvironmentHealthCheck[] = results.map((result, index) => {
      if (result.status === "fulfilled") {
        return result.value;
      } else {
        const env = environmentsConfig.environments[index];
        const appName = env.flyio?.appName || `ngx-ramblers-${env.environment}`;
        return {
          environment: env.environment,
          appName,
          url: `https://${appName}.fly.dev`,
          adminUrl: `https://${env.environment}.${baseDomain}`,
          checkStatus: EnvironmentHealthCheckStatus.UNREACHABLE,
          error: result.reason?.message || "Unknown error",
          findings: [],
          responseTimeMs: 0
        };
      }
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
}
