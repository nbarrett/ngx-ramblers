import { ApiResponse, Identifiable } from "./api-response.model";
import { MessageType } from "./websocket.model";

export interface AuditRamblersUploadParams<T> {
  messageType: MessageType;
  auditMessage: T;
  status?: Status,
  parserFunction: (auditMessage: T, status?: Status) => ParsedRamblersUploadAudit[];
}

export interface ParsedRamblersUploadAudit {
  audit: boolean;
  data?: RamblersUploadAudit;
}
export interface RamblersUploadAudit extends Identifiable {
  auditTime: number;
  type: AuditType;
  status: Status;
  message?: string;
  record?: number;
  fileName?: string;
  errorResponse?: any;
}

export interface RamblersUploadAuditApiResponse extends ApiResponse {
  request: any;
  response?: RamblersUploadAudit[];
}

export interface RamblersUploadSummaryResponse extends ApiResponse {
  request: any;
  response: FileUploadSummary[];
}

export enum AuditType {
  STDERR = "stderr",
  STEP = "step",
  SUMMARY = "summary",
}

export enum Status {
  ACTIVE = "active",
  COMPLETE = "complete",
  SUCCESS = "success",
  INFO = "info",
  ERROR = "error",
}

export interface FileUploadSummary {
  fileName: string,
  status: Status
}

export interface DomainEventDataWithFinished {
  eventData: DomainEventData,
  finished: boolean
}

export interface DomainEventData {
  finished: boolean;
  activityId: string;
  details: {
    name: string;
    location: {
      column: number;
      line: number;
      path: string
    }
  };
  outcome: {
    code: number;
    error?: string
  };
  sceneId: string;
  timestamp: string;
}

export interface CurrentUploadSession {
  logStandardOut: boolean;
  record: number;
  fileName: string;
}

const InteractionFinished: DomainEventData = {
  finished: false,
  activityId: "t9cf86xofjqndig9skxk5kyk",
  details: {
    name: "Walks Admin navigates to \"https://walks-manager.ramblers.org.uk/walks-manager\"",
    location: {
      column: 27,
      line: 27,
      path: "/Users/nick/dev/git-personal/ngx-ramblers/server/lib/serenity-js/screenplay/tasks/common/start.ts"
    }
  },
  outcome: {code: 64},
  sceneId: "nckr8mvfdd2jddeokdnhj2jq",
  timestamp: "2025-05-14T22:35:31.914Z"
};

const TaskFinished: DomainEventData = {
  finished: false,
  activityId: "j2a74c9zlt4665rxonxxks4c",
  details: {
    name: "Walks Admin starts with navigation to https://walks-manager.ramblers.org.uk/walks-manager",
    location: {
      column: 27,
      line: 27,
      path: "/Users/nick/dev/git-personal/ngx-ramblers/server/lib/serenity-js/screenplay/tasks/common/start.ts"
    }
  },
  outcome: {code: 64},
  sceneId: "nckr8mvfdd2jddeokdnhj2jq",
  timestamp: "2025-05-14T22:35:31.925Z"
};

