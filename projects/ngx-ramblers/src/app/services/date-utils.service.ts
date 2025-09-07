import { Time } from "@angular/common";
import { inject, Injectable } from "@angular/core";
import range from "lodash-es/range";
import moment from "moment-timezone";
import { NgxLoggerLevel } from "ngx-logger";
import { DateValue } from "../models/date.model";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { NumberUtilsService } from "./number-utils.service";
import { isDateValue } from "./type-guards";
import { ExtendedGroupEvent } from "../models/group-event.model";
import { StringUtilsService } from "./string-utils.service";

@Injectable({
  providedIn: "root"
})

export class DateUtilsService {

  private logger: Logger = inject(LoggerFactory).createLogger("DateUtilsService", NgxLoggerLevel.ERROR);
  private numberUtils: NumberUtilsService = inject(NumberUtilsService);
  private stringUtilsService: StringUtilsService = inject(StringUtilsService);
  MILLISECONDS_IN_ONE_DAY = 86400000;

  public formats = {
    ramblersTime: "HH:mm",
    displayTime: "h:mm a",
    displayTimeWithSeconds: "h:mm:ss a",
    displayDateAndTime: "dddd, D MMMM YYYY, h:mm:ss a",
    displayDateTh: "MMMM Do YYYY",
    displayDate: "dddd, D MMMM YYYY",
    displayDateNoDay: "D MMMM YYYY",
    displayDay: "dddd MMMM D, YYYY",
    dayMonthYearWithSlashes: "DD/MM/YYYY",
    yearMonthDayWithDashes: "YYYY-MM-DD",
    yearMonthDay: "YYYYMMDD"
  };

  isMidnight(dateValue: any): boolean {
    const momentDate = this.asMoment(dateValue);
    return momentDate.hours() === 0 && momentDate.minutes() === 0;
  }

  yearFromDate(dateValue: number): number {
    return dateValue ? parseInt(this.asString(dateValue, undefined, "YYYY"), 10) : null;
  }

  isDate(value) {
    return value && this.asMoment(value).isValid();
  }

  asMoment(dateValue?: any, inputFormat?: string): moment {
    if (isDateValue(dateValue)) {
      // Treat stored numeric epoch as an instant; convert to Europe/London time
      return moment(dateValue.value, inputFormat).tz("Europe/London");
    }
    if (dateValue instanceof Date) {
      // Build the moment in Europe/London using the Date's local components to avoid env tz drift
      return moment.tz({
        year: dateValue.getFullYear(),
        month: dateValue.getMonth(),
        day: dateValue.getDate(),
        hour: dateValue.getHours(),
        minute: dateValue.getMinutes(),
        second: dateValue.getSeconds(),
        millisecond: dateValue.getMilliseconds()
      }, "Europe/London");
    }
    if (typeof dateValue === "string") {
      // Normalize some common time notations (e.g., "10.0" when format expects a space)
      let input = dateValue;
      if (inputFormat && /HH\s*mm/.test(inputFormat) && /\d+\.\d+/.test(input)) {
        input = input.replace(/\./g, " ");
      }
      // Parse string as local wall-clock in Europe/London (no shifting on zone apply)
      return moment(input, inputFormat).tz("Europe/London", true);
    }
    return moment(dateValue, inputFormat).tz("Europe/London");
  }

  momentNow(): moment {
    return this.asMoment();
  }

  asString(dateValue, inputFormat, outputFormat): string {
    return dateValue ? this.asMoment(dateValue, inputFormat).format(outputFormat) : undefined;
  }

  asValue(dateValue: any, inputFormat?: string): number {
    return this.asMoment(dateValue, inputFormat).valueOf();
  }

  nowAsValue(): number {
    return this.asMoment(undefined, undefined).valueOf();
  }

  displayDateAndTime(dateValue: any): string {
    return this.asString(dateValue, undefined, this.formats.displayDateAndTime);
  }

  displayDate(dateValue: any): string {
    return this.asString(dateValue, undefined, this.formats.displayDate);
  }

  displayDateNoDay(dateValue: any): string {
    return this.asString(dateValue, undefined, this.formats.displayDateNoDay);
  }

  displayDay(dateValue: any): string {
    return this.asString(dateValue, undefined, this.formats.displayDay);
  }

  displayTime(dateValue: any): string {
    return this.asString(dateValue, undefined, this.formats.displayTime);
  }

  ramblersTime(dateValue: any): string {
    return this.asString(dateValue, undefined, this.formats.ramblersTime);
  }

  yearMonthDayWithDashes(dateValue: any): string {
    return this.asString(dateValue, undefined, this.formats.yearMonthDayWithDashes);
  }

