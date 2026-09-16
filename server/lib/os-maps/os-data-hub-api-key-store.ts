import * as fs from "fs";
import * as path from "path";
import { dateTimeNowAsValue } from "../shared/dates";
import * as mongooseClient from "../mongo/mongoose-client";
import { osDataHubApiKeyResult } from "../mongo/models/os-data-hub-api-key-result";
import { OsDataHubApiKey, OsDataHubApiKeyJobResult, OsDataHubApiKeyJobStatus } from "../../../projects/ngx-ramblers/src/app/models/os-data-hub-api-key.model";

export const OS_DATA_HUB_API_KEY_FILE = "os-data-hub-api-key.json";

export function osDataHubApiKeyFromJobPath(jobPath?: string): OsDataHubApiKey | undefined {
  const keyPath = jobPath ? path.join(jobPath, OS_DATA_HUB_API_KEY_FILE) : null;
  if (!keyPath || !fs.existsSync(keyPath)) {
    return undefined;
  } else {
    const parsed = JSON.parse(fs.readFileSync(keyPath, "utf8"));
    return parsed?.apiKey ? {projectName: parsed.projectName || "", apiKey: parsed.apiKey, created: parsed.created !== false} : undefined;
  }
}

export async function createQueuedOsDataHubApiKeyResult(jobId: string, projectName: string): Promise<void> {
  await mongooseClient.execute(() => osDataHubApiKeyResult.updateOne(
    {jobId},
    {jobId, projectName, status: OsDataHubApiKeyJobStatus.QUEUED, apiKey: null, error: null, createdAt: dateTimeNowAsValue(), completedAt: null},
    {upsert: true}
  ));
}

export async function applyOsDataHubApiKeyWorkerResult(jobId: string, key: OsDataHubApiKey | undefined, errorMessage?: string): Promise<boolean> {
  const update = key?.apiKey
    ? {status: OsDataHubApiKeyJobStatus.COMPLETED, apiKey: key.apiKey, created: key.created, error: null, completedAt: dateTimeNowAsValue()}
    : {status: OsDataHubApiKeyJobStatus.FAILED, apiKey: null, error: errorMessage || "The OS Data Hub did not show a key for the project", completedAt: dateTimeNowAsValue()};
  const result = await mongooseClient.execute(() => osDataHubApiKeyResult.updateOne({jobId, status: OsDataHubApiKeyJobStatus.QUEUED}, {$set: update}));
  return result.matchedCount > 0;
}

export async function osDataHubApiKeyResultByJobId(jobId: string): Promise<OsDataHubApiKeyJobResult | null> {
  return mongooseClient.execute(() => osDataHubApiKeyResult.findOne({jobId}).lean<OsDataHubApiKeyJobResult>().exec());
}

export async function removeOsDataHubApiKeyResult(jobId: string): Promise<void> {
  await mongooseClient.execute(() => osDataHubApiKeyResult.deleteOne({jobId}));
}
