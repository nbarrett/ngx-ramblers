import { DateTime } from "luxon";
import {
  BREVO_REPORT_MAX_DAYS,
  clampBrevoDayRange
} from "../../../../projects/ngx-ramblers/src/app/functions/brevo-date-range";
import { dateTimeNow } from "../../shared/dates";

export function clampDateRange(
  startDate: string | undefined,
  endDate: string | undefined,
  maxDays: number = BREVO_REPORT_MAX_DAYS,
  now: DateTime = dateTimeNow()
): { startDate: string | undefined; endDate: string | undefined } {
  const todayUtc = now.toUTC().toISODate();
  if (!todayUtc) {
    return { startDate, endDate };
  } else {
    return clampBrevoDayRange(startDate, endDate, todayUtc, maxDays);
  }
}
