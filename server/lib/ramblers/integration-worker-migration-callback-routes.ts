import debug from "debug";
import express, { Request, Response } from "express";
import { verifyRamblersUploadSignature } from "./integration-worker-crypto";
import { envConfig } from "../env-config/env-config";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import {
  IntegrationWorkerMigrationProgressCallback,
  IntegrationWorkerMigrationResultCallback
} from "../../../projects/ngx-ramblers/src/app/models/integration-worker.model";
import { completeMigrationSession, currentMigrationSession } from "../migration/migration-session-registry";
import { emitMigrationProgress, emitMigrationResult } from "../migration/migration-notifier";

const debugLog = debug(envConfig.logNamespace("integration-worker-migration-callback-routes"));
debugLog.enabled = true;

const router = express.Router();

router.post("/progress", async (req: Request, res: Response) => {
  if (!requestIsSigned(req)) {
    res.status(401).json({ error: "Invalid integration worker callback signature" });
    return;
  }
  const body = req.body as IntegrationWorkerMigrationProgressCallback;
  const session = currentMigrationSession(body?.jobId);
  if (!session) {
    debugLog("progress: no active migration session for jobId:", body?.jobId);
    res.status(404).json({ error: `No migration session for jobId ${body?.jobId}` });
    return;
  }
  await emitMigrationProgress(session, body);
  res.json({ ok: true });
});

router.post("/result", async (req: Request, res: Response) => {
  if (!requestIsSigned(req)) {
    res.status(401).json({ error: "Invalid integration worker callback signature" });
    return;
  }
  const body = req.body as IntegrationWorkerMigrationResultCallback;
  const session = currentMigrationSession(body?.jobId);
  if (!session) {
    debugLog("result: no active migration session for jobId:", body?.jobId);
    res.status(404).json({ error: `No migration session for jobId ${body?.jobId}` });
    return;
  }
  try {
    await emitMigrationResult(session, body);
  } finally {
    completeMigrationSession(body.jobId);
  }
  res.json({ ok: true });
});

function requestIsSigned(req: Request): boolean {
  const secret = envConfig.value(Environment.INTEGRATION_WORKER_SHARED_SECRET);
  if (!secret) {
    return false;
  }
  const signature = req.header("x-ramblers-upload-signature") || "";
  const body = JSON.stringify(req.body ?? {});
  return verifyRamblersUploadSignature(body, secret, signature);
}

export const integrationWorkerMigrationCallbackRoutes = router;
