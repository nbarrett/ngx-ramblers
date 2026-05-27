import * as cron from "node-cron";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import {
  ScheduledTaskRun,
  ScheduledTaskRunStatus,
  ScheduledTasksConfiguration,
  ScheduledTaskSummary
} from "../../../projects/ngx-ramblers/src/app/models/scheduled-task.model";
import * as config from "../mongo/controllers/config";
import { dateTimeNow } from "../shared/dates";
import { isUndefined } from "es-toolkit/compat";
import { RegisteredScheduledTask, ScheduledTaskDefinition } from "./scheduled-task-registry.model";

const taskRegistry = new Map<string, RegisteredScheduledTask>();
const maximumHistoryEntries = 20;
const dayNames: Record<string, string> = {
  "0": "Sunday",
  "1": "Monday",
  "2": "Tuesday",
  "3": "Wednesday",
  "4": "Thursday",
  "5": "Friday",
  "6": "Saturday",
  "7": "Sunday",
  "1-5": "Monday to Friday",
  SUN: "Sunday",
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
  SAT: "Saturday"
};

function timeDescription(hour: string, minute: string): string {
  const hourValue = Number.parseInt(hour, 10);
  const hourInTwelveHourClock = hourValue % 12 || 12;
  const suffix = hourValue >= 12 ? "pm" : "am";
  return `${hourInTwelveHourClock}:${minute.padStart(2, "0")} ${suffix}`;
}

export function cronScheduleDescription(cronExpression: string): string {
  const fields = cronExpression.trim().split(/\s+/);
  if (fields.length !== 5) {
    return `Custom cron schedule (${cronExpression})`;
  }
  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
  const numericMinute = /^\d+$/.test(minute);
  const numericHour = /^\d+$/.test(hour);
  const everyMinutes = minute.match(/^\*\/(\d+)$/)?.[1];
  const everyHours = hour.match(/^\*\/(\d+)$/)?.[1];
  const dayName = dayNames[dayOfWeek.toUpperCase()];
  if (everyMinutes && hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return `Every ${everyMinutes} minutes`;
  } else if (numericMinute && hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return `Hourly at ${minute.padStart(2, "0")} minutes past`;
  } else if (numericMinute && everyHours && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return `Every ${everyHours} hours at ${minute.padStart(2, "0")} minutes past`;
  } else if (numericMinute && numericHour && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return `Daily at ${timeDescription(hour, minute)}`;
  } else if (numericMinute && numericHour && dayOfMonth === "*" && month === "*" && dayName) {
    return `Weekly on ${dayName} at ${timeDescription(hour, minute)}`;
  } else if (numericMinute && numericHour && /^\d+$/.test(dayOfMonth) && month === "*" && dayOfWeek === "*") {
    return `Monthly on day ${dayOfMonth} at ${timeDescription(hour, minute)}`;
  } else {
    return `Custom cron schedule (${cronExpression})`;
  }
}

async function configuredTaskSettings(): Promise<ScheduledTasksConfiguration> {
  try {
    const document = await config.queryKey(ConfigKey.SCHEDULED_TASKS);
    const value = document?.value as ScheduledTasksConfiguration | null;
    return {
      enabled: value?.enabled ?? {},
      cronExpressions: value?.cronExpressions ?? {}
    };
  } catch (error) {
    return {enabled: {}, cronExpressions: {}};
  }
}

async function configuredEnabledState(id: string, defaultEnabled: boolean): Promise<boolean> {
  const settings = await configuredTaskSettings();
  const configuredValue = settings.enabled[id];
  return configuredValue === null || isUndefined(configuredValue) ? defaultEnabled : configuredValue;
}

async function configuredCronExpression(id: string, defaultCronExpression: string): Promise<string> {
  const settings = await configuredTaskSettings();
  const configuredValue = settings.cronExpressions[id];
  return configuredValue && cron.validate(configuredValue) ? configuredValue : defaultCronExpression;
}

async function persistEnabledState(id: string, enabled: boolean): Promise<void> {
  const current = await configuredTaskSettings();
  await config.createOrUpdateKey(ConfigKey.SCHEDULED_TASKS, {
    ...current,
    enabled: {...current.enabled, [id]: enabled}
  });
}

