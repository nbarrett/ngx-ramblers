import { Time } from "@angular/common";
import { inject, Injectable } from "@angular/core";
import { range } from "es-toolkit";
import { isNumber, isString } from "es-toolkit/compat";
import { DateTime, Duration } from "luxon";
import { NgxLoggerLevel } from "ngx-logger";
import { DateValue } from "../models/date.model";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { NumberUtilsService } from "./number-utils.service";
import { isDateValue } from "./type-guards";
import { ExtendedGroupEvent } from "../models/group-event.model";
import { StringUtilsService } from "./string-utils.service";
import { UIDateFormat } from "../models/date-format.model";
import { asNumber } from "../functions/numbers";

type DateInput = string | number | Date | DateValue | DateTime;


@Injectable({
  providedIn: "root"
})

export class DateUtilsService {

  private logger: Logger = inject(LoggerFactory).createLogger("DateUtilsService", NgxLoggerLevel.ERROR);
  private numberUtils: NumberUtilsService = inject(NumberUtilsService);
  private stringUtilsService: StringUtilsService = inject(StringUtilsService);
  MILLISECONDS_IN_ONE_DAY = 86400000;

  public formats = {
    ramblersTime: UIDateFormat.RAMBLERS_TIME,
    displayTime: UIDateFormat.DISPLAY_TIME,
    displayTimeWithSeconds: UIDateFormat.DISPLAY_TIME_WITH_SECONDS,
    displayDateAndTime: UIDateFormat.DISPLAY_DATE_AND_TIME,
    displayDateTh: UIDateFormat.DISPLAY_DATE_TH,
    displayDate: UIDateFormat.DISPLAY_DATE,
    displayDateNoDay: UIDateFormat.DISPLAY_DATE_NO_DAY,
    displayDay: UIDateFormat.DISPLAY_DAY,
    dayMonthYearWithSlashes: UIDateFormat.DAY_MONTH_YEAR_WITH_SLASHES,
    yearMonthDayWithDashes: UIDateFormat.YEAR_MONTH_DAY_WITH_DASHES,
    yearMonthDay: UIDateFormat.YEAR_MONTH_DAY
  };

  isMidnight(dateValue: DateInput): boolean {
    const dateTime = this.asDateTime(dateValue);
    return dateTime.hour === 0 && dateTime.minute === 0;
  }

  yearFromDate(dateValue: number): number {
    return dateValue ? asNumber(this.asString(dateValue, undefined, "yyyy")) : null;
  }

  isDate(value) {
    return value && this.asDateTime(value).isValid;
  }

  asDateTime(dateValue?: DateInput, inputFormat?: string): DateTime {
    if (isDateValue(dateValue)) {
      return DateTime.fromMillis(dateValue.value).setZone("Europe/London");
    }
    if (dateValue instanceof Date) {
      return DateTime.fromObject({
        year: dateValue.getFullYear(),
        month: dateValue.getMonth() + 1,
        day: dateValue.getDate(),
        hour: dateValue.getHours(),
        minute: dateValue.getMinutes(),
        second: dateValue.getSeconds(),
        millisecond: dateValue.getMilliseconds()
      }, { zone: "Europe/London" });
    }
    if (isString(dateValue)) {
      let input = dateValue;
      if (inputFormat && /HH[\s]*mm/.test(inputFormat) && /\d+\.\d+/.test(input)) {
        const parts = input.split(".");
        const hours = parts[0].padStart(2, "0");
        const minutes = parts[1].padStart(2, "0");
        input = `${hours} ${minutes}`;
      }
      if (inputFormat) {
        return DateTime.fromFormat(input, inputFormat, { zone: "Europe/London" });
      } else {
        return DateTime.fromISO(input, { zone: "Europe/London" });
      }
    }
    if (isNumber(dateValue)) {
      return DateTime.fromMillis(dateValue).setZone("Europe/London");
    }
    return DateTime.now().setZone("Europe/London");
  }

  dateTimeNow(): DateTime {
    return this.asDateTime();
  }

  asString(dateValue, inputFormat, outputFormat): string {
    if (!dateValue) return undefined;
    const formatted = this.asDateTime(dateValue, inputFormat).toFormat(outputFormat);
    return this.convertToLowercaseAmPm(formatted);
  }

  private convertToLowercaseAmPm(formatted: string): string {
    return formatted.replace(/\bAM\b/g, "am").replace(/\bPM\b/g, "pm");
  }

