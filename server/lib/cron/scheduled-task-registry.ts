import * as cron from "node-cron";
import { pluraliseWithCount } from "../shared/string-utils";
import debug from "debug";
import { BrevoError } from "@getbrevo/brevo";
import { envConfig } from "../env-config/env-config";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import {
  ScheduledTaskRun,
  ScheduledTaskRunStatus,
  ScheduledTasksConfiguration,
  ScheduledTaskSummary
} from "../../../projects/ngx-ramblers/src/app/models/scheduled-task.model";
import * as config from "../mongo/controllers/config";
import { scheduledTaskRun } from "../mongo/models/scheduled-task-run";
import { dateTimeNow } from "../shared/dates";
import { isString, isUndefined } from "es-toolkit/compat";
import { RegisteredScheduledTask, ScheduledTaskDefinition } from "./scheduled-task-registry.model";
import { scheduledTaskEvents } from "./scheduled-task-events";
import { humanFileSize } from "../../../projects/ngx-ramblers/src/app/functions/file-utils";

const debugLog = debug(envConfig.logNamespace("cron:scheduled-tasks"));
debugLog.enabled = true;

const taskRegistry = new Map<string, RegisteredScheduledTask>();
const scheduleTimezone = "Europe/London";
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
      cronExpressions: value?.cronExpressions ?? {},
      settings: value?.settings ?? {}
    };
  } catch (error) {
    return {enabled: {}, cronExpressions: {}, settings: {}};
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

async function configuredSettings(id: string, defaultSettings: unknown): Promise<unknown> {
  const settings = await configuredTaskSettings();
  const configuredValue = settings.settings?.[id];
  if (defaultSettings && configuredValue) {
    return {
      ...(defaultSettings as Record<string, unknown>),
      ...(configuredValue as Record<string, unknown>)
    };
  } else if (configuredValue) {
    return configuredValue;
  } else {
    return defaultSettings;
  }
}

export function carryForwardConfiguration(current: ScheduledTasksConfiguration, id: string, previousIds: string[]): {
  sourceId: string | null;
  migrated: ScheduledTasksConfiguration;
} {
  const settings = current.settings ?? {};
  const hasCurrentConfig = id in current.enabled || id in current.cronExpressions || id in settings;
  if (hasCurrentConfig || previousIds.length === 0) {
    return {sourceId: null, migrated: current};
  }
  const sourceId = previousIds.find(previousId =>
    previousId in current.enabled || previousId in current.cronExpressions || previousId in settings) ?? null;
  if (!sourceId) {
    return {sourceId: null, migrated: current};
  }
  const migrated: ScheduledTasksConfiguration = {
    enabled: {...current.enabled},
    cronExpressions: {...current.cronExpressions},
    settings: {...settings}
  };
  if (sourceId in current.enabled) {
    migrated.enabled[id] = current.enabled[sourceId];
  }
  if (sourceId in current.cronExpressions) {
    migrated.cronExpressions[id] = current.cronExpressions[sourceId];
  }
  if (sourceId in settings) {
    migrated.settings![id] = settings[sourceId];
  }
  return {sourceId, migrated};
}

async function migrateRunHistory(fromTaskId: string, toTaskId: string): Promise<void> {
  try {
    const result = await scheduledTaskRun.updateMany({taskId: fromTaskId}, {$set: {taskId: toTaskId}});
    if (result.modifiedCount > 0) {
      debugLog(`Migrated ${pluraliseWithCount(result.modifiedCount, "run history record")} from "${fromTaskId}" to "${toTaskId}"`);
    }
  } catch (error) {
    debugLog(`Failed to migrate run history from "${fromTaskId}" to "${toTaskId}":`, error);
  }
}

async function migratePreviousTaskIds(definition: ScheduledTaskDefinition): Promise<void> {
  const previousIds = definition.previousIds ?? [];
  if (previousIds.length === 0) {
    return;
  }
  const current = await configuredTaskSettings();
  const {sourceId, migrated} = carryForwardConfiguration(current, definition.id, previousIds);
  if (!sourceId) {
    return;
  }
  await config.createOrUpdateKey(ConfigKey.SCHEDULED_TASKS, migrated);
  await migrateRunHistory(sourceId, definition.id);
  debugLog(`WARNING: scheduled task "${definition.id}" had no saved configuration but legacy id "${sourceId}" did - treating as a task-id rename and carrying forward enabled=${migrated.enabled[definition.id]}, cron="${migrated.cronExpressions[definition.id]}" and run history.`);
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

export async function scheduledTaskSettings<T>(id: string, defaultSettings: T): Promise<T> {
  const settings = await configuredTaskSettings();
  return {
    ...defaultSettings,
    ...(settings.settings?.[id] as Partial<T> || {})
  };
}

async function persistTaskSettings(id: string, settings: unknown): Promise<void> {
  const current = await configuredTaskSettings();
  await config.createOrUpdateKey(ConfigKey.SCHEDULED_TASKS, {
    ...current,
    settings: {...(current.settings ?? {}), [id]: settings}
  });
}

async function persistRun(taskId: string, run: ScheduledTaskRun): Promise<void> {
  try {
    await scheduledTaskRun.create({taskId, ...run});
    const kept = await scheduledTaskRun.find({taskId}).sort({startedAt: -1}).limit(maximumHistoryEntries).select("_id").lean();
    await scheduledTaskRun.deleteMany({taskId, _id: {$nin: kept.map(entry => entry._id)}});
  } catch (error) {
    debugLog(`Failed to persist run for scheduled task "${taskId}":`, error);
  }
}

async function loadHistory(taskId: string): Promise<ScheduledTaskRun[]> {
  try {
    const records = await scheduledTaskRun.find({taskId}).sort({startedAt: -1}).limit(maximumHistoryEntries).lean();
    return records.map(record => ({
      startedAt: record.startedAt,
      completedAt: record.completedAt,
      status: record.status,
      message: record.message
    }));
  } catch (error) {
    debugLog(`Failed to load run history for scheduled task "${taskId}":`, error);
    return [];
  }
}

function detailedErrorMessage(error: any): string {
  if (error instanceof BrevoError) {
    const body: any = error.body;
    const detail = body?.message ?? body?.code ?? (isString(body) ? body : undefined);
    return detail ? `${error.message}: ${detail}` : (error.message || `${error}`);
  }
  return error?.message || `${error}`;
}

function runtimeEnabled(definition: ScheduledTaskDefinition): boolean {
  return definition.runtimeEnabled ? definition.runtimeEnabled() : true;
}

function rssDeltaMessage(rssBefore: number, rssAfter: number): string {
  const deltaBytes = rssAfter - rssBefore;
  const sign = deltaBytes >= 0 ? "+" : "-";
  return `rss ${humanFileSize(rssBefore)} -> ${humanFileSize(rssAfter)} (${sign}${humanFileSize(Math.abs(deltaBytes))})`;
}

async function executeTask(registered: RegisteredScheduledTask): Promise<ScheduledTaskRun> {
  const run: ScheduledTaskRun = {
    startedAt: dateTimeNow().toISO()!,
    completedAt: null,
    status: ScheduledTaskRunStatus.RUNNING,
    message: null
  };
  registered.history = [run, ...registered.history].slice(0, maximumHistoryEntries);
  scheduledTaskEvents.emit("task-updated", { task: summary(registered) });
  const rssBefore = process.memoryUsage().rss;
  try {
    await registered.definition.run();
    run.status = ScheduledTaskRunStatus.SUCCEEDED;
  } catch (error: any) {
    run.status = ScheduledTaskRunStatus.FAILED;
    run.message = detailedErrorMessage(error);
    const body = error instanceof BrevoError ? error.body : (error?.response?.body ?? error?.body);
    debugLog(`Scheduled task "${registered.definition.name}" (${registered.definition.id}) failed:`, run.message,
      "\nstatusCode:", error?.statusCode ?? error?.response?.statusCode,
      "\nbody:", body,
      "\nstack:", error?.stack);
  }
  run.completedAt = dateTimeNow().toISO()!;
  const memoryNote = rssDeltaMessage(rssBefore, process.memoryUsage().rss);
  run.message = run.message ? `${run.message} | ${memoryNote}` : memoryNote;
  await persistRun(registered.definition.id, run);
  scheduledTaskEvents.emit("task-updated", { task: summary(registered) });
  return run;
}

export async function registerScheduledTask(definition: ScheduledTaskDefinition): Promise<void> {
  const previous = taskRegistry.get(definition.id);
  previous?.task.destroy();
  await migratePreviousTaskIds(definition);
  const enabled = await configuredEnabledState(definition.id, definition.enabled) && runtimeEnabled(definition);
  const effectiveCronExpression = await configuredCronExpression(definition.id, definition.cronExpression);
  const effectiveSettings = await configuredSettings(definition.id, definition.settings);
  const effectiveDefinition = {...definition, cronExpression: effectiveCronExpression, settings: effectiveSettings};
  const task = cron.createTask(effectiveCronExpression, async () => {
    const current = taskRegistry.get(definition.id);
    if (current) {
      await executeTask(current);
    }
  }, {timezone: scheduleTimezone});
  const registered: RegisteredScheduledTask = {
    definition: effectiveDefinition,
    defaultCronExpression: definition.cronExpression,
    enabled,
    history: previous?.history ?? await loadHistory(definition.id),
    task
  };
  if (enabled) {
    registered.task.start();
  }
  taskRegistry.set(definition.id, registered);
}

function summary(registered: RegisteredScheduledTask): ScheduledTaskSummary {
  const nextRun = registered.enabled ? registered.task.getNextRun() : null;
  const settings = registered.definition.settings;
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
    history: registered.history,
    settings
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
  const effectiveEnabled = enabled && runtimeEnabled(registered.definition);
  registered.enabled = effectiveEnabled;
  if (effectiveEnabled) {
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
  }, {timezone: scheduleTimezone});
  if (registered.enabled) {
    registered.task.start();
  }
  await persistCronExpression(id, expression);
  return summary(registered);
}

export async function setScheduledTaskSettings(id: string, settings: unknown): Promise<ScheduledTaskSummary | null> {
  const registered = taskRegistry.get(id);
  if (!registered) {
    return null;
  }
  registered.definition = {...registered.definition, settings};
  await persistTaskSettings(id, settings);
  return summary(registered);
}

export async function triggerScheduledTask(id: string): Promise<ScheduledTaskSummary | null> {
  const registered = taskRegistry.get(id);
  if (!registered) {
    return null;
  }
  executeTask(registered).catch(error => debugLog(`Manually triggered task ${id} failed:`, error?.message || error));
  return summary(registered);
}
