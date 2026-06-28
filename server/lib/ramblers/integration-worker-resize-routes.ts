import debug from "debug";
import { isString } from "es-toolkit/compat";
import express, { Request, Response } from "express";
import { S3 } from "@aws-sdk/client-s3";
import { decryptRamblersUploadPayload, signRamblersUploadBody, verifyRamblersUploadSignature } from "./integration-worker-crypto";
import { envConfig } from "../env-config/env-config";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import {
  IntegrationWorkerAwsCredentials,
  IntegrationWorkerCallbackConfig,
  IntegrationWorkerLogLevel,
  IntegrationWorkerResizeJobRequest,
  IntegrationWorkerResizeProgressCallback,
  IntegrationWorkerResizeResultCallback,
  IntegrationWorkerResultStatus,
  ResizeImageMode
} from "../../../projects/ngx-ramblers/src/app/models/integration-worker.model";
import { resizeSavedImagesToS3, resizeUnsavedImageItems, ResizeReporter } from "../aws/image-resize-engine";
import { dateTimeNowAsValue } from "../shared/dates";
import { integrationWorkerHeavyJobQueue } from "./integration-worker-heavy-job-queue";
import { IntegrationWorkerHeavyJobType } from "../models/integration-worker-heavy-job.model";

const debugLog = debug(envConfig.logNamespace("integration-worker-resize-routes"));
debugLog.enabled = true;

const router = express.Router();

router.post("/jobs", async (req: Request, res: Response) => {
  const incomingJobId = (req.body as IntegrationWorkerResizeJobRequest | undefined)?.jobId;
  const activeJob = integrationWorkerHeavyJobQueue.activeJob();
  debugLog("POST /resize/jobs received: jobId:", incomingJobId, "activeJobId:", activeJob?.jobId, "activeJobType:", activeJob?.type, "queueDepth:", integrationWorkerHeavyJobQueue.queuedJobs().length);
  if (!requestIsSigned(req)) {
    res.status(401).json({ error: "Invalid integration worker request signature" });
    return;
  }
  const request = req.body as IntegrationWorkerResizeJobRequest;
  if (!request?.jobId || !request?.mode || !request?.resizeRequest || !request?.callback) {
    res.status(400).json({ error: "jobId, mode, resizeRequest and callback are required" });
    return;
  }
  const queueResult = integrationWorkerHeavyJobQueue.enqueue({
    jobId: request.jobId,
    type: IntegrationWorkerHeavyJobType.Resize,
    label: `${request.mode} resize`,
    run: () => runResize(request)
  });
  debugLog("POST /resize/jobs queued response: jobId:", request.jobId, "queued:", queueResult.queued, "queuePosition:", queueResult.queuePosition, "activeJobId:", queueResult.activeJobId, "activeJobType:", queueResult.activeJobType);
  if (queueResult.queued) {
    const sharedSecret = envConfig.value(Environment.INTEGRATION_WORKER_SHARED_SECRET) || "";
    void postProgress(request.callback, sharedSecret, {
      jobId: request.jobId,
      level: IntegrationWorkerLogLevel.Info,
      message: `Resize job queued at position ${queueResult.queuePosition} behind ${queueResult.activeJobType} job ${queueResult.activeJobId}`,
      percent: 0,
      queued: true
    });
  }
  res.json({
    accepted: true,
    jobId: request.jobId,
    queued: queueResult.queued,
    queuePosition: queueResult.queuePosition,
    activeJobId: queueResult.activeJobId
  });
});

