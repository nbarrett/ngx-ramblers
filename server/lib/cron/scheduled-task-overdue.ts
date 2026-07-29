import { isString } from "es-toolkit/compat";
import { DateTime } from "luxon";
import { dateTimeFromJsDate } from "../shared/dates";
import { CronSchedule } from "./scheduled-task-registry.model";

const minuteMs = 60 * 1000;
const hourMs = 60 * minuteMs;
const dayMs = 24 * hourMs;
const maximumLookBackDays = 400;

const monthAliases: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12
};

const dayOfWeekAliases: Record<string, number> = {
  SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6
};

function aliasValue(token: string, aliases: Record<string, number>): number {
  const aliased = aliases[token.toUpperCase()];
  return aliased === undefined ? Number.parseInt(token, 10) : aliased;
}

function segmentValues(segment: string, min: number, max: number, aliases: Record<string, number>): number[] | null {
  const [rangeToken, stepToken] = segment.split("/");
  const step = stepToken === undefined ? 1 : Number.parseInt(stepToken, 10);
  const bounds = rangeToken === "*" ? [min, max] : rangeToken.split("-").map(token => aliasValue(token, aliases));
  const start = bounds[0];
  const end = bounds.length > 1 ? bounds[1] : (rangeToken === "*" ? max : bounds[0]);
  const usable = Number.isFinite(start) && Number.isFinite(end) && Number.isFinite(step)
    && step > 0 && start >= min && end <= max && start <= end;
  return usable
    ? Array.from({length: end - start + 1}, (_, offset) => start + offset).filter((_, offset) => offset % step === 0)
    : null;
}

function fieldValues(field: string, min: number, max: number, aliases: Record<string, number> = {}): number[] | null {
  const segments = field.split(",").map(segment => segmentValues(segment, min, max, aliases));
  const usable = segments.filter((values): values is number[] => values !== null);
  return usable.length === segments.length && usable.length > 0
    ? [...new Set(usable.flat())].sort((left, right) => left - right)
    : null;
}

export function parseCronSchedule(cronExpression: string): CronSchedule | null {
  const fields = cronExpression.trim().split(/\s+/);
  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields.length === 5 ? fields : [];
  const minutes = fields.length === 5 ? fieldValues(minute, 0, 59) : null;
  const hours = fields.length === 5 ? fieldValues(hour, 0, 23) : null;
  const daysOfMonth = fields.length === 5 ? fieldValues(dayOfMonth, 1, 31) : null;
  const months = fields.length === 5 ? fieldValues(month, 1, 12, monthAliases) : null;
  const daysOfWeek = fields.length === 5 ? fieldValues(dayOfWeek, 0, 7, dayOfWeekAliases) : null;
  const parsed = minutes && hours && daysOfMonth && months && daysOfWeek;
  return parsed
    ? {
      minutes,
      hours,
      daysOfMonth,
      months,
      daysOfWeek: [...new Set(daysOfWeek.map(value => value % 7))].sort((left, right) => left - right),
      dayOfMonthRestricted: dayOfMonth !== "*",
      dayOfWeekRestricted: dayOfWeek !== "*"
    }
    : null;
}

function dayMatches(day: DateTime, schedule: CronSchedule): boolean {
  const monthMatches = schedule.months.includes(day.month);
  const dayOfMonthMatches = schedule.daysOfMonth.includes(day.day);
  const dayOfWeekMatches = schedule.daysOfWeek.includes(day.weekday % 7);
  const bothRestricted = schedule.dayOfMonthRestricted && schedule.dayOfWeekRestricted;
  const dateMatches = bothRestricted
    ? dayOfMonthMatches || dayOfWeekMatches
    : (schedule.dayOfMonthRestricted ? dayOfMonthMatches : (schedule.dayOfWeekRestricted ? dayOfWeekMatches : true));
  return monthMatches && dateMatches;
}

function latestSlotOnDay(day: DateTime, schedule: CronSchedule, beforeMs: number): DateTime | null {
  const slots = schedule.hours
    .flatMap(hour => schedule.minutes.map(minute => day.set({hour, minute, second: 0, millisecond: 0})))
    .filter(slot => slot.toMillis() < beforeMs)
    .sort((left, right) => right.toMillis() - left.toMillis());
  return slots.length > 0 ? slots[0] : null;
}

export function previousExpectedRun(cronExpression: string, before: Date): Date | null {
  const schedule = parseCronSchedule(cronExpression);
  const beforeDateTime = schedule ? dateTimeFromJsDate(before) : null;
  const beforeMs = beforeDateTime ? beforeDateTime.toMillis() : 0;
  const offsets = Array.from({length: maximumLookBackDays + 1}, (_, offset) => offset);
  const slot = schedule && beforeDateTime
    ? offsets
      .map(offset => beforeDateTime.minus({days: offset}).startOf("day"))
      .filter(day => dayMatches(day, schedule))
      .map(day => latestSlotOnDay(day, schedule, beforeMs))
      .find(candidate => candidate !== null)
    : null;
  return slot ? slot.toJSDate() : null;
}

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

function lastCompletedMillis(lastCompletedAt: string | null): number | null {
  const parsed = isString(lastCompletedAt) ? Date.parse(lastCompletedAt) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export function isScheduledTaskOverdue(options: {
  cronExpression: string;
  nextRunAt: Date | null;
  lastCompletedAt: string | null;
  nowMs: number;
}): boolean {
  const intervalMs = expectedIntervalMs(options.cronExpression);
  const previousExpectedRunAt = intervalMs && options.nextRunAt
    ? previousExpectedRun(options.cronExpression, options.nextRunAt)
    : null;
  const previousExpectedMs = previousExpectedRunAt ? previousExpectedRunAt.getTime() : null;
  const graceMs = intervalMs ? overdueGraceMs(intervalMs) : 0;
  const slotHasPassed = previousExpectedMs !== null && options.nowMs >= previousExpectedMs + graceMs;
  const lastCompletedMs = lastCompletedMillis(options.lastCompletedAt);
  const lastCompletedCoversSlot = previousExpectedMs !== null && lastCompletedMs !== null
    && lastCompletedMs >= previousExpectedMs - graceMs;
  return slotHasPassed && !lastCompletedCoversSlot;
}
