import * as cron from "node-cron";
import { ScheduledTaskRun } from "../../../projects/ngx-ramblers/src/app/models/scheduled-task.model";

export interface ScheduledTaskDefinition {
  id: string;
  name: string;
  description: string;
  cronExpression: string;
  enabled: boolean;
  settings?: unknown;
  previousIds?: string[];
  run: () => Promise<void>;
}

export interface RegisteredScheduledTask {
  definition: ScheduledTaskDefinition;
  defaultCronExpression: string;
  enabled: boolean;
  task: cron.ScheduledTask;
  history: ScheduledTaskRun[];
}
