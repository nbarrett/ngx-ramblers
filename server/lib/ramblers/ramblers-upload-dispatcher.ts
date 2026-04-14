import WebSocket from "ws";
import debug from "debug";
import { RamblersWalksUploadRequest } from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { buildRamblersUploadJob } from "./ramblers-upload-job-builder";
import { registerUploadStart, reportErrorAndClose, sendAudit } from "./ramblers-upload-audit-notifier";
import { MessageType } from "../../../projects/ngx-ramblers/src/app/models/websocket.model";
import * as auditParser from "./ramblers-audit-parser";
import { Status } from "../../../projects/ngx-ramblers/src/app/models/ramblers-upload-audit.model";
import { envConfig } from "../env-config/env-config";
import { Environment } from "../env-config/environment-model";
import { systemConfig } from "../config/system-config";
import { submitRamblersUploadJobToWorker } from "./ramblers-upload-worker-client";
import { RamblersUploadQueueItem } from "../models/ramblers-upload-execution.model";
import { executeRamblersUploadJob } from "./ramblers-upload-walks";
import { RamblersUploadQueue } from "./ramblers-upload-queue";
import { RamblersUploadCredentials } from "../../../projects/ngx-ramblers/src/app/models/ramblers-upload-worker.model";

const debugLog = debug(envConfig.logNamespace("ramblers-upload-dispatcher"));
debugLog.enabled = true;

const localRamblersUploadQueue = new RamblersUploadQueue((item: RamblersUploadQueueItem) =>
  executeRamblersUploadJob(item.ws, item.job, item.credentials, subprocess => {
    localRamblersUploadQueue.registerActiveCanceller(() => {
      debugLog("cancelling active serenity subprocess pid=", subprocess.pid, "job=", item.job.jobId);
      try {
        subprocess.kill("SIGTERM");
        setTimeout(() => {
          if (!subprocess.killed) {
            debugLog("force-killing subprocess pid=", subprocess.pid);
            subprocess.kill("SIGKILL");
          }
        }, 1500);
        return true;
      } catch (error) {
        debugLog("error killing subprocess:", (error as Error).message);
        return false;
      }
    });
  })
);

export function cancelLocalRamblersUpload(): { cancelledActive: boolean; cancelledQueued: number } {
  debugLog("cancelLocalRamblersUpload invoked");
  return localRamblersUploadQueue.cancelAll();
}

export async function dispatchRamblersWalksUpload(ws: WebSocket, request: RamblersWalksUploadRequest): Promise<void> {
  try {
    debugLog("dispatch request received, file:", request.fileName, "rows:", request.rows?.length, "ramblersUser:", request.ramblersUser);
    const job = buildRamblersUploadJob(request);
    debugLog("job built", job.jobId, "feature:", job.data.feature);
    registerUploadStart(job.data.fileName, ws, job.jobId);

    const workerUrl = envConfig.value(Environment.RAMBLERS_UPLOAD_WORKER_URL);
    if (workerUrl) {
      debugLog("routing to REMOTE worker at", workerUrl, "for job", job.jobId);
      const credentials = await queryRamblersUploadCredentials();
      const result = await submitRamblersUploadJobToWorker(job, credentials);

      if (result.queued) {
        await sendAudit(ws, {
          messageType: MessageType.PROGRESS,
          status: Status.INFO,
          auditMessage: `Upload queued at position ${result.queuePosition} for ${job.data.fileName}`,
          parserFunction: auditParser.parseStandardOut
        }, job.jobId);
      }

      return;
    }

    debugLog("routing to LOCAL in-process queue for job", job.jobId);
    const credentials = await queryRamblersUploadCredentials();
    debugLog("credentials resolved from systemConfig for job", job.jobId, "userName set:", !!credentials.userName, "password set:", !!credentials.password);
    const result = await localRamblersUploadQueue.enqueue({ ws, job, credentials });
    debugLog("enqueue result for job", job.jobId, "queued:", result.queued, "position:", result.queuePosition);

    if (result.queued) {
      await sendAudit(ws, {
        messageType: MessageType.PROGRESS,
        status: Status.INFO,
        auditMessage: `Upload queued at position ${result.queuePosition} for ${job.data.fileName}`,
        parserFunction: auditParser.parseStandardOut
      }, job.jobId);
    }
  } catch (error) {
    reportErrorAndClose(error, ws);
  }
}

async function queryRamblersUploadCredentials(): Promise<RamblersUploadCredentials> {
  const config = await systemConfig();
  const userName = config?.national?.walksManager?.userName;
  const password = config?.national?.walksManager?.password;

  if (!userName || !password) {
    throw new Error("Ramblers walks manager credentials are not configured");
  }

  return { userName, password };
}
