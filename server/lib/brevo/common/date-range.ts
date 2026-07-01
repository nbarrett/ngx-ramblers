import { dateTimeFromIso } from "../../shared/dates";

export function clampDateRange(startDate: string | undefined, endDate: string | undefined, maxDays: number = 90): { startDate: string | undefined; endDate: string | undefined } {
  if (!startDate || !endDate) return { startDate, endDate };
  const start = dateTimeFromIso(startDate);
  const end = dateTimeFromIso(endDate);
  if (!start.isValid || !end.isValid) return { startDate, endDate };
  return end.diff(start, "days").days >= maxDays
    ? { startDate: end.minus({days: maxDays - 1}).toISODate()!, endDate: end.toISODate()! }
    : { startDate, endDate };
}
