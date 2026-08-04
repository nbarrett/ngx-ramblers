import { DateTime } from "luxon";
import { dateTimeFromIso, dateTimeNow } from "../../shared/dates";

export function clampDateRange(
  startDate: string | undefined,
  endDate: string | undefined,
  maxDays: number = 90,
  now: DateTime = dateTimeNow()
): { startDate: string | undefined; endDate: string | undefined } {
  if (!startDate || !endDate) {
    return { startDate, endDate };
  } else {
    const start = dateTimeFromIso(startDate).startOf("day");
    const end = dateTimeFromIso(endDate).startOf("day");
    if (!start.isValid || !end.isValid) {
      return { startDate, endDate };
    } else {
      const todayUtc = now.toUTC().startOf("day");
      const todayLondon = now.startOf("day");
      const latestAllowed = todayUtc < todayLondon ? todayUtc : todayLondon;
      const cappedEnd = end > latestAllowed ? latestAllowed : end;
      const spanDays = cappedEnd.diff(start, "days").days;
      if (spanDays >= maxDays) {
        return {
          startDate: cappedEnd.minus({days: maxDays - 1}).toISODate()!,
          endDate: cappedEnd.toISODate()!
        };
      } else if (start > cappedEnd) {
        return {
          startDate: cappedEnd.toISODate()!,
          endDate: cappedEnd.toISODate()!
        };
      } else {
        return {
          startDate: start.toISODate()!,
          endDate: cappedEnd.toISODate()!
        };
      }
    }
  }
}
