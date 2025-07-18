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

const debugLog: debug.Debugger = debug(envConfig.logNamespace("process-test-step-event"));
debugLog.enabled = false;

export async function processTestStepEvent(ws: WebSocket, data: string): Promise<void> {
  try {
    const testStepEventWithFinished: DomainEventDataWithFinished = JSON.parse(data);
    const testStepEvent: DomainEventData = testStepEventWithFinished.eventData;
    const currentUploadSession = auditNotifier.queryCurrentUploadSession();
    if (testStepEvent.finished && !currentUploadSession.logStandardOut) {
      auditNotifier.toggleStandardOutLogging(true);
    } else if (currentUploadSession.logStandardOut) {
      auditNotifier.toggleStandardOutLogging(false);
    }
    debugLog("testStepEvent event received:", testStepEvent?.details?.name, "with outcome:", testStepEvent?.outcome?.code);
    await auditNotifier.sendAudit(ws, {
      messageType: MessageType.PROGRESS,
      auditMessage: testStepEvent,
      parserFunction: auditParser.parseTestStepEvent
    });
  } catch (error) {
    debugLog("❌ Error processing test step event:", error);
  }
}
