import debug from "debug";
import { isString } from "es-toolkit/compat";
import express, { Request, Response } from "express";
import { verifyRamblersUploadSignature, decryptRamblersUploadPayload } from "./integration-worker-crypto";
import { envConfig } from "../env-config/env-config";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import {
  RamblersUploadCredentials,
  IntegrationWorkerAwsCredentials,
  IntegrationWorkerEventType,
  IntegrationWorkerJobRequest,
  IntegrationWorkerProgressCallbackRequest,
  IntegrationWorkerResultCallbackRequest
} from "../../../projects/ngx-ramblers/src/app/models/integration-worker.model";
import { executeRamblersUploadJobOnWorker } from "./integration-worker-runner";
import * as auditNotifier from "./ramblers-upload-audit-notifier";
import * as auditParser from "./ramblers-audit-parser";
import { MessageType } from "../../../projects/ngx-ramblers/src/app/models/websocket.model";
import { Status } from "../../../projects/ngx-ramblers/src/app/models/ramblers-upload-audit.model";
import { activateRamblersUploadSession, currentRamblersUploadSession } from "./ramblers-upload-session-registry";

const debugLog = debug(envConfig.logNamespace("integration-worker-routes"));
debugLog.enabled = true;

const router = express.Router();
const queuedJobs: QueuedWorkerJob[] = [];
let activeJobId: string | null = null;

interface QueuedWorkerJob {
  credentials: RamblersUploadCredentials;
  reportUploadCredentials?: IntegrationWorkerAwsCredentials;
  request: IntegrationWorkerJobRequest;
}