  displayTimeWithSeconds(dateValue: any): string {
    return this.asString(dateValue, undefined, this.formats.displayTimeWithSeconds);
  }

  isoDateTime(dateValue?: any): string {
    return this.asMoment(dateValue)?.format();
  }

  isoDateTimeStartOfDay(): string {
    return this.isoDateTime(this.momentNowNoTime());
  }

  asDateValue(dateValue?: any, inputFormat?: string): DateValue {
    const moment = this.asMoment(dateValue, inputFormat);
    return {
      value: moment.valueOf(),
      date: moment.toDate()
    };
  }

  asValueNoTime(dateValue?: any, inputFormat?: string): number {
    return this.asMoment(dateValue, inputFormat).startOf("day").valueOf();
  }

  momentNowNoTime(): moment {
    return this.asMoment().startOf("day");
  }

  convertDateFieldInObject(object, field) {
    const inputValue = object[field];
    object[field] = this.convertDateField(inputValue);
    return object;
  }

  convertDateField(inputValue: any) {
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
      const walkDateMoment: moment = this.asMoment(walk?.groupEvent?.start_date_time);
      const walkDateAndTimeValue: number = walkDateMoment.valueOf();
      this.logger.info("text based start_date_time:", walk?.groupEvent.start_date_time,
        "walkDateMoment:", walkDateMoment.format(),
        "displayDateAndTime(walkDateMoment):", this.displayDateAndTime(walkDateMoment));
      return walkDateAndTimeValue;
    } else {
      return null;
    }
  }

  inclusiveDayRange(fromDate: number, toDate: number): number[] {
    return range(fromDate, toDate + 1, this.MILLISECONDS_IN_ONE_DAY).map(item => this.asValueNoTime(item));
  }

  currentYear(): number {
    return +this.asString(this.momentNow().valueOf(), undefined, "YYYY");
  }

  formatDuration(fromTime: number, toTime: number) {
    const duration = moment.duration(toTime - fromTime);
    const seconds = duration.asSeconds();
    if (!fromTime || !toTime) {
      return "0 secs";
    } else if (seconds < 1) {
      return `${(seconds * 1000)} ms`;
    } else if (seconds < 60) {
      return `${seconds.toFixed(0)} secs`;
    } else if (seconds < 3600) {
      const minutes = duration.asMinutes();
      return `${minutes.toFixed(1)} mins`;
    } else if (seconds < 86400) {
      const hours = Math.floor(duration.asHours());
      const minutes = Math.round(duration.asMinutes() % 60);
      return `${this.stringUtilsService.pluraliseWithCount(hours, "hour")}${minutes > 0 ? ` ${this.stringUtilsService.pluraliseWithCount(minutes, "min")}` : ""}`;
    } else {
      const days = Math.floor(duration.asDays());
      const hours = Math.floor(duration.asHours() % 24);
      const minutes = Math.round(duration.asMinutes() % 60);
      let result = this.stringUtilsService.pluraliseWithCount(days, "day");
      if (hours > 0) {
        result += ` ${this.stringUtilsService.pluraliseWithCount(hours, "hour")}`;
      }
      if (minutes > 0) {
        result += ` ${this.stringUtilsService.pluraliseWithCount(minutes, "min")}`;
      }
      return result;
    }
  }

  calculateWalkDateAndTimeValue(walkDateMoment: moment, startTime: Time): number {
    let walkDateAndTime = walkDateMoment.clone().add(startTime?.hours, "hours").add(startTime?.minutes, "minutes");
    // Adjust for DST end transition
    if (walkDateMoment.isDST() && !walkDateAndTime.isDST()) {
      walkDateAndTime = walkDateAndTime.add(1, "hour");
    }
    // Adjust for DST start transition
    if (!walkDateMoment.isDST() && walkDateAndTime.isDST()) {
      walkDateAndTime = walkDateAndTime.subtract(1, "hour");
    }
    return walkDateAndTime.valueOf();
  }

  public parseCsvDate(dateValue: string, timeValue: string) {
    return this.startTimeFrom(timeValue, this.asMoment(dateValue).valueOf());
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
    const walkDateMoment: moment = this.asMoment(eventDate);
    const walkDateAndTimeValue = this.calculateWalkDateAndTimeValue(walkDateMoment, startTime);
    const toISOString = this.asMoment(walkDateAndTimeValue).toISOString();
    this.logger.debug("text based startTime:", startTime,
      "startTime:", startTime,
      "walkDateAndTimeValue:", walkDateAndTimeValue,
      "toISOString:", toISOString);
    return toISOString;
  }


}