async function persistCronExpression(id: string, cronExpression: string): Promise<void> {
  const current = await configuredTaskSettings();
  await config.createOrUpdateKey(ConfigKey.SCHEDULED_TASKS, {
    ...current,
    cronExpressions: {...current.cronExpressions, [id]: cronExpression}
  });
}

async function executeTask(registered: RegisteredScheduledTask): Promise<ScheduledTaskRun> {
  const run: ScheduledTaskRun = {
    startedAt: dateTimeNow().toISO()!,
    completedAt: null,
    status: ScheduledTaskRunStatus.RUNNING,
    message: null
  };
  registered.history = [run, ...registered.history].slice(0, maximumHistoryEntries);
  try {
    await registered.definition.run();
    run.status = ScheduledTaskRunStatus.SUCCEEDED;
  } catch (error: any) {
    run.status = ScheduledTaskRunStatus.FAILED;
    run.message = error?.message || `${error}`;
  }
  run.completedAt = dateTimeNow().toISO()!;
  return run;
}

export async function registerScheduledTask(definition: ScheduledTaskDefinition): Promise<void> {
  const previous = taskRegistry.get(definition.id);
  previous?.task.destroy();
  const enabled = await configuredEnabledState(definition.id, definition.enabled);
  const effectiveCronExpression = await configuredCronExpression(definition.id, definition.cronExpression);
  const effectiveDefinition = {...definition, cronExpression: effectiveCronExpression};
  const task = cron.createTask(effectiveCronExpression, async () => {
    const current = taskRegistry.get(definition.id);
    if (current) {
      await executeTask(current);
    }
  });
  const registered: RegisteredScheduledTask = {
    definition: effectiveDefinition,
    defaultCronExpression: definition.cronExpression,
    enabled,
    history: previous?.history ?? [],
    task
  };
  if (enabled) {
    registered.task.start();
  }
  taskRegistry.set(definition.id, registered);
}

function summary(registered: RegisteredScheduledTask): ScheduledTaskSummary {
  const nextRun = registered.enabled ? registered.task.getNextRun() : null;
  return {
    id: registered.definition.id,
    name: registered.definition.name,
    description: registered.definition.description,
    cronExpression: registered.definition.cronExpression,
    defaultCronExpression: registered.defaultCronExpression,
    scheduleDescription: cronScheduleDescription(registered.definition.cronExpression),
    enabled: registered.enabled,
    nextRunAt: nextRun ? nextRun.toISOString() : null,
    lastRun: registered.history[0] ?? null,
    history: registered.history
  };
}

export function scheduledTasks(): ScheduledTaskSummary[] {
  return [...taskRegistry.values()].map(summary);
}

export async function setScheduledTaskEnabled(id: string, enabled: boolean): Promise<ScheduledTaskSummary | null> {
  const registered = taskRegistry.get(id);
  if (!registered) {
    return null;
  }
  registered.enabled = enabled;
  if (enabled) {
    registered.task.start();
  } else {
    registered.task.stop();
  }
  await persistEnabledState(id, enabled);
  return summary(registered);
}

export async function setScheduledTaskCronExpression(id: string, cronExpression: string): Promise<ScheduledTaskSummary | null> {
  const registered = taskRegistry.get(id);
  if (!registered) {
    return null;
  }
  const expression = cronExpression.trim();
  if (!cron.validate(expression)) {
    throw new Error("Cron expression is invalid");
  }
  registered.task.stop();
  registered.task.destroy();
  registered.definition = {...registered.definition, cronExpression: expression};
  registered.task = cron.createTask(expression, async () => {
    const current = taskRegistry.get(id);
    if (current) {
      await executeTask(current);
    }
  });
  if (registered.enabled) {
    registered.task.start();
  }
  await persistCronExpression(id, expression);
  return summary(registered);
}

export async function triggerScheduledTask(id: string): Promise<ScheduledTaskSummary | null> {
  const registered = taskRegistry.get(id);
  if (!registered) {
    return null;
  }
  await executeTask(registered);
  return summary(registered);
}
