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