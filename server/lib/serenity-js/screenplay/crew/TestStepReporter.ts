import { LogicError, Stage, StageCrewMember } from "@serenity-js/core";
import { DomainEvent, InteractionFinished, TaskFinished } from "@serenity-js/core/lib/events";
import debug from "debug";
import WebSocket from "ws";
import { envConfig } from "../../../env-config/env-config";
import { EventType } from "../../../../../projects/ngx-ramblers/src/app/models/websocket.model";
import { createWebSocketClient } from "../../../websockets/websocket-client";
import { TestSuiteFinished } from "@serenity-js/core/src/events/TestSuiteFinished";
import {
  DomainEventDataWithFinished
} from "../../../../../projects/ngx-ramblers/src/app/models/ramblers-upload-audit.model";
import { SceneParametersDetected } from "@serenity-js/core/src/events/SceneParametersDetected";

const debugLog = debug(envConfig.logNamespace("test-step-reporter"));
debugLog.enabled = true;

export class TestStepReporter implements StageCrewMember {
  static withDefaults() {
    const webSocket = createWebSocketClient();
    debugLog("TestStepReporter created with ws:", webSocket);
    return new TestStepReporter(webSocket);
  }

  constructor(private ws: WebSocket, private stage?: Stage) {
  }

  assignedTo(stage: Stage): StageCrewMember {
    this.stage = stage;
    return this;
  }

  notifyOf(event: DomainEvent): void {
    if (!this.stage) {
      throw new LogicError(`TestStepReporter needs to be assigned to the Stage before it can be notified of any DomainEvents`);
    } else if (!this.stage.theShowHasStarted()) {
      return void 0;
    }
    const isNotes = event instanceof SceneParametersDetected;
    const isFinished = event instanceof TestSuiteFinished;
    const isATask = event instanceof TaskFinished;
    const isAnInteraction = event instanceof InteractionFinished;
    if (isATask) {
      // debugLog(`TestStepReporter notified of TaskFinished event:`, event, "json:", event.toJSON());
      // send task finished event such that it can be received by the context inside uploadWalks()
    }
    if (isAnInteraction) {
      // debugLog(`TestStepReporter notified of InteractionFinished event:`, event.toJSON());
      // send task finished event such that it can be received by the context inside uploadWalks()
    }
    if (isNotes) {
    //   debugLog(`Audit record detected:`, auditRecord);
    //   this.ws.send(JSON.stringify({
    //     type: EventType.AUDIT_RECORD,
    //     data: auditRecord,
    //   }));
    // get auditRecord from event parameters
    }
    if (isAnInteraction || isATask || isFinished || isNotes) {
      debugLog(`TestStepReporter reporting of isAnInteraction: ${isAnInteraction}, isATask:${isATask}, isNotes: ${isNotes}, event:`, event, "json:", event.toJSON());
      const data: DomainEventDataWithFinished = {eventData: event.toJSON() as any, finished: isFinished};
      this.ws.send(JSON.stringify({
        type: EventType.TEST_STEP_REPORTER,
        data: JSON.stringify(data),
      }));
    } else {
      debugLog(`ignoring event:`, event, "json:", event.toJSON());
    }
  }
}
