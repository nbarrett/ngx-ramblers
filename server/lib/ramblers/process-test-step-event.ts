import { envConfig } from "../env-config/env-config";
import debug from "debug";
import {
  DomainEventData,
  DomainEventDataWithFinished
} from "../../../projects/ngx-ramblers/src/app/models/ramblers-upload-audit.model";
import WebSocket from "ws";
import * as auditNotifier from "./ramblers-upload-audit-notifier";
import * as auditParser from "./ramblers-audit-parser";
import { MessageType } from "../../../projects/ngx-ramblers/src/app/models/websocket.model";
import { activeRamblersUploadJobId, currentRamblersUploadSession } from "./ramblers-upload-session-registry";
import {
  remoteRamblersUploadExecutionState,
  setRemoteRamblersUploadStandardOutLogging
} from "./ramblers-upload-worker-execution-state";
import { postRamblersUploadProgressCallback } from "./ramblers-upload-worker-callback-client";
import { RamblersUploadWorkerEventType } from "../../../projects/ngx-ramblers/src/app/models/ramblers-upload-worker.model";

const debugLog: debug.Debugger = debug(envConfig.logNamespace("process-test-step-event"));
debugLog.enabled = false;

export async function processTestStepEvent(ws: WebSocket, data: string): Promise<void> {
  try {
    const testStepEventWithFinished: DomainEventDataWithFinished = JSON.parse(data);
    const testStepEvent: DomainEventData = testStepEventWithFinished.eventData;
    const remoteExecutionState = remoteRamblersUploadExecutionState();

    if (remoteExecutionState) {
      if (testStepEvent.finished && !remoteExecutionState.logStandardOut) {
        setRemoteRamblersUploadStandardOutLogging(true);
      } else if (remoteExecutionState.logStandardOut) {
        setRemoteRamblersUploadStandardOutLogging(false);
      }

      await postRamblersUploadProgressCallback(remoteExecutionState.callback, remoteExecutionState.sharedSecret, {
        jobId: remoteExecutionState.jobId,
        type: RamblersUploadWorkerEventType.TEST_STEP,
        payload: JSON.stringify(testStepEvent)
      });
      return;
    }

    const jobId = activeRamblersUploadJobId();

    if (!jobId) {
      return;
    }

    const currentUploadSession = auditNotifier.queryCurrentUploadSession(jobId);

    if (currentUploadSession) {
      if (testStepEvent.finished && !currentUploadSession.logStandardOut) {
        auditNotifier.toggleStandardOutLogging(true, jobId);
      } else if (currentUploadSession.logStandardOut) {
        auditNotifier.toggleStandardOutLogging(false, jobId);
      }
    }
    debugLog("testStepEvent event received:", testStepEvent?.details?.name, "with outcome:", testStepEvent?.outcome?.code);
    const uploadSocket = currentRamblersUploadSession(jobId)?.ws || ws;

    await auditNotifier.sendAudit(uploadSocket, {
      messageType: MessageType.PROGRESS,
      auditMessage: testStepEvent,
      parserFunction: auditParser.parseTestStepEvent
    }, jobId);
  } catch (error) {
    debugLog("❌ Error processing test step event:", error);
  }
}
