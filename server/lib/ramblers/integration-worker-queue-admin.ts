import { Request, Response } from "express";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import {
  cancelActiveWorkerQueueJob,
  clearWorkerQueue,
  fetchWorkerQueueStatus,
  integrationWorkerConfigured
} from "./integration-worker-queue-client";

const debugLog = debug(envConfig.logNamespace("integration-worker-queue-admin"));
debugLog.enabled = true;

export async function workerQueueStatus(req: Request, res: Response): Promise<void> {
  if (!integrationWorkerConfigured()) {
    res.json({activeJob: null, queuedJobs: [], workerConfigured: false});
  } else {
    try {
      const status = await fetchWorkerQueueStatus();
      res.json({...status, workerConfigured: true});
    } catch (error) {
      debugLog("workerQueueStatus failed:", (error as Error).message);
      res.status(502).json({error: (error as Error).message});
    }
  }
}

export async function workerQueueCancelActive(req: Request, res: Response): Promise<void> {
  try {
    res.json(await cancelActiveWorkerQueueJob());
  } catch (error) {
    debugLog("workerQueueCancelActive failed:", (error as Error).message);
    res.status(502).json({error: (error as Error).message});
  }
}

export async function workerQueueClear(req: Request, res: Response): Promise<void> {
  try {
    res.json(await clearWorkerQueue());
  } catch (error) {
    debugLog("workerQueueClear failed:", (error as Error).message);
    res.status(502).json({error: (error as Error).message});
  }
}
