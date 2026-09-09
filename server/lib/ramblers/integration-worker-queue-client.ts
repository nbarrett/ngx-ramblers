import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import {
  IntegrationWorkerQueueCancelResult,
  IntegrationWorkerQueueClearResult,
  IntegrationWorkerQueueStatus
} from "../../../projects/ngx-ramblers/src/app/models/integration-worker.model";
import { signRamblersUploadBody } from "./integration-worker-crypto";

const debugLog = debug(envConfig.logNamespace("integration-worker-queue-client"));
debugLog.enabled = true;

export function integrationWorkerConfigured(): boolean {
  return !!envConfig.value(Environment.INTEGRATION_WORKER_URL);
}

async function postSignedToWorker<T>(path: string): Promise<T> {
  const workerUrl = requiredValue(Environment.INTEGRATION_WORKER_URL);
  const sharedSecret = requiredValue(Environment.INTEGRATION_WORKER_SHARED_SECRET);
  const body = JSON.stringify({});
  const signature = signRamblersUploadBody(body, sharedSecret);
  const response = await fetch(`${workerUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-ramblers-upload-signature": signature
    },
    body
  });
  debugLog("postSignedToWorker path:", path, "status:", response.status);
  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(`Worker request to ${path} failed with status ${response.status}: ${responseBody}`);
  }
  return await response.json() as T;
}

export function fetchWorkerQueueStatus(): Promise<IntegrationWorkerQueueStatus> {
  return postSignedToWorker<IntegrationWorkerQueueStatus>("/api/integration-worker/queue/status");
}

export function cancelActiveWorkerQueueJob(): Promise<IntegrationWorkerQueueCancelResult> {
  return postSignedToWorker<IntegrationWorkerQueueCancelResult>("/api/integration-worker/queue/cancel-active");
}

export function clearWorkerQueue(): Promise<IntegrationWorkerQueueClearResult> {
  return postSignedToWorker<IntegrationWorkerQueueClearResult>("/api/integration-worker/queue/clear");
}

function requiredValue(environmentVariable: Environment): string {
  const value = envConfig.value(environmentVariable);
  if (!value) {
    throw new Error(`Environment variable '${environmentVariable}' must be set`);
  }
  return value;
}
