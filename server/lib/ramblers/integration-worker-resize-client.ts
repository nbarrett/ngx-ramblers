import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import { encryptRamblersUploadPayload, signRamblersUploadBody } from "./integration-worker-crypto";
import {
  IntegrationWorkerAwsCredentials,
  IntegrationWorkerCallbackConfig,
  IntegrationWorkerResizeJobRequest,
  ResizeImageMode
} from "../../../projects/ngx-ramblers/src/app/models/integration-worker.model";
import {
  ContentMetadata,
  ContentMetadataResizeRequest
} from "../../../projects/ngx-ramblers/src/app/models/content-metadata.model";

const debugLog = debug(envConfig.logNamespace("integration-worker-resize-client"));
debugLog.enabled = true;

export function integrationWorkerConfiguredForResize(): boolean {
  return !!envConfig.value(Environment.INTEGRATION_WORKER_URL);
}

export async function submitResizeJobToIntegrationWorker(jobId: string, mode: ResizeImageMode, resizeRequest: ContentMetadataResizeRequest, sourceContentMetadata?: ContentMetadata): Promise<void> {
  const workerUrl = required(Environment.INTEGRATION_WORKER_URL);
  const sharedSecret = required(Environment.INTEGRATION_WORKER_SHARED_SECRET);
  const callbackBaseUrl = envConfig.value(Environment.INTEGRATION_WORKER_CALLBACK_BASE_URL) || envConfig.value(Environment.BASE_URL);
  if (!callbackBaseUrl) {
    throw new Error(`Environment variable '${Environment.INTEGRATION_WORKER_CALLBACK_BASE_URL}' or '${Environment.BASE_URL}' must be set to submit resize jobs`);
  }
  const callback: IntegrationWorkerCallbackConfig = {
    baseUrl: callbackBaseUrl,
    progressPath: "/api/integration-worker/resize/progress",
    resultPath: "/api/integration-worker/resize/result"
  };

  const request: IntegrationWorkerResizeJobRequest = { jobId, mode, resizeRequest, callback };
  if (mode === ResizeImageMode.SAVED) {
    const encryptionKey = required(Environment.INTEGRATION_WORKER_ENCRYPTION_KEY);
    const aws = envConfig.aws();
    if (!aws?.accessKeyId || !aws?.secretAccessKey || !aws?.bucket || !aws?.region) {
      throw new Error("AWS bucket, region and credentials must be configured to resize saved images on the integration worker");
    }
    request.sourceContentMetadata = sourceContentMetadata;
    request.awsConfig = { bucket: aws.bucket, region: aws.region };
    request.encryptedAwsCredentials = encryptRamblersUploadPayload<IntegrationWorkerAwsCredentials>({
      accessKeyId: aws.accessKeyId,
      secretAccessKey: aws.secretAccessKey
    }, encryptionKey);
  }

  const body = JSON.stringify(request);
  const signature = signRamblersUploadBody(body, sharedSecret);
  const endpoint = `${workerUrl.replace(/\/+$/, "")}/api/integration-worker/resize/jobs`;
  debugLog("-> submit resize jobId:", jobId, "mode:", mode, "endpoint:", endpoint, "bytes:", body.length);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", "x-ramblers-upload-signature": signature },
    body
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Integration worker resize submit failed with status ${response.status}: ${text}`);
  }
}

function required(key: Environment): string {
  const value = envConfig.value(key);
  if (!value) {
    throw new Error(`Environment variable '${key}' must be set to call the integration worker resize API`);
  }
  return value;
}
