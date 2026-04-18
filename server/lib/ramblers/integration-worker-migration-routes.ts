import debug from "debug";
import { isObject, isString } from "es-toolkit/compat";
import express, { Request, Response } from "express";
import { verifyRamblersUploadSignature, signRamblersUploadBody } from "./integration-worker-crypto";
import { envConfig } from "../env-config/env-config";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import {
  IntegrationWorkerCallbackConfig,
  IntegrationWorkerMigrationJobRequest,
  IntegrationWorkerMigrationProgressCallback,
  IntegrationWorkerMigrationResultCallback
} from "../../../projects/ngx-ramblers/src/app/models/integration-worker.model";
import { MigrationResult } from "../../../projects/ngx-ramblers/src/app/models/migration-scraping.model";
import { migrateStaticSite } from "../migration/migrate-static-site-engine";
import { setErrorSender, setProgressSender } from "../migration/migration-progress";

const debugLog = debug(envConfig.logNamespace("integration-worker-migration-routes"));
debugLog.enabled = true;

const router = express.Router();
let activeMigrationJobId: string | null = null;

router.post("/jobs", async (req: Request, res: Response) => {
  const incomingJobId = (req.body as IntegrationWorkerMigrationJobRequest | undefined)?.jobId;
  debugLog("POST /migration/jobs received: jobId:", incomingJobId, "activeJobId:", activeMigrationJobId);
  if (!requestIsSigned(req)) {
    res.status(401).json({ error: "Invalid integration worker request signature" });
    return;
  }
  const request = req.body as IntegrationWorkerMigrationJobRequest;
  if (!request?.jobId || !request?.siteConfig || !request?.callback) {
    res.status(400).json({ error: "jobId, siteConfig and callback are required" });
    return;
  }
  if (activeMigrationJobId) {
    res.status(409).json({ error: `Migration job already active: ${activeMigrationJobId}` });
    return;
  }
  activeMigrationJobId = request.jobId;
  res.json({ accepted: true, jobId: request.jobId });
  void runMigration(request).finally(() => {
    activeMigrationJobId = null;
  });
});

async function runMigration(request: IntegrationWorkerMigrationJobRequest): Promise<void> {
  const { jobId, siteConfig, persistData, uploadTos3, callback } = request;
  const sharedSecret = envConfig.value(Environment.INTEGRATION_WORKER_SHARED_SECRET) || "";

  setProgressSender((data: any) => {
    void postProgress(callback, sharedSecret, {
      jobId,
      level: "info",
      message: normaliseMessage(data)
    });
  });
  setErrorSender((data: any) => {
    void postProgress(callback, sharedSecret, {
      jobId,
      level: "error",
      message: normaliseMessage(data)
    });
  });

  let result: MigrationResult | null = null;
  let errorMessage: string | null = null;
  try {
    result = await migrateStaticSite({ ...siteConfig, persistData, uploadTos3 });
  } catch (error) {
    errorMessage = (error as Error)?.message || "Migration failed";
    debugLog("migration job failed jobId:", jobId, "error:", errorMessage);
  } finally {
    setProgressSender(null);
    setErrorSender(null);
  }

  await postResult(callback, sharedSecret, {
    jobId,
    status: errorMessage ? "error" : "success",
    result: result || undefined,
    errorMessage: errorMessage || undefined
  });
}

function normaliseMessage(payload: any): string {
  if (payload === undefined || payload === null) {
    return "";
  }
  if (isString(payload)) {
    return payload;
  }
  if (isObject(payload) && "message" in payload && isString((payload as { message: unknown }).message)) {
    return (payload as { message: string }).message;
  }
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
}

async function postProgress(callback: IntegrationWorkerCallbackConfig, sharedSecret: string, payload: IntegrationWorkerMigrationProgressCallback): Promise<void> {
  try {
    await postSigned(`${callback.baseUrl}${callback.progressPath}`, sharedSecret, payload);
  } catch (error) {
    debugLog("progress callback failed jobId:", payload.jobId, "error:", (error as Error).message);
  }
}

async function postResult(callback: IntegrationWorkerCallbackConfig, sharedSecret: string, payload: IntegrationWorkerMigrationResultCallback): Promise<void> {
  try {
    await postSigned(`${callback.baseUrl}${callback.resultPath}`, sharedSecret, payload);
  } catch (error) {
    debugLog("result callback failed jobId:", payload.jobId, "error:", (error as Error).message);
  }
}

async function postSigned(url: string, sharedSecret: string, payload: object): Promise<void> {
  const body = JSON.stringify(payload);
  const signature = signRamblersUploadBody(body, sharedSecret);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-ramblers-upload-signature": signature
    },
    body
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Migration callback ${url} failed with status ${response.status}: ${text}`);
  }
}

function requestIsSigned(req: Request): boolean {
  const secret = envConfig.value(Environment.INTEGRATION_WORKER_SHARED_SECRET);
  if (!secret) {
    return false;
  }
  const signature = req.header("x-ramblers-upload-signature") || "";
  const body = JSON.stringify(req.body ?? {});
  return verifyRamblersUploadSignature(body, secret, signature);
}

export const integrationWorkerMigrationRoutes = router;