  asValue(dateValue: DateInput, inputFormat?: string): number {
    return this.asDateTime(dateValue, inputFormat).toMillis();
  }

  nowAsValue(): number {
    return this.asDateTime(undefined, undefined).toMillis();
  }

  displayDateAndTime(dateValue: DateInput): string {
    return this.asString(dateValue, undefined, this.formats.displayDateAndTime);
  }

  displayDate(dateValue: DateInput): string {
    return this.asString(dateValue, undefined, this.formats.displayDate);
  }

  displayDateNoDay(dateValue: DateInput): string {
    return this.asString(dateValue, undefined, this.formats.displayDateNoDay);
  }

  displayDay(dateValue: DateInput): string {
    return this.asString(dateValue, undefined, this.formats.displayDay);
  }

  displayTime(dateValue: DateInput): string {
    return this.asString(dateValue, undefined, this.formats.displayTime);
  }

  ramblersTime(dateValue: DateInput): string {
    return this.asString(dateValue, undefined, this.formats.ramblersTime);
  }

  yearMonthDayWithDashes(dateValue: DateInput): string {
    return this.asString(dateValue, undefined, this.formats.yearMonthDayWithDashes);
  }

  displayTimeWithSeconds(dateValue: DateInput): string {
    return this.asString(dateValue, undefined, this.formats.displayTimeWithSeconds);
  }

  isoDateTime(dateValue?: DateInput): string {
    return this.asDateTime(dateValue)?.toISO({ suppressMilliseconds: true });
  }

  isoDateTimeNow(): string {
    return this.isoDateTime();
  }

  isoDateTimeStartOfDay(): string {
    return this.isoDateTime(this.dateTimeNowNoTime());
  }

  asDateValue(dateValue?: DateInput, inputFormat?: string): DateValue {
    const dateTime = this.asDateTime(dateValue, inputFormat);
    return {
      value: dateTime.toMillis(),
      date: dateTime.toJSDate()
    };
  }

  asValueNoTime(dateValue?: DateInput, inputFormat?: string): number {
    return this.asDateTime(dateValue, inputFormat).startOf("day").toMillis();
  }

  dateTimeNowNoTime(): DateTime {
    return this.asDateTime().startOf("day");
  }

  convertDateFieldInObject(object, field) {
    const inputValue = object[field];
    object[field] = this.convertDateField(inputValue);
    return object;
  }

  convertDateField(inputValue: DateInput) {
    if (inputValue) {
      const dateValue = this.asValueNoTime(inputValue);
      if (dateValue !== inputValue) {
        this.logger.debug("Converting date from", inputValue, "(" + this.displayDateAndTime(inputValue) + ") to", dateValue, "(" + this.displayDateAndTime(dateValue) + ")");
        return dateValue;
      } else {
        this.logger.debug(inputValue, inputValue, "is already in correct format");
        return inputValue;
      }
    } else {
      this.logger.debug(inputValue, "is not a date - no conversion");
      return inputValue;
    }
  }

  durationInMsecsForDistanceInMiles(distance: string | number, milesPerHour: number): number {
    return this.numberUtils.asNumber(distance) / milesPerHour * 60 * 60 * 1000;
  }

  startTimeAsValue(walk: ExtendedGroupEvent): number {
    if (walk) {
      const walkDateTime: DateTime = this.asDateTime(walk?.groupEvent?.start_date_time);
      const walkDateAndTimeValue: number = walkDateTime.toMillis();
      this.logger.info("text based start_date_time:", walk?.groupEvent.start_date_time,
        "walkDateTime:", this.isoDateTime(walkDateTime),
        "displayDateAndTime(walkDateTime):", this.displayDateAndTime(walkDateTime));
      return walkDateAndTimeValue;
    } else {
      return null;
    }
  }

  inclusiveDayRange(fromDate: number, toDate: number): number[] {
    return range(fromDate, toDate + 1, this.MILLISECONDS_IN_ONE_DAY).map(item => this.asValueNoTime(item));
  }

  currentYear(): number {
    return +this.asString(this.dateTimeNow().toMillis(), undefined, "yyyy");
  }

