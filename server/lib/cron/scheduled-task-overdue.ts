import { isString } from "es-toolkit/compat";

const minuteMs = 60 * 1000;
const hourMs = 60 * minuteMs;
const dayMs = 24 * hourMs;

export function expectedIntervalMs(cronExpression: string): number | null {
  const fields = cronExpression.trim().split(/\s+/);
  if (fields.length !== 5) {
    return null;
  }
  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
  const everyMinutes = minute.match(/^\*\/(\d+)$/)?.[1];
  const everyHours = hour.match(/^\*\/(\d+)$/)?.[1];
  if (everyMinutes && hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return Number(everyMinutes) * minuteMs;
  } else if (/^\d+$/.test(minute) && hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return hourMs;
  } else if (/^\d+$/.test(minute) && everyHours && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return Number(everyHours) * hourMs;
  } else if (/^\d+$/.test(minute) && /^\d+$/.test(hour) && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return dayMs;
  } else if (/^\d+$/.test(minute) && /^\d+$/.test(hour) && dayOfMonth === "*" && month === "*" && dayOfWeek !== "*") {
    return 7 * dayMs;
  } else if (/^\d+$/.test(minute) && /^\d+$/.test(hour) && /^\d+$/.test(dayOfMonth) && month === "*") {
    return 28 * dayMs;
  } else {
    return null;
  }
}

export function overdueGraceMs(intervalMs: number): number {
  return Math.min(Math.max(intervalMs * 0.1, 15 * minuteMs), 2 * hourMs);
}

export function isScheduledTaskOverdue(options: {
  cronExpression: string;
  nextRunAt: Date | null;
  lastCompletedAt: string | null;
  nowMs: number;
}): boolean {
  const intervalMs = expectedIntervalMs(options.cronExpression);
  if (!intervalMs || !options.nextRunAt) {
    return false;
  }
  const previousExpectedMs = options.nextRunAt.getTime() - intervalMs;
  const graceMs = overdueGraceMs(intervalMs);
  if (options.nowMs < previousExpectedMs + graceMs) {
    return false;
  }
  if (!options.lastCompletedAt || !isString(options.lastCompletedAt)) {
    return true;
  }
  const lastCompletedMs = Date.parse(options.lastCompletedAt);
  if (!Number.isFinite(lastCompletedMs)) {
    return true;
  }
  return lastCompletedMs < previousExpectedMs - graceMs;
}