async function runResize(request: IntegrationWorkerResizeJobRequest): Promise<void> {
  const { jobId, mode, resizeRequest, sourceContentMetadata, awsConfig, encryptedAwsCredentials, callback } = request;
  const sharedSecret = envConfig.value(Environment.INTEGRATION_WORKER_SHARED_SECRET) || "";
  const startedAt = dateTimeNowAsValue();
  const imageCount = mode === ResizeImageMode.UNSAVED
    ? (resizeRequest?.input?.length || 0)
    : (sourceContentMetadata?.files?.length || 0);
  let operationNumber = 0;
  const reporter: ResizeReporter = {
    progress(message: string, percent: number): void {
      operationNumber++;
      debugLog("resize progress jobId:", jobId, "mode:", mode, "op:", operationNumber, "percent:", percent, "elapsedMs:", dateTimeNowAsValue() - startedAt, "-", message);
      void postProgress(callback, sharedSecret, { jobId, level: IntegrationWorkerLogLevel.Info, message, percent });
    }
  };
  debugLog("resize job started jobId:", jobId, "mode:", mode, "images:", imageCount,
    "maxFileSize:", resizeRequest?.maxFileSize, "bucket:", awsConfig?.bucket, "region:", awsConfig?.region,
    "rootFolder:", sourceContentMetadata?.rootFolder, "name:", sourceContentMetadata?.name);

  try {
    if (mode === ResizeImageMode.UNSAVED) {
      const outputItems = await resizeUnsavedImageItems(resizeRequest, reporter);
      debugLog("resize job finished jobId:", jobId, "mode:", mode, "operations:", operationNumber, "outputItems:", outputItems?.length, "elapsedMs:", dateTimeNowAsValue() - startedAt);
      await postResult(callback, sharedSecret, { jobId, status: IntegrationWorkerResultStatus.Success, outputItems });
    } else {
      if (!sourceContentMetadata || !awsConfig || !encryptedAwsCredentials) {
        throw new Error("sourceContentMetadata, awsConfig and encryptedAwsCredentials are required for saved-image resize");
      }
      const credentials = decryptRamblersUploadPayload<IntegrationWorkerAwsCredentials>(
        encryptedAwsCredentials,
        requiredValue(Environment.INTEGRATION_WORKER_ENCRYPTION_KEY)
      );
      const s3 = new S3({
        region: awsConfig.region,
        credentials: { accessKeyId: credentials.accessKeyId, secretAccessKey: credentials.secretAccessKey }
      });
      const result = await resizeSavedImagesToS3(s3, awsConfig.bucket, resizeRequest, sourceContentMetadata, reporter);
      debugLog("resize job finished jobId:", jobId, "mode:", mode, "operations:", operationNumber,
        "action:", result.action, "files:", result.contentMetadata?.files?.length, "elapsedMs:", dateTimeNowAsValue() - startedAt);
      await postResult(callback, sharedSecret, {
        jobId,
        status: IntegrationWorkerResultStatus.Success,
        action: result.action,
        contentMetadata: result.contentMetadata
      });
    }
  } catch (error) {
    const errorMessage = (error as Error)?.message || "Image resize failed";
    debugLog("resize job failed jobId:", jobId, "mode:", mode, "operations:", operationNumber, "elapsedMs:", dateTimeNowAsValue() - startedAt, "error:", errorMessage);
    await postResult(callback, sharedSecret, { jobId, status: IntegrationWorkerResultStatus.Error, errorMessage });
  }
}

async function postProgress(callback: IntegrationWorkerCallbackConfig, sharedSecret: string, payload: IntegrationWorkerResizeProgressCallback): Promise<void> {
  try {
    await postSigned(`${callback.baseUrl}${callback.progressPath}`, sharedSecret, payload);
  } catch (error) {
    debugLog("resize progress callback failed jobId:", payload.jobId, "error:", (error as Error).message);
  }
}

async function postResult(callback: IntegrationWorkerCallbackConfig, sharedSecret: string, payload: IntegrationWorkerResizeResultCallback): Promise<void> {
  try {
    await postSigned(`${callback.baseUrl}${callback.resultPath}`, sharedSecret, payload);
  } catch (error) {
    debugLog("resize result callback failed jobId:", payload.jobId, "error:", (error as Error).message);
  }
}

async function postSigned(url: string, sharedSecret: string, payload: object): Promise<void> {
  const body = JSON.stringify(payload);
  const signature = signRamblersUploadBody(body, sharedSecret);
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-ramblers-upload-signature": signature },
    body
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Resize callback ${url} failed with status ${response.status}: ${text}`);
  }
}

function requestIsSigned(req: Request): boolean {
  const secret = envConfig.value(Environment.INTEGRATION_WORKER_SHARED_SECRET);
  if (!secret) {
    return false;
  }
  const signature = req.header("x-ramblers-upload-signature") || "";
  return isString(signature) && verifyRamblersUploadSignature(JSON.stringify(req.body ?? {}), secret, signature);
}

function requiredValue(environmentVariable: Environment): string {
  const value = envConfig.value(environmentVariable);
  if (!value) {
    throw new Error(`Environment variable '${environmentVariable}' must be set`);
  }
  return value;
}

export const integrationWorkerResizeRoutes = router;
