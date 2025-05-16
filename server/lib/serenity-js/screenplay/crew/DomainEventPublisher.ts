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

const debugLog = debug(envConfig.logNamespace("domain-event-publisher"));
debugLog.enabled = true;

export class DomainEventPublisher implements StageCrewMember {
  static withDefaults() {
    const webSocket = createWebSocketClient();
    debugLog("TestStepReporter created with ws:", webSocket);
    return new DomainEventPublisher(webSocket);
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
    const notesWereAdded = event instanceof SceneParametersDetected;
    const isFinished = event instanceof TestSuiteFinished;
    const isATask = event instanceof TaskFinished;
    const isAnInteraction = event instanceof InteractionFinished;
    if (isAnInteraction || isATask || isFinished || notesWereAdded) {
      debugLog(`TestStepReporter reporting of isAnInteraction: ${isAnInteraction}, isATask:${isATask}, notesWereAdded: ${notesWereAdded}, event:`, event, "json:", event.toJSON());
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
