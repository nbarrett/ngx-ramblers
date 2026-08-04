import { DateTime } from "luxon";

export const BREVO_REPORT_MAX_DAYS = 90;

export function isIsoCalendarDate(value: string | undefined | null): boolean {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export function clampBrevoDayRange(
  startDate: string | undefined | null,
  endDate: string | undefined | null,
  todayUtc: string,
  maxDays: number = BREVO_REPORT_MAX_DAYS
): { startDate: string | undefined; endDate: string | undefined } {
  const start = clampIsoDayToUtcToday(startDate, todayUtc);
  const end = clampIsoDayToUtcToday(endDate, todayUtc);
  if (start && end && start > end) {
    return { startDate: end, endDate: end };
  } else if (start && end) {
    const startMs = isoDayUtcMillis(start);
    const endMs = isoDayUtcMillis(end);
    const spanDays = (endMs - startMs) / 86_400_000;
    if (spanDays >= maxDays) {
      const clampedStart = DateTime.fromMillis(endMs, {zone: "utc"})
        .minus({days: maxDays - 1})
        .toISODate();
      return {
        startDate: clampedStart ?? end,
        endDate: end
      };
    } else {
      return { startDate: start, endDate: end };
    }
  } else {
    return { startDate: start, endDate: end };
  }
}

function clampIsoDayToUtcToday(day: string | undefined | null, todayUtc: string): string | undefined {
  if (!day) {
    return undefined;
  } else if (!isIsoCalendarDate(day)) {
    return day;
  } else if (day > todayUtc) {
    return todayUtc;
  } else {
    return day;
  }
}

function isoDayUtcMillis(day: string): number {
  return DateTime.fromISO(day, {zone: "utc"}).startOf("day").toMillis();
}
