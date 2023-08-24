import { Time } from "@angular/common";
import { Injectable } from "@angular/core";
import range from "lodash-es/range";
import moment from "moment-timezone";
import { NgxLoggerLevel } from "ngx-logger";
import { DateValue } from "../models/date.model";
import { Walk } from "../models/walk.model";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { NumberUtilsService } from "./number-utils.service";
import { isDateValue } from "./type-guards";

@Injectable({
  providedIn: "root"
})

export class DateUtilsService {

  private logger: Logger;
  MILLISECONDS_IN_ONE_DAY = 86400000;

  constructor(private numberUtils: NumberUtilsService,
              private loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(DateUtilsService, NgxLoggerLevel.OFF);
  }

  public formats = {
    displayTime: "h:mm a",
    displayDateAndTime: "ddd DD-MMM-YYYY, h:mm:ss a",
    displayDateTh: "MMMM Do YYYY",
    displayDate: "ddd DD-MMM-YYYY",
    displayDay: "dddd MMMM D, YYYY",
    ddmmyyyyWithSlashes: "DD/MM/YYYY",
    yyyymmdd: "YYYYMMDD"
  };

  yearFromDate(dateValue: number): number {
    return dateValue ? parseInt(this.asString(dateValue, undefined, "YYYY"), 10) : null;
  }

  isDate(value) {
    return value && this.asMoment(value).isValid();
  }

  asDate(value): Date {
    return value && this.asMoment(value).toDate();
  }

  asMoment(dateValue?: any, inputFormat?: string) {
    if (isDateValue(dateValue)) {
      return moment(dateValue.value, inputFormat).tz("Europe/London");
    } else {
      return moment(dateValue, inputFormat).tz("Europe/London");
    }
  }

  momentNow() {
    return this.asMoment();
  }

  asString(dateValue, inputFormat, outputFormat): string {
    return dateValue ? this.asMoment(dateValue, inputFormat).format(outputFormat) : undefined;
  }

  asValue(dateValue: any, inputFormat?: string) {
    return this.asMoment(dateValue, inputFormat).valueOf();
  }

  nowAsValue(): number {
    return this.asMoment(undefined, undefined).valueOf();
  }

  mailchimpDate(dateValue): string {
    return this.asString(dateValue, undefined, this.formats.ddmmyyyyWithSlashes);
  }

  displayDateAndTime(dateValue): string {
    return this.asString(dateValue, undefined, this.formats.displayDateAndTime);
  }

  displayDate(dateValue): string {
    return this.asString(dateValue, undefined, this.formats.displayDate);
  }

  displayDay(dateValue): string {
    return this.asString(dateValue, undefined, this.formats.displayDay);
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

  currentMemberBulkLoadDisplayDate() {
    return this.asString(this.momentNowNoTime().startOf("month"), undefined, this.formats.yyyymmdd);
  }

  momentNowNoTime() {
    return this.asMoment().startOf("day");
  }

  convertDateFieldInObject(object, field) {
    const inputValue = object[field];
    object[field] = this.convertDateField(inputValue);
    return object;
  }

  convertDateField(inputValue) {
    if (inputValue) {
      const dateValue = this.asValueNoTime(inputValue);
      if (dateValue !== inputValue) {
        this.logger.debug("Converting date from", inputValue, "(" + this.displayDateAndTime(inputValue) + ") to",
          dateValue, "(" + this.displayDateAndTime(dateValue) + ")");
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

  parseTime(startTime: string): Time {
    const parsedTime = startTime.replace(".", ":");
    const timeValues = parsedTime.split(":");
    let hours = this.numberUtils.asNumber(timeValues[0]);
    const minutes = this.numberUtils.asNumber(timeValues[1]);
    if (parsedTime.toLowerCase().includes("pm") && hours < 12) {
      hours += 12;
    }
    return {hours, minutes};
  }

  durationForDistance(distance: string | number): number {
    return this.numberUtils.asNumber(distance) / 2.5 * 60 * 60 * 1000;
  }

  startTime(walk: Walk): number {
    const startTime: Time = this.parseTime(walk.startTime);
    return this.asMoment(walk.walkDate).add(startTime.hours, "hours").add(startTime.minutes, "minutes").valueOf();
  }

  inclusiveDayRange(fromDate: number, toDate: number): number[] {
    return range(fromDate, toDate + 1, this.MILLISECONDS_IN_ONE_DAY);
  }

}
