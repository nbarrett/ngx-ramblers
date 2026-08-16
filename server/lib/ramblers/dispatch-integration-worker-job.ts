import WebSocket from "ws";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import { IntegrationWorkerJobResponse, RamblersUploadCredentials } from "../../../projects/ngx-ramblers/src/app/models/integration-worker.model";
import { RamblersUploadJob } from "../../../projects/ngx-ramblers/src/app/models/ramblers-upload-job.model";
import { MessageType } from "../../../projects/ngx-ramblers/src/app/models/websocket.model";
import { Status } from "../../../projects/ngx-ramblers/src/app/models/ramblers-upload-audit.model";
import { registerUploadStart, reportErrorAndClose, sendAudit } from "./ramblers-upload-audit-notifier";
import * as auditParser from "./ramblers-audit-parser";
import { submitRamblersUploadJobToWorker } from "./integration-worker-client";
import { downloadStatusManager } from "./download-status-manager";

const debugLog = debug(envConfig.logNamespace("dispatch-integration-worker-job"));
debugLog.enabled = true;

export function detachedAuditSocket(): WebSocket {
  return {close() {}} as WebSocket;
}

export async function dispatchRemoteIntegrationWorkerJob(
  job: RamblersUploadJob,
  credentials: RamblersUploadCredentials,
  ws: WebSocket
): Promise<IntegrationWorkerJobResponse> {
  registerUploadStart(job.data.fileName, ws, job.jobId, job.data.feature);
  downloadStatusManager.startDownload(job.data.fileName);
  debugLog("submitting job", job.jobId, "fileName:", job.data.fileName, "feature:", job.data.feature);
  try {
    const result = await submitRamblersUploadJobToWorker(job, credentials);
    if (result.queued) {
      await sendAudit(ws, {
        messageType: MessageType.PROGRESS,
        status: Status.INFO,
        auditMessage: `Upload queued at position ${result.queuePosition} for ${job.data.fileName}`,
        parserFunction: auditParser.parseStandardOut
      }, job.jobId);
    }
    return {...result, fileName: job.data.fileName};
  } catch (error) {
    reportErrorAndClose(error, ws);
    throw error;
  }
}

export function integrationWorkerConfigured(): boolean {
  return !!envConfig.value(Environment.INTEGRATION_WORKER_URL);
}