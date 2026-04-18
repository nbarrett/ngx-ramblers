import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import { signRamblersUploadBody } from "./integration-worker-crypto";
import { FlickrScrapedUserAlbumsData } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { IntegrationWorkerCallbackConfig, IntegrationWorkerMigrationJobRequest } from "../../../projects/ngx-ramblers/src/app/models/integration-worker.model";
import { SiteMigrationConfig } from "../../../projects/ngx-ramblers/src/app/models/migration-config.model";

const debugLog = debug(envConfig.logNamespace("integration-worker-browser-client"));
debugLog.enabled = true;

export interface HtmlFetchResult {
  html: string;
  finalUrl: string;
  baseHref: string | null;
}

export async function fetchHtmlViaIntegrationWorker(url: string, waitUntil: "load" | "domcontentloaded" | "networkidle" | "commit" = "domcontentloaded", timeoutMs = 60000): Promise<HtmlFetchResult> {
  return requestBrowserOperation<HtmlFetchResult>("html-fetch", { url, waitUntil, timeoutMs });
}

export async function scrapeFlickrUserAlbumsViaIntegrationWorker(userId: string): Promise<FlickrScrapedUserAlbumsData> {
  return requestBrowserOperation<FlickrScrapedUserAlbumsData>("flickr-user-albums", { userId });
}

export async function submitMigrationJobToIntegrationWorker(jobId: string, siteConfig: SiteMigrationConfig, persistData: boolean, uploadTos3: boolean): Promise<void> {
  const workerUrl = required(Environment.INTEGRATION_WORKER_URL);
  const sharedSecret = required(Environment.INTEGRATION_WORKER_SHARED_SECRET);
  const callbackBaseUrl = envConfig.value(Environment.INTEGRATION_WORKER_CALLBACK_BASE_URL) || envConfig.value(Environment.BASE_URL);
  if (!callbackBaseUrl) {
    throw new Error(`Environment variable '${Environment.INTEGRATION_WORKER_CALLBACK_BASE_URL}' or '${Environment.BASE_URL}' must be set to submit migration jobs`);
  }
  const callback: IntegrationWorkerCallbackConfig = {
    baseUrl: callbackBaseUrl,
    progressPath: "/api/integration-worker/migration/progress",
    resultPath: "/api/integration-worker/migration/result"
  };
  const request: IntegrationWorkerMigrationJobRequest = { jobId, siteConfig, persistData, uploadTos3, callback };
  const body = JSON.stringify(request);
  const signature = signRamblersUploadBody(body, sharedSecret);
  const endpoint = `${workerUrl.replace(/\/+$/, "")}/api/integration-worker/migration/jobs`;
  debugLog("-> submit migration jobId:", jobId, "endpoint:", endpoint);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", "x-ramblers-upload-signature": signature },
    body
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Integration worker migration submit failed with status ${response.status}: ${text}`);
  }
}

async function requestBrowserOperation<T>(operationPath: string, payload: object): Promise<T> {
  const workerUrl = required(Environment.INTEGRATION_WORKER_URL);
  const sharedSecret = required(Environment.INTEGRATION_WORKER_SHARED_SECRET);
  const body = JSON.stringify(payload);
  const signature = signRamblersUploadBody(body, sharedSecret);
  const endpoint = `${workerUrl.replace(/\/+$/, "")}/api/integration-worker/browser/${operationPath}`;
  debugLog("->", operationPath, "endpoint:", endpoint, "bytes:", body.length);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-ramblers-upload-signature": signature
    },
    body
  });
  const text = await response.text();
  if (!response.ok) {
    debugLog("<-", operationPath, "status:", response.status, "body:", text.slice(0, 200));
    throw new Error(`Integration worker ${operationPath} failed with status ${response.status}: ${text}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch (parseError) {
    debugLog("<-", operationPath, "non-JSON body:", text.slice(0, 200));
    throw new Error(`Integration worker ${operationPath} returned non-JSON: ${(parseError as Error).message}`);
  }
}

function required(key: Environment): string {
  const value = envConfig.value(key);
  if (!value) {
    throw new Error(`Environment variable '${key}' must be set to call the integration worker browser API`);
  }
  return value;
}
