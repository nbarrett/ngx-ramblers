import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import {
  RamblersUploadCredentials,
  IntegrationWorkerAwsCredentials,
  IntegrationWorkerJobRequest,
  IntegrationWorkerJobResponse
} from "../../../projects/ngx-ramblers/src/app/models/integration-worker.model";
import { RamblersUploadJob } from "../../../projects/ngx-ramblers/src/app/models/ramblers-upload-job.model";
import { encryptRamblersUploadPayload, signRamblersUploadBody } from "./integration-worker-crypto";

const debugLog = debug(envConfig.logNamespace("integration-worker-client"));
debugLog.enabled = true;

export async function submitRamblersUploadJobToWorker(job: RamblersUploadJob, credentials: RamblersUploadCredentials): Promise<IntegrationWorkerJobResponse> {
  const workerUrl = requiredValue(Environment.INTEGRATION_WORKER_URL);
  const encryptionKey = requiredValue(Environment.INTEGRATION_WORKER_ENCRYPTION_KEY);
  const sharedSecret = requiredValue(Environment.INTEGRATION_WORKER_SHARED_SECRET);
  const callbackBaseUrl = envConfig.value(Environment.INTEGRATION_WORKER_CALLBACK_BASE_URL) || envConfig.value(Environment.BASE_URL);

  if (!callbackBaseUrl) {
    throw new Error(`Environment variable '${Environment.INTEGRATION_WORKER_CALLBACK_BASE_URL}' or '${Environment.BASE_URL}' must be set`);
  }

  const awsBucket = envConfig.value(Environment.AWS_BUCKET);
  const awsRegion = envConfig.value(Environment.AWS_REGION);
  const awsAccessKeyId = envConfig.value(Environment.AWS_ACCESS_KEY_ID);
  const awsSecretAccessKey = envConfig.value(Environment.AWS_SECRET_ACCESS_KEY);
  const reportUploadAvailable = !!(awsBucket && awsRegion && awsAccessKeyId && awsSecretAccessKey);

  const reportKeyPrefix = `ramblers-upload-reports/${job.data.fileName.replace(/\.csv$/, "")}`;

  const request: IntegrationWorkerJobRequest = {
    job,
    encryptedCredentials: encryptRamblersUploadPayload(credentials, encryptionKey),
    encryptedReportUploadCredentials: reportUploadAvailable
      ? encryptRamblersUploadPayload<IntegrationWorkerAwsCredentials>({
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey
      }, encryptionKey)
      : undefined,
    reportUpload: reportUploadAvailable
      ? {bucket: awsBucket, region: awsRegion, keyPrefix: reportKeyPrefix}
      : undefined,
    callback: {
      baseUrl: callbackBaseUrl,
      progressPath: "/api/integration-worker/progress",
      resultPath: "/api/integration-worker/result"
    }
  };
  const body = JSON.stringify(request);
  const signature = signRamblersUploadBody(body, sharedSecret);
  debugLog("submitRamblersUploadJobToWorker: jobId:", job.jobId, "workerUrl:", workerUrl, "callbackBaseUrl:", callbackBaseUrl, "bodyBytes:", body.length, "fileName:", job.data?.fileName, "rowCount:", job.data?.rows?.length, "uploads:", job.data?.walkIdUploadList?.length, "deletions:", job.data?.walkIdDeletionList?.length);
  const submissionStart = Date.now();
  let response: Awaited<ReturnType<typeof fetch>>;
  try {
    response = await fetch(`${workerUrl}/api/integration-worker/jobs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ramblers-upload-signature": signature
      },
      body
    });
  } catch (error) {
    debugLog("submitRamblersUploadJobToWorker: fetch failed for jobId:", job.jobId, "elapsedMs:", Date.now() - submissionStart, "error:", (error as Error).message);
    throw error;
  }
  debugLog("submitRamblersUploadJobToWorker: response for jobId:", job.jobId, "status:", response.status, "elapsedMs:", Date.now() - submissionStart);

  if (!response.ok) {
    const responseBody = await response.text();
    debugLog("submitRamblersUploadJobToWorker: non-ok response body for jobId:", job.jobId, "body:", responseBody);
    throw new Error(`Worker submission failed with status ${response.status}: ${responseBody}`);
  }

  const parsed = await response.json() as IntegrationWorkerJobResponse;
  debugLog("submitRamblersUploadJobToWorker: parsed response for jobId:", job.jobId, "queued:", parsed.queued, "queuePosition:", parsed.queuePosition, "activeJobId:", parsed.activeJobId);
  return parsed;
}

function requiredValue(environmentVariable: Environment): string {
  const value = envConfig.value(environmentVariable);

  if (!value) {
    throw new Error(`Environment variable '${environmentVariable}' must be set`);
  }

  return value;
}
