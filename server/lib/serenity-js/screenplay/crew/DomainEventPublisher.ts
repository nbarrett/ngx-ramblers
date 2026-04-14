import { LogicError, Stage, StageCrewMember } from "@serenity-js/core";
import { DomainEvent, InteractionFinished, SceneParametersDetected, TaskFinished, TestSuiteFinished } from "@serenity-js/core/lib/events";
import debug from "debug";
import WebSocket from "ws";
import { envConfig } from "../../../env-config/env-config";
import { EventType } from "../../../../../projects/ngx-ramblers/src/app/models/websocket.model";
import { createWebSocketClient } from "../../../websockets/websocket-client";
import {
  DomainEventDataWithFinished
} from "../../../../../projects/ngx-ramblers/src/app/models/ramblers-upload-audit.model";
import { Environment } from "../../../env-config/environment-model";
import { postRamblersUploadProgressCallback } from "../../../ramblers/ramblers-upload-worker-callback-client";
import {
  RamblersUploadWorkerCallbackConfig,
  RamblersUploadWorkerEventType
} from "../../../../../projects/ngx-ramblers/src/app/models/ramblers-upload-worker.model";

const debugLog = debug(envConfig.logNamespace("domain-event-publisher"));
debugLog.enabled = true;

export class DomainEventPublisher implements StageCrewMember {
  static withDefaults() {
    const callbackBaseUrl = process.env[Environment.RAMBLERS_UPLOAD_WORKER_CALLBACK_BASE_URL];
    const callbackProgressPath = process.env[Environment.RAMBLERS_UPLOAD_WORKER_CALLBACK_PROGRESS_PATH];
    const sharedSecret = process.env[Environment.RAMBLERS_UPLOAD_WORKER_CALLBACK_SECRET];
    const jobId = process.env[Environment.RAMBLERS_UPLOAD_WORKER_JOB_ID];

    debugLog("withDefaults env:", {
      hasBaseUrl: !!callbackBaseUrl,
      hasProgressPath: !!callbackProgressPath,
      hasSecret: !!sharedSecret,
      hasJobId: !!jobId,
      baseUrl: callbackBaseUrl,
      progressPath: callbackProgressPath,
      jobId
    });

    if (callbackBaseUrl && callbackProgressPath && sharedSecret && jobId) {
      const callback: RamblersUploadWorkerCallbackConfig = {
        baseUrl: callbackBaseUrl,
        progressPath: callbackProgressPath,
        resultPath: process.env[Environment.RAMBLERS_UPLOAD_WORKER_CALLBACK_RESULT_PATH] || ""
      };
      debugLog("withDefaults: using direct callback path");
      return new DomainEventPublisher(null, callback, sharedSecret, jobId);
    }

    debugLog("withDefaults: falling back to websocket path");
    const webSocket = createWebSocketClient();
    debugLog("TestStepReporter created with ws:", webSocket);
    return new DomainEventPublisher(webSocket);
  }

  constructor(
    private ws: WebSocket | null,
    private callback?: RamblersUploadWorkerCallbackConfig,
    private sharedSecret?: string,
    private jobId?: string,
    private stage?: Stage
  ) {
  }

  assignedTo(stage: Stage): StageCrewMember {
    this.stage = stage;
    return this;
  }

  notifyOf(event: DomainEvent): void {
    const eventName = event?.constructor?.name;
    if (!this.stage) {
      debugLog("notifyOf: no stage, dropping event:", eventName);
      throw new LogicError(`TestStepReporter needs to be assigned to the Stage before it can be notified of any DomainEvents`);
    } else if (!this.stage.theShowHasStarted()) {
      debugLog("notifyOf: show not started, dropping event:", eventName);
      return void 0;
    }
    const notesWereAdded = event instanceof SceneParametersDetected;
    const isFinished = event instanceof TestSuiteFinished;
    const isATask = event instanceof TaskFinished;
    const isAnInteraction = event instanceof InteractionFinished;
    debugLog("notifyOf event:", eventName, "match:", isAnInteraction || isATask || isFinished || notesWereAdded);
    if (isAnInteraction || isATask || isFinished || notesWereAdded) {
      const data: DomainEventDataWithFinished = {eventData: event.toJSON() as any, finished: isFinished};
      if (this.callback && this.sharedSecret && this.jobId) {
        debugLog(`notifyOf callback POST: jobId=${this.jobId}, finished=${isFinished}, name=${(event.toJSON() as any)?.details?.name || "(step)"}`);
        void postRamblersUploadProgressCallback(this.callback, this.sharedSecret, {
          jobId: this.jobId,
          type: RamblersUploadWorkerEventType.TEST_STEP,
          payload: JSON.stringify(data)
        }).catch(error => {
          debugLog("DomainEventPublisher callback failed:", (error as Error).message);
        });
      } else if (this.ws) {
        debugLog(`notifyOf ws send: finished=${isFinished}, name=${(event.toJSON() as any)?.details?.name || "(step)"}`);
        this.ws.send(JSON.stringify({
          type: EventType.TEST_STEP_REPORTER,
          data: JSON.stringify(data),
        }));
      } else {
        debugLog(`notifyOf: no transport available for event name=${(event.toJSON() as any)?.details?.name || "(step)"}`);
      }
    }
  }
}
