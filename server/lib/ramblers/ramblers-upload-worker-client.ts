import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { Environment } from "../env-config/environment-model";
import {
  RamblersUploadCredentials,
  RamblersUploadWorkerJobRequest,
  RamblersUploadWorkerJobResponse
} from "../../../projects/ngx-ramblers/src/app/models/ramblers-upload-worker.model";
import { RamblersUploadJob } from "../../../projects/ngx-ramblers/src/app/models/ramblers-upload-job.model";
import { encryptRamblersUploadPayload, signRamblersUploadBody } from "./ramblers-upload-worker-crypto";

const debugLog = debug(envConfig.logNamespace("ramblers-upload-worker-client"));
debugLog.enabled = true;

export async function submitRamblersUploadJobToWorker(job: RamblersUploadJob, credentials: RamblersUploadCredentials): Promise<RamblersUploadWorkerJobResponse> {
  const workerUrl = requiredValue(Environment.RAMBLERS_UPLOAD_WORKER_URL);
  const encryptionKey = requiredValue(Environment.RAMBLERS_UPLOAD_WORKER_ENCRYPTION_KEY);
  const sharedSecret = requiredValue(Environment.RAMBLERS_UPLOAD_WORKER_SHARED_SECRET);
  const callbackBaseUrl = envConfig.value(Environment.RAMBLERS_UPLOAD_WORKER_CALLBACK_BASE_URL) || envConfig.value(Environment.BASE_URL);

  if (!callbackBaseUrl) {
    throw new Error(`Environment variable '${Environment.RAMBLERS_UPLOAD_WORKER_CALLBACK_BASE_URL}' or '${Environment.BASE_URL}' must be set`);
  }

  const request: RamblersUploadWorkerJobRequest = {
    job,
    encryptedCredentials: encryptRamblersUploadPayload(credentials, encryptionKey),
    callback: {
      baseUrl: callbackBaseUrl,
      progressPath: "/api/ramblers-upload-worker/progress",
      resultPath: "/api/ramblers-upload-worker/result"
    }
  };
  const body = JSON.stringify(request);
  const signature = signRamblersUploadBody(body, sharedSecret);
  debugLog("submitRamblersUploadJobToWorker: jobId:", job.jobId, "workerUrl:", workerUrl, "callbackBaseUrl:", callbackBaseUrl, "bodyBytes:", body.length, "fileName:", job.data?.fileName, "rowCount:", job.data?.rows?.length, "uploads:", job.data?.walkIdUploadList?.length, "deletions:", job.data?.walkIdDeletionList?.length);
  const submissionStart = Date.now();
  let response: Awaited<ReturnType<typeof fetch>>;
  try {
    response = await fetch(`${workerUrl}/api/ramblers-upload-worker/jobs`, {
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

  const parsed = await response.json() as RamblersUploadWorkerJobResponse;
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
