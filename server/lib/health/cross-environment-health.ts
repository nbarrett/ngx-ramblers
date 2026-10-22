import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { environmentsConfigFromDatabase } from "../environments/environments-config";
import { baseDomainFrom } from "../environment-setup/environment-context";
import {primaryCandidates} from "../environment-setup/hostname-health";
import { probeHttp } from "./public-http-probe";
import { dateTimeNow, dateTimeNowAsValue } from "../shared/dates";
import { queryCertificates } from "../fly/fly-certificates";
import { EnvironmentConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import {
  CrossEnvironmentHealthResponse,
  EnvironmentHealthEvent,
  EnvironmentHealthEventType,
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

import { environmentHealthSummary } from "../../../projects/ngx-ramblers/src/app/functions/environment-health";

const debugLog = debug(envConfig.logNamespace("cross-environment-health"));
debugLog.enabled = true;

const TIMEOUT_MS = 10000;
const HEALTH_CHECK_CONCURRENCY = 4;

function firstFailMessage(findings: EnvironmentHealthFinding[]): string | undefined {
  const fail = findings.find(finding => finding.severity === EnvironmentHealthFindingSeverity.FAIL);
  const warning = findings.find(finding => finding.severity === EnvironmentHealthFindingSeverity.WARNING);
  return fail?.message || warning?.message;
}

async function certificateFindingsFor(env: EnvironmentConfig, hostnames: string[], signal?: AbortSignal): Promise<EnvironmentHealthFinding[]> {
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
      const certs = await queryCertificates({ apiToken, appName }, signal);
      const nowMillis = dateTimeNowAsValue();
      return hostnames.map(hostname => certificateFinding({
        hostname,
        cert: certs.find(item => item.hostname === hostname),
        nowMillis,
        warningDays: CERT_EXPIRY_WARNING_DAYS
      }));
    } catch (caught) {
      signal?.throwIfAborted();
      const detail = caught instanceof Error ? caught.message : String(caught);
      return [{
        name: EnvironmentHealthCheckName.CERTIFICATE,
        severity: EnvironmentHealthFindingSeverity.WARNING,
        message: `Could not query Fly certificates: ${detail}`
      }];
    }
  }
}

async function checkSingleEnvironment(env: EnvironmentConfig, baseDomain: string, signal?: AbortSignal): Promise<EnvironmentHealthCheck> {
  const environmentName = env.environment;
  const appName = env.flyio?.appName || `ngx-ramblers-${environmentName}`;
  const url = `https://${appName}.fly.dev`;
  const fallbackAdminUrl = `https://${environmentName}.${baseDomain}`;
  const statusUrl = `${url}/api/system-status`;
  const startTime = dateTimeNow().toMillis();
  const findings: EnvironmentHealthFinding[] = [];

  try {
    signal?.throwIfAborted();
    const requestSignal = AbortSignal.timeout(TIMEOUT_MS);
    const response = await fetch(statusUrl, { signal: signal ? AbortSignal.any([signal, requestSignal]) : requestSignal });
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
    const publicProbe = await probeHttp(visitorHost, signal);
    const ngxProbe = visitorHost === ngxHost || publicHttpSucceeded(publicProbe.httpStatus)
      ? publicProbe
      : await probeHttp(ngxHost, signal);
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
    findings.push(...await certificateFindingsFor(env, [visitorHost], signal));

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
      hostnames: primaryCandidates(visitorHost, env.customDomains || [], ngxHost),
      healthResponse,
      error: firstFailMessage(findings),
      findings,
      responseTimeMs
    };
  } catch (caught) {
    signal?.throwIfAborted();
    const flyError = caught instanceof Error ? caught.message : String(caught);
    findings.push({
      name: EnvironmentHealthCheckName.MACHINE,
      severity: EnvironmentHealthFindingSeverity.FAIL,
      message: `Fly app did not respond at ${url}: ${flyError}`
    });
    const publicHostname = visitorHostnameFromSiteUrl(undefined, environmentName, baseDomain);
    const publicUrl = `https://${publicHostname}`;
    const publicProbe = await probeHttp(publicHostname, signal);
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
    findings.push(...await certificateFindingsFor(env, [`${environmentName}.${baseDomain}`], signal));
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
      hostnames: primaryCandidates(publicHostname, env.customDomains || [], publicHostname),
      error: firstFailMessage(findings),
      findings,
      responseTimeMs
    };
  }
}

export async function crossEnvironmentHealth(onProgress?: (event: EnvironmentHealthEvent) => void, signal?: AbortSignal): Promise<CrossEnvironmentHealthResponse> {
  const environmentsConfig = await environmentsConfigFromDatabase();
  signal?.throwIfAborted();
  const configured = environmentsConfig?.environments || [];
  const baseDomain = environmentsConfig ? baseDomainFrom(environmentsConfig) : "";
  const timestamp = dateTimeNow().toISO();
  const environments: EnvironmentHealthCheck[] = [];
  const progress = {nextIndex: 0};
  onProgress?.({type: EnvironmentHealthEventType.START, total: configured.length, timestamp});
  const worker = async (): Promise<void> => {
    signal?.throwIfAborted();
    const index = progress.nextIndex++;
    if (index < configured.length) {
      const env = configured[index];
      const result = await checkSingleEnvironment(env, baseDomain, signal).catch(error => {
        signal?.throwIfAborted();
        const appName = env.flyio?.appName || `ngx-ramblers-${env.environment}`;
        return {
          environment: env.environment,
          appName,
          url: `https://${appName}.fly.dev`,
          adminUrl: `https://${env.environment}.${baseDomain}`,
          checkStatus: EnvironmentHealthCheckStatus.UNREACHABLE,
          error: error.message || "Unknown error",
          findings: [],
          responseTimeMs: 0
        };
      });
      signal?.throwIfAborted();
      environments.push(result);
      onProgress?.({type: EnvironmentHealthEventType.RESULT, environment: result, timestamp: dateTimeNow().toISO()});
      await worker();
    }
  };
  await Promise.all(Array.from({length: Math.min(HEALTH_CHECK_CONCURRENCY, configured.length)}, () => worker()));
  const response = {timestamp: dateTimeNow().toISO(), environments, summary: environmentHealthSummary(environments)};
  onProgress?.({type: EnvironmentHealthEventType.COMPLETE, timestamp: response.timestamp});
  debugLog("Cross-environment health check complete: %o", response.summary);
  return response;
}