router.post("/jobs", async (req: Request, res: Response) => {
  const incomingJobId = (req.body as IntegrationWorkerJobRequest | undefined)?.job?.jobId;
  debugLog("POST /jobs received: jobId:", incomingJobId, "activeJobId:", activeJobId, "queueDepth:", queuedJobs.length);
  try {
    if (!requestIsSigned(req, requiredValue(Environment.INTEGRATION_WORKER_SHARED_SECRET))) {
      debugLog("POST /jobs rejected: invalid signature for jobId:", incomingJobId);
      res.status(401).json({ error: "Invalid upload worker request signature" });
      return;
    }

    const request: IntegrationWorkerJobRequest = req.body;
    let credentials: RamblersUploadCredentials;
    try {
      credentials = decryptRamblersUploadPayload<RamblersUploadCredentials>(
        request.encryptedCredentials,
        requiredValue(Environment.INTEGRATION_WORKER_ENCRYPTION_KEY)
      );
      debugLog("POST /jobs decrypted credentials ok for jobId:", request.job.jobId, "userName present:", !!credentials?.userName, "password present:", !!credentials?.password);
    } catch (error) {
      debugLog("POST /jobs credential decrypt failed for jobId:", request.job.jobId, "error:", (error as Error).message);
      throw error;
    }

    let reportUploadCredentials: IntegrationWorkerAwsCredentials | undefined;
    if (request.encryptedReportUploadCredentials) {
      try {
        reportUploadCredentials = decryptRamblersUploadPayload<IntegrationWorkerAwsCredentials>(
          request.encryptedReportUploadCredentials,
          requiredValue(Environment.INTEGRATION_WORKER_ENCRYPTION_KEY)
        );
        debugLog("POST /jobs decrypted report upload credentials ok for jobId:", request.job.jobId, "accessKeyId present:", !!reportUploadCredentials?.accessKeyId);
      } catch (error) {
        debugLog("POST /jobs report credential decrypt failed for jobId:", request.job.jobId, "error:", (error as Error).message, "— continuing without S3 report upload");
      }
    }

    if (activeJobId) {
      queuedJobs.push({ request, credentials, reportUploadCredentials });
      debugLog("POST /jobs queued: jobId:", request.job.jobId, "queuePosition:", queuedJobs.length, "activeJobId:", activeJobId);
      res.json({
        jobId: request.job.jobId,
        queued: true,
        queuePosition: queuedJobs.length,
        activeJobId
      });
      return;
    }

    activeJobId = request.job.jobId;
    debugLog("POST /jobs starting immediately: jobId:", activeJobId, "fileName:", request.job.data?.fileName, "rowCount:", request.job.data?.rows?.length);
    void executeWorkerJob({ request, credentials, reportUploadCredentials });
    res.json({
      jobId: request.job.jobId,
      queued: false,
      queuePosition: 0,
      activeJobId
    });
  } catch (error) {
    debugLog("POST /jobs error for jobId:", incomingJobId, "error:", (error as Error).message);
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post("/progress", async (req: Request, res: Response) => {
  const incomingJobId = (req.body as IntegrationWorkerProgressCallbackRequest | undefined)?.jobId;
  const incomingType = (req.body as IntegrationWorkerProgressCallbackRequest | undefined)?.type;
  debugLog("POST /progress received: jobId:", incomingJobId, "type:", incomingType);
  try {
    if (!requestIsSigned(req, callbackSecret())) {
      debugLog("POST /progress rejected: invalid signature for jobId:", incomingJobId);
      res.status(401).json({ error: "Invalid upload worker callback signature" });
      return;
    }

    const request: IntegrationWorkerProgressCallbackRequest = req.body;
    const session = currentRamblersUploadSession(request.jobId);

    if (!session) {
      debugLog("POST /progress no active session for jobId:", request.jobId);
      res.status(404).json({ error: `No upload session found for job ${request.jobId}` });
      return;
    }

    activateRamblersUploadSession(request.jobId);
    res.json({ success: true });
    if (request.type === IntegrationWorkerEventType.LIFECYCLE) {
      void auditNotifier.recordLifecycleEvent(request.jobId, request.payload).catch(error => {
        debugLog("recordLifecycleEvent failed jobId:", request.jobId, "error:", (error as Error).message);
      });
    } else if (request.type === IntegrationWorkerEventType.TEST_STEP) {
      const envelope = JSON.parse(request.payload);
      const testStepEvent = envelope?.eventData ?? envelope;
      void auditNotifier.sendAudit(session.ws, {
        messageType: MessageType.PROGRESS,
        auditMessage: testStepEvent,
        parserFunction: auditParser.parseTestStepEvent,
        status: Status.INFO
      }, request.jobId).catch(error => {
        debugLog("test-step sendAudit failed jobId:", request.jobId, "error:", (error as Error).message);
      });
    } else {
      void auditNotifier.sendAudit(session.ws, {
        messageType: MessageType.PROGRESS,
        auditMessage: request.payload,
        parserFunction: auditParser.parseStandardOut,
        status: Status.INFO
      }, request.jobId).catch(error => {
        debugLog("standard-out sendAudit failed jobId:", request.jobId, "error:", (error as Error).message);
      });
    }
  } catch (error) {
    debugLog("POST /progress error for jobId:", incomingJobId, "error:", (error as Error).message);
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post("/result", async (req: Request, res: Response) => {
  const incomingJobId = (req.body as IntegrationWorkerResultCallbackRequest | undefined)?.jobId;
  const incomingStatus = (req.body as IntegrationWorkerResultCallbackRequest | undefined)?.status;
  debugLog("POST /result received: jobId:", incomingJobId, "status:", incomingStatus);
  try {
    if (!requestIsSigned(req, callbackSecret())) {
      debugLog("POST /result rejected: invalid signature for jobId:", incomingJobId);
      res.status(401).json({ error: "Invalid upload worker callback signature" });
      return;
    }

    const request: IntegrationWorkerResultCallbackRequest = req.body;
    const session = currentRamblersUploadSession(request.jobId);

    if (!session) {
      debugLog("POST /result no active session for jobId:", request.jobId);
      res.status(404).json({ error: `No upload session found for job ${request.jobId}` });
      return;
    }

    activateRamblersUploadSession(request.jobId);
    if (request.reportKeyPrefix && request.reportBucket) {
      await auditNotifier.recordReportLocation(request.jobId, request.reportBucket, request.reportKeyPrefix);
    }
    await auditNotifier.sendAudit(session.ws, {
      messageType: MessageType.COMPLETE,
      auditMessage: request.payload || "Upload completed",
      parserFunction: auditParser.parseExit,
      status: (request.status as Status) || Status.INFO
    }, request.jobId);
    debugLog("POST /result forwarded to session for jobId:", incomingJobId, "reportKeyPrefix:", request.reportKeyPrefix);
    res.json({ success: true });
  } catch (error) {
    debugLog("POST /result error for jobId:", incomingJobId, "error:", (error as Error).message);
    res.status(500).json({ error: (error as Error).message });
  }
});

export const integrationWorkerRoutes = router;

async function executeWorkerJob(queuedJob: QueuedWorkerJob): Promise<void> {
  const jobId = queuedJob.request.job.jobId;
  const startedAt = Date.now();
  debugLog("executeWorkerJob: starting jobId:", jobId);
  try {
    await executeRamblersUploadJobOnWorker(
      queuedJob.request.job,
      queuedJob.credentials,
      queuedJob.request.callback,
      callbackSecret(),
      queuedJob.request.reportUpload,
      queuedJob.reportUploadCredentials
    );
    debugLog("executeWorkerJob: finished jobId:", jobId, "elapsedMs:", Date.now() - startedAt);
  } catch (error) {
    debugLog("executeWorkerJob: failed jobId:", jobId, "elapsedMs:", Date.now() - startedAt, "error:", (error as Error).message);
  } finally {
    activeJobId = null;
    void runNextQueuedWorkerJob().catch(error => {
      debugLog("runNextQueuedWorkerJob: unexpected error:", (error as Error).message);
    });
  }
}

async function runNextQueuedWorkerJob(): Promise<void> {
  if (activeJobId) {
    debugLog("runNextQueuedWorkerJob: skip - activeJobId still:", activeJobId);
    return;
  }

  const nextJob = queuedJobs.shift();

  if (!nextJob) {
    debugLog("runNextQueuedWorkerJob: queue empty");
    return;
  }

  activeJobId = nextJob.request.job.jobId;
  debugLog("runNextQueuedWorkerJob: dequeued jobId:", activeJobId, "remainingQueueDepth:", queuedJobs.length);
  await executeWorkerJob(nextJob);
}

function callbackSecret(): string {
  return envConfig.value(Environment.INTEGRATION_WORKER_CALLBACK_SECRET)
    || requiredValue(Environment.INTEGRATION_WORKER_SHARED_SECRET);
}

function requestIsSigned(req: Request, secret: string): boolean {
  const signature = req.headers["x-ramblers-upload-signature"];
  return isString(signature) && verifyRamblersUploadSignature(JSON.stringify(req.body), secret, signature);
}

function requiredValue(environmentVariable: Environment): string {
  const value = envConfig.value(environmentVariable);

  if (!value) {
    throw new Error(`Environment variable '${environmentVariable}' must be set`);
  }

  return value;
}
