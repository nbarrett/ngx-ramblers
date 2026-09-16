import debug from "debug";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { OsMapsKeyProvision } from "../../../projects/ngx-ramblers/src/app/models/environment-setup.model";
import { envConfig } from "../env-config/env-config";
import { connectToEnvironmentMongo, loadEnvironmentContext } from "../environment-setup/environment-context";
import { environmentsConfigFromDatabase } from "../environments/environments-config";
import { ConsoleAccessFieldKind, consoleAccessValue } from "../ops/console-access-catalogue";
import { ConsoleAccessService } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { OS_DATA_HUB_API_KEY_MAX_WAIT_MS, OS_DATA_HUB_API_KEY_POLL_MS, OsDataHubApiKey, OsDataHubApiKeyJobResult, OsDataHubApiKeyJobStatus } from "../../../projects/ngx-ramblers/src/app/models/os-data-hub-api-key.model";
import { buildOsDataHubApiKeyJob } from "../ramblers/os-maps-export-job-builder";
import { detachedAuditSocket, dispatchRemoteIntegrationWorkerJob, integrationWorkerConfigured } from "../ramblers/dispatch-integration-worker-job";
import { createQueuedOsDataHubApiKeyResult, osDataHubApiKeyResultByJobId, removeOsDataHubApiKeyResult } from "./os-data-hub-api-key-store";
import { dateTimeNowAsValue } from "../shared/dates";

const debugLog = debug(envConfig.logNamespace("os-maps:provision-key"));
const MANUAL_KEY_ADVICE = "Generate a key by hand at osdatahub.os.uk and enter it under System Settings, OS Maps on the new site.";

export async function osDataHubLoginFromPlatform(): Promise<{email: string; password: string}> {
  const environmentsConfig = await environmentsConfigFromDatabase();
  const access = environmentsConfig?.consoleAccess;
  return {
    email: consoleAccessValue(access, ConsoleAccessService.OS_DATA_HUB, ConsoleAccessFieldKind.LOGIN).trim(),
    password: consoleAccessValue(access, ConsoleAccessService.OS_DATA_HUB, ConsoleAccessFieldKind.PASSWORD).trim()
  };
}

export async function generateOsMapsApiKey(projectName: string, email: string, password: string, report: (message: string) => Promise<unknown>): Promise<OsDataHubApiKey | null> {
  const job = buildOsDataHubApiKeyJob(projectName);
  await createQueuedOsDataHubApiKeyResult(job.jobId, projectName);
  try {
    await dispatchRemoteIntegrationWorkerJob(job, {userName: email, password}, detachedAuditSocket());
    await report(`Asked the integration worker to sign in to the OS Data Hub and read the key for project ${projectName}`);
    const result = await completedOsDataHubApiKeyResult(job.jobId, dateTimeNowAsValue() + OS_DATA_HUB_API_KEY_MAX_WAIT_MS);
    if (result?.status === OsDataHubApiKeyJobStatus.COMPLETED) {
      debugLog("generated key length %s for %s", (result.apiKey || "").length, projectName);
      return result.apiKey ? {projectName, apiKey: result.apiKey, created: result.created !== false} : null;
    } else if (result?.status === OsDataHubApiKeyJobStatus.FAILED) {
      throw new Error(result.error);
    } else {
      throw new Error(`the integration worker did not return a key within ${Math.round(OS_DATA_HUB_API_KEY_MAX_WAIT_MS / 60000)} minutes`);
    }
  } finally {
    await removeOsDataHubApiKeyResult(job.jobId);
  }
}

async function completedOsDataHubApiKeyResult(jobId: string, deadline: number): Promise<OsDataHubApiKeyJobResult | null> {
  const result = await osDataHubApiKeyResultByJobId(jobId);
  if (result && result.status !== OsDataHubApiKeyJobStatus.QUEUED) {
    return result;
  } else if (dateTimeNowAsValue() >= deadline) {
    return result;
  } else {
    await new Promise(resolve => setTimeout(resolve, OS_DATA_HUB_API_KEY_POLL_MS));
    return completedOsDataHubApiKeyResult(jobId, deadline);
  }
}

export async function provisionOsMapsApiKey(environmentName: string, report: (message: string) => Promise<unknown> = async () => undefined): Promise<OsMapsKeyProvision> {
  const platform = await osDataHubLoginFromPlatform();
  const projectName = environmentName;
  if (!platform.email || !platform.password) {
    return {apiKey: "", message: `OS Maps API key not generated: the platform has no OS Data Hub login under System Logins. ${MANUAL_KEY_ADVICE}`};
  } else if (!integrationWorkerConfigured()) {
    return {apiKey: "", message: `OS Maps API key not generated: no integration worker is configured to sign in to the OS Data Hub. ${MANUAL_KEY_ADVICE}`};
  } else {
    try {
      const generated = await generateOsMapsApiKey(projectName, platform.email, platform.password, report);
      return generated
        ? {apiKey: generated.apiKey, message: generated.created ? `Generated an OS Maps API key for project ${projectName}` : `Found the existing OS Maps API key for project ${projectName}`}
        : {apiKey: "", message: `OS Maps API key not generated: the OS Data Hub did not show a key for project ${projectName}. ${MANUAL_KEY_ADVICE}`};
    } catch (error) {
      debugLog("generateOsMapsApiKey failed: %s", (error as Error).message);
      return {apiKey: "", message: `OS Maps API key not generated: ${(error as Error).message}. ${MANUAL_KEY_ADVICE}`};
    }
  }
}

export async function ensureOsMapsApiKey(environmentName: string, report: (message: string) => Promise<unknown>, progress: (message: string) => Promise<unknown> = async () => undefined): Promise<OsMapsKeyProvision> {
  const context = await loadEnvironmentContext(environmentName);
  const connection = await connectToEnvironmentMongo(context.envConfigData);
  try {
    const system = await connection.db.collection("config").findOne({key: ConfigKey.SYSTEM});
    const existing = system?.value?.externalSystems?.osMaps?.apiKey;
    if (existing) {
      return {apiKey: existing, message: "OS Maps API key already configured"};
    } else {
      const provisioned = await provisionOsMapsApiKey(environmentName, progress);
      if (provisioned.apiKey) {
        await connection.db.collection("config").updateOne({key: ConfigKey.SYSTEM}, {$set: {"value.externalSystems.osMaps.apiKey": provisioned.apiKey}});
      }
      await report(provisioned.message);
      return provisioned;
    }
  } finally {
    await connection.client.close();
  }
}
