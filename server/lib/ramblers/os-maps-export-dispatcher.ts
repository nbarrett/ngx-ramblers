import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { systemConfig } from "../config/system-config";
import { IntegrationWorkerJobResponse } from "../../../projects/ngx-ramblers/src/app/models/integration-worker.model";
import { buildOsMapsExportJob, buildOsMapsListJob } from "./os-maps-export-job-builder";
import { createQueuedOsMapsExportResult, failOsMapsExportResult } from "../os-maps/os-maps-export-result-store";
import { detachedAuditSocket, dispatchRemoteIntegrationWorkerJob, integrationWorkerConfigured } from "./dispatch-integration-worker-job";

const debugLog = debug(envConfig.logNamespace("os-maps-export-dispatcher"));
debugLog.enabled = true;

async function osMapsWorkerCredentials(): Promise<{userName: string; password: string}> {
  if (!integrationWorkerConfigured()) {
    throw new Error("INTEGRATION_WORKER_URL is not set; OS Maps export must run on the integration worker");
  } else {
    const config = await systemConfig();
    const email = config?.externalSystems?.osMaps?.email;
    const password = config?.externalSystems?.osMaps?.password;
    if (!email || !password) {
      throw new Error("OS Maps login details are not configured");
    } else {
      return {userName: email, password};
    }
  }
}

export async function dispatchOsMapsExport(routeUrls: string[], walkId?: string, ramblersUser?: string): Promise<IntegrationWorkerJobResponse> {
  const credentials = await osMapsWorkerCredentials();
  const job = buildOsMapsExportJob(routeUrls, walkId, ramblersUser);
  debugLog("submitting OS Maps export job", job.jobId, "routes:", routeUrls.length, "walkId:", walkId || null);
  await createQueuedOsMapsExportResult(job.jobId, walkId, routeUrls);
  try {
    return await dispatchRemoteIntegrationWorkerJob(job, credentials, detachedAuditSocket());
  } catch (error) {
    await failOsMapsExportResult(job.jobId, (error as Error).message);
    throw error;
  }
}

export async function dispatchOsMapsList(ramblersUser?: string): Promise<IntegrationWorkerJobResponse> {
  const credentials = await osMapsWorkerCredentials();
  const job = buildOsMapsListJob(ramblersUser);
  debugLog("submitting OS Maps list job", job.jobId);
  return dispatchRemoteIntegrationWorkerJob(job, credentials, detachedAuditSocket());
}
