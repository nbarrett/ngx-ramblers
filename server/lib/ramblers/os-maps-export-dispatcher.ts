import { OsMapsImportContext } from "../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { personalOsMapsCredentials } from "../os-maps/os-maps-personal-account-store";
import { RouteContributor } from "../../../projects/ngx-ramblers/src/app/models/audit";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { systemConfig } from "../config/system-config";
import { IntegrationWorkerJobResponse } from "../../../projects/ngx-ramblers/src/app/models/integration-worker.model";
import { buildOsMapsExportJob, buildOsMapsListJob } from "./os-maps-export-job-builder";
import { createQueuedOsMapsExportResult, failOsMapsExportResult } from "../os-maps/os-maps-export-result-store";
import { detachedAuditSocket, dispatchRemoteIntegrationWorkerJob, integrationWorkerConfigured } from "./dispatch-integration-worker-job";

const debugLog = debug(envConfig.logNamespace("os-maps-export-dispatcher"));
debugLog.enabled = true;

async function osMapsWorkerCredentials(memberId: string | null = null): Promise<{userName: string; password: string}> {
  if (!integrationWorkerConfigured()) {
    throw new Error("INTEGRATION_WORKER_URL is not set; OS Maps export must run on the integration worker");
  } else {
    const personal = memberId ? await personalOsMapsCredentials(memberId) : null;
    const config = memberId ? null : await systemConfig();
    const email = (personal?.email || config?.externalSystems?.osMaps?.email || "").trim();
    const password = (personal?.password || config?.externalSystems?.osMaps?.password || "").trim();
    if (!email || !password) {
      throw new Error("OS Maps login details are not configured");
    } else {
      return {userName: email, password};
    }
  }
}

export async function dispatchOsMapsExport(routeUrls: string[], walkId?: string, ramblersUser?: string, contributor: RouteContributor | null = null, context: OsMapsImportContext = {}): Promise<IntegrationWorkerJobResponse> {
  const credentials = await osMapsWorkerCredentials(context.accountOwnerId);
  const job = buildOsMapsExportJob(routeUrls, walkId, ramblersUser);
  job.data.osMapsPersonalAccount = !!context.accountOwnerId;
  debugLog("submitting OS Maps export job", job.jobId, "routes:", routeUrls.length, "walkId:", walkId || null);
  await createQueuedOsMapsExportResult(job.jobId, job.data.fileName, walkId, routeUrls, contributor, context);
  try {
    return await dispatchRemoteIntegrationWorkerJob(job, credentials, detachedAuditSocket());
  } catch (error) {
    await failOsMapsExportResult(job.jobId, (error as Error).message);
    throw error;
  }
}

export async function dispatchOsMapsList(ramblersUser?: string, contributor: RouteContributor | null = null, context: OsMapsImportContext = {}): Promise<IntegrationWorkerJobResponse> {
  const credentials = await osMapsWorkerCredentials(context.accountOwnerId);
  const job = buildOsMapsListJob(ramblersUser);
  job.data.osMapsPersonalAccount = !!context.accountOwnerId;
  debugLog("submitting OS Maps list job", job.jobId);
  await createQueuedOsMapsExportResult(job.jobId, job.data.fileName, null, [], contributor, context, job.data.feature);
  try {
    return await dispatchRemoteIntegrationWorkerJob(job, credentials, detachedAuditSocket());
  } catch (error) {
    await failOsMapsExportResult(job.jobId, (error as Error).message);
    throw error;
  }
}
