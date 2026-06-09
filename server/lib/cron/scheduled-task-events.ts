import { EventEmitter } from "events";
import { ScheduledTaskSummary } from "../../../projects/ngx-ramblers/src/app/models/scheduled-task.model";

export interface ScheduledTaskEventMap {
  "task-updated": { task: ScheduledTaskSummary };
}

class ScheduledTaskEventEmitter extends EventEmitter {
  emit<K extends keyof ScheduledTaskEventMap>(event: K, payload: ScheduledTaskEventMap[K]): boolean {
    return super.emit(event, payload);
  }
  on<K extends keyof ScheduledTaskEventMap>(event: K, listener: (payload: ScheduledTaskEventMap[K]) => void): this {
    return super.on(event, listener);
  }
  off<K extends keyof ScheduledTaskEventMap>(event: K, listener: (payload: ScheduledTaskEventMap[K]) => void): this {
    return super.off(event, listener);
  }
}

export const scheduledTaskEvents = new ScheduledTaskEventEmitter();
scheduledTaskEvents.setMaxListeners(50);
