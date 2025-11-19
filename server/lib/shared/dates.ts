import { DateTime } from "luxon";

export function dateTimeNowAsValue(): number {
  return dateTimeNow().toMillis();
}

export function dateTimeNow(): DateTime {
  return DateTime.now().setZone("Europe/London");
}

export function dateTimeInTimezone(time: string, format?: string): DateTime {
  return format ? DateTime.fromFormat(time, format, { zone: "Europe/London" }) : DateTime.fromISO(time, { zone: "Europe/London" });
}

export function dateTimeFromMillis(value: number): DateTime {
  return DateTime.fromMillis(value).setZone("Europe/London");
}

export function dateTimeFromIso(value: string): DateTime {
  return DateTime.fromISO(value, {zone: "Europe/London"});
}

export function dateTimeFromJsDate(value: Date): DateTime {
  return DateTime.fromJSDate(value).setZone("Europe/London");
}

export function dateTimeFromObject(obj: { year: number; month?: number; day?: number; hour?: number; minute?: number; second?: number; millisecond?: number }): DateTime {
  return DateTime.fromObject(obj, {zone: "Europe/London"});
}

export function clampMillisToEarliest(value: number, earliest?: number): number {
  if (!earliest || earliest <= 0) {
    return value;
  }
  return Math.max(value, earliest);
}