const TaskStarted: DomainEventData = {
  finished: false,
  activityId: "ollhfjh8ybf0utuvt53dqp5s",
  details: {
    name: "Walks Admin uploads file /Users/nick/Downloads/walks-export-14-May-2025-22-55.csv containing 1 walk",
    location: {
      column: 38,
      line: 21,
      path: "/Users/nick/dev/git-personal/ngx-ramblers/server/lib/serenity-js/screenplay/tasks/ramblers/walks/upload-walks.ts"
    }
  },
  outcome: {
    code: 4,
    error: `{"cause":{"message":"Timeout of 20s has expired","name":"TimeoutExpiredError","stack":"TimeoutExpiredError: Timeout of 20s has expired\\n    at ScheduledOperation.invoke (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/time/models/Scheduler.ts:168:23)\\n    at ScheduledOperation.poll (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/time/models/Scheduler.ts:142:36)\\n    at ScheduledOperation.poll (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/time/models/Scheduler.ts:151:16)\\n    at ScheduledOperation.poll (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/time/models/Scheduler.ts:151:16)\\n    at ScheduledOperation.poll (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/time/models/Scheduler.ts:151:16)\\n    at ScheduledOperation.poll (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/time/models/Scheduler.ts:151:16)\\n    at ScheduledOperation.poll (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/time/models/Scheduler.ts:151:16)\\n    at ScheduledOperation.poll (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/time/models/Scheduler.ts:151:16)\\n    at ScheduledOperation.poll (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/time/models/Scheduler.ts:151:16)\\n    at ScheduledOperation.poll (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/time/models/Scheduler.ts:151:16)\\n    at ScheduledOperation.poll (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/time/models/Scheduler.ts:151:16)\\n    at ScheduledOperation.poll (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/time/models/Scheduler.ts:151:16)\\n    at ScheduledOperation.poll (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/time/models/Scheduler.ts:151:16)\\n    at ScheduledOperation.poll (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/time/models/Scheduler.ts:151:16)\\n    at ScheduledOperation.poll (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/time/models/Scheduler.ts:151:16)\\n    at ScheduledOperation.poll (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/time/models/Scheduler.ts:151:16)"},"message":"Timeout of 20s has expired while waiting for Upload walks to become clickable\\n\\nExpectation: isClickable()\\n\\n\\u001b[32mExpected boolean:                true\\u001b[39m\\n\\u001b[31mReceived WebdriverIOPageElement\\u001b[39m\\n\\nWebdriverIOPageElement {\\n  locator: WebdriverIOLocator {\\n    parent: WebdriverIORootLocator { }\\n    selector: ById {\\n      value: 'edit-submit-upload'\\n    }\\n  }\\n}\\n\\n    at /Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/abilities/PerformActivities.ts:60:28","name":"AssertionError","stack":"AssertionError: Timeout of 20s has expired while waiting for Upload walks to become clickable\\n\\nExpectation: isClickable()\\n\\n\\u001b[32mExpected boolean:                true\\u001b[39m\\n\\u001b[31mReceived WebdriverIOPageElement\\u001b[39m\\n\\nWebdriverIOPageElement {\\n  locator: WebdriverIOLocator {\\n    parent: WebdriverIORootLocator { }\\n    selector: ById {\\n      value: 'edit-submit-upload'\\n    }\\n  }\\n}\\n\\n    at /Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/abilities/PerformActivities.ts:60:28\\n    at ErrorFactory.create (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/errors/ErrorFactory.ts:35:16)\\n    at Stage.createError (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/stage/Stage.ts:304:28)\\n    at RaiseErrors.create (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/errors/RaiseErrors.ts:59:27)\\n    at Object.errorHandler (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/time/activities/Wait.ts:284:53)\\n    at ScheduledOperation.invoke (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/time/models/Scheduler.ts:180:25)\\n    at ScheduledOperation.poll (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/time/models/Scheduler.ts:142:36)\\n    at ScheduledOperation.poll (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/time/models/Scheduler.ts:151:16)\\n    at ScheduledOperation.poll (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/time/models/Scheduler.ts:151:16)\\n    at ScheduledOperation.poll (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/time/models/Scheduler.ts:151:16)\\n    at ScheduledOperation.poll (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/time/models/Scheduler.ts:151:16)\\n    at ScheduledOperation.poll (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/time/models/Scheduler.ts:151:16)\\n    at ScheduledOperation.poll (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/time/models/Scheduler.ts:151:16)\\n    at ScheduledOperation.poll (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/time/models/Scheduler.ts:151:16)\\n    at ScheduledOperation.poll (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/time/models/Scheduler.ts:151:16)\\n    at ScheduledOperation.poll (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/time/models/Scheduler.ts:151:16)\\n    at ScheduledOperation.poll (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/time/models/Scheduler.ts:151:16)\\nCaused by: TimeoutExpiredError: Timeout of 20s has expired\\n    at ScheduledOperation.invoke (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/time/models/Scheduler.ts:168:23)\\n    at ScheduledOperation.poll (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/time/models/Scheduler.ts:142:36)\\n    at ScheduledOperation.poll (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/time/models/Scheduler.ts:151:16)\\n    at ScheduledOperation.poll (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/time/models/Scheduler.ts:151:16)\\n    at ScheduledOperation.poll (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/time/models/Scheduler.ts:151:16)\\n    at ScheduledOperation.poll (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/time/models/Scheduler.ts:151:16)\\n    at ScheduledOperation.poll (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/time/models/Scheduler.ts:151:16)\\n    at ScheduledOperation.poll (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/time/models/Scheduler.ts:151:16)\\n    at ScheduledOperation.poll (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/time/models/Scheduler.ts:151:16)\\n    at ScheduledOperation.poll (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/time/models/Scheduler.ts:151:16)\\n    at ScheduledOperation.poll (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/time/models/Scheduler.ts:151:16)\\n    at ScheduledOperation.poll (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/time/models/Scheduler.ts:151:16)\\n    at ScheduledOperation.poll (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/time/models/Scheduler.ts:151:16)\\n    at ScheduledOperation.poll (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/time/models/Scheduler.ts:151:16)\\n    at ScheduledOperation.poll (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/time/models/Scheduler.ts:151:16)\\n    at ScheduledOperation.poll (/Users/nick/dev/git-personal/ngx-ramblers/server/node_modules/@serenity-js/core/src/screenplay/time/models/Scheduler.ts:151:16)"}`
  },
  sceneId: "nckr8mvfdd2jddeokdnhj2jq",
  timestamp: "2025-05-14T22:36:06.917Z"
};
