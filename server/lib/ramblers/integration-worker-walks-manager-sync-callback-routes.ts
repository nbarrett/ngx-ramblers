import debug from "debug";
import express, { Request, Response } from "express";
import { verifyRamblersUploadSignature } from "./integration-worker-crypto";
import { envConfig } from "../env-config/env-config";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import {
  IntegrationWorkerWalksManagerSyncProgressCallback,
  IntegrationWorkerWalksManagerSyncResultCallback
} from "../../../projects/ngx-ramblers/src/app/models/integration-worker.model";
import { completeWalksManagerSyncSession, walksManagerSyncSession } from "../walks/walks-manager-sync-session";

const debugLog = debug(envConfig.logNamespace("integration-worker-walks-manager-sync-callback-routes"));
const router = express.Router();

function requestIsSigned(req: Request): boolean {
  const secret = envConfig.value(Environment.INTEGRATION_WORKER_SHARED_SECRET);
  const signature = req.header("x-ramblers-upload-signature") || "";
  const body = JSON.stringify(req.body ?? {});
  return !!secret && verifyRamblersUploadSignature(body, secret, signature);
}

router.post("/progress", async (req: Request, res: Response) => {
  if (!requestIsSigned(req)) {
    res.status(401).json({error: "Invalid integration worker callback signature"});
  } else {
    const body = req.body as IntegrationWorkerWalksManagerSyncProgressCallback;
    const session = walksManagerSyncSession(body?.jobId);
    if (!session) {
      debugLog("progress: no session for jobId:", body?.jobId);
      res.status(404).json({error: `No walks manager sync session for jobId ${body?.jobId}`});
    } else {
      session.onProgress(body);
      res.json({ok: true});
    }
  }
});

router.post("/result", async (req: Request, res: Response) => {
  if (!requestIsSigned(req)) {
    res.status(401).json({error: "Invalid integration worker callback signature"});
  } else {
    const body = req.body as IntegrationWorkerWalksManagerSyncResultCallback;
    const session = walksManagerSyncSession(body?.jobId);
    if (!session) {
      debugLog("result: no session for jobId:", body?.jobId);
      res.status(404).json({error: `No walks manager sync session for jobId ${body?.jobId}`});
    } else {
      try {
        session.onResult(body);
      } finally {
        completeWalksManagerSyncSession(body.jobId);
      }
      res.json({ok: true});
    }
  }
});

export const integrationWorkerWalksManagerSyncCallbackRoutes = router;