  formatDuration(fromTime: number, toTime: number) {
    if (isNumber(fromTime) && isNumber(toTime)) {
      const duration = Duration.fromMillis(toTime - fromTime);
      const seconds = duration.as("seconds");
      if (!fromTime || !toTime) {
        return "0 secs";
      } else if (seconds < 1) {
        return `${(seconds * 1000)} ms`;
      } else if (seconds < 60) {
        return `${seconds.toFixed(0)} secs`;
      } else if (seconds < 3600) {
        const minutes = duration.as("minutes");
        return `${minutes.toFixed(1)} mins`;
      } else if (seconds < 86400) {
        const hours = Math.floor(duration.as("hours"));
        const minutes = Math.round(duration.as("minutes") % 60);
        return `${this.stringUtilsService.pluraliseWithCount(hours, "hour")}${minutes > 0 ? ` ${this.stringUtilsService.pluraliseWithCount(minutes, "min")}` : ""}`;
      } else {
        const days = Math.floor(duration.as("days"));
        const hours = Math.floor(duration.as("hours") % 24);
        const minutes = Math.round(duration.as("minutes") % 60);
        let result = this.stringUtilsService.pluraliseWithCount(days, "day");
        if (hours > 0) {
          result += ` ${this.stringUtilsService.pluraliseWithCount(hours, "hour")}`;
        }
        if (minutes > 0) {
          result += ` ${this.stringUtilsService.pluraliseWithCount(minutes, "min")}`;
        }
        return result;
      }
    } else {
      this.logger.warn("formatDuration: both fromTime and toTime are not a number:fromTime:", fromTime, "toTime:", toTime);
      return "";
    }
  }

  calculateWalkDateAndTimeValue(walkDateTime: DateTime, startTime: Time): number {
    let walkDateAndTime = walkDateTime.plus({ hours: startTime?.hours, minutes: startTime?.minutes });
    if (walkDateTime.isInDST && !walkDateAndTime.isInDST) {
      walkDateAndTime = walkDateAndTime.plus({ hours: 1 });
    }
    if (!walkDateTime.isInDST && walkDateAndTime.isInDST) {
      walkDateAndTime = walkDateAndTime.minus({ hours: 1 });
    }
    return walkDateAndTime.toMillis();
  }

  public parseCsvDate(dateValue: string, timeValue: string) {
    return this.startTimeFrom(timeValue, this.asDateTime(dateValue).toMillis());
  }

  public parseTime(startTime: string): Time {
    const parsedTime = (startTime || "10:00 am")?.replace(".", ":");
    const timeValues = parsedTime?.split(":");
    if (timeValues) {
      let hours = this.numberUtils.asNumber(timeValues[0]);
      const minutes = this.numberUtils.asNumber(timeValues[1]);
      if (parsedTime.toLowerCase().includes("pm") && hours < 12) {
        hours += 12;
      }
      const returnValue = {hours, minutes};
      this.logger.off("parseTime:startTime", startTime, "parsedTime:", parsedTime, "timeValues:", timeValues, "returnValue:", returnValue);
      return returnValue;
    } else {
      this.logger.off("parseTime:startTime", startTime, "parsedTime:", parsedTime, "timeValues:", timeValues, "returnValue:", null);
      return null;
    }
  }

  public startTimeFrom(startTimeAsString: string, eventDate: number): string {
    const startTime: Time = this.parseTime(startTimeAsString);
    const walkDateTime: DateTime = this.asDateTime(eventDate);
    const walkDateAndTimeValue = this.calculateWalkDateAndTimeValue(walkDateTime, startTime);
    const toISOString = this.isoDateTime(walkDateAndTimeValue);
    this.logger.debug("text based startTime:", startTime,
      "startTime:", startTime,
      "walkDateAndTimeValue:", walkDateAndTimeValue,
      "toISOString:", toISOString);
    return toISOString;
  }




  dateTimeNowAsValue(): number {
    return this.dateTimeNow().toMillis();
  }

  parseDisplayDateWithFormat(dateString: string, format: string): DateTime | null {
    try {
      return DateTime.fromFormat(dateString, format);
    } catch (error) {
      return null;
    }
  }

  daysOfWeek(): string[] {
    const startOfWeek = this.dateTimeNow().startOf("week");
    return range(0, 7).map(offset => startOfWeek.plus({days: offset}).toFormat("cccc"));
  }

  mongoDayOfWeekFromName(dayName: string): number | null {
    if (!dayName) {
      return null;
    }
    const parsed = DateTime.fromFormat(dayName.trim(), "cccc");
    if (!parsed?.isValid) {
      return null;
    }
    return (parsed.weekday % 7) + 1;
  }

}
