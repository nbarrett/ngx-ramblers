import { Time } from "@angular/common";
import { inject, Injectable } from "@angular/core";
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

  private logger: Logger = inject(LoggerFactory).createLogger("DateUtilsService", NgxLoggerLevel.ERROR);
  private numberUtils = inject(NumberUtilsService);
  MILLISECONDS_IN_ONE_DAY = 86400000;

  public formats = {
    displayTime: "h:mm a",
    displayTimeWithSeconds: "h:mm:ss a",
    displayDateAndTime: "dddd, D MMMM YYYY, h:mm:ss a",
    displayDateTh: "MMMM Do YYYY",
    displayDate: "dddd, D MMMM YYYY",
    displayDateNoDay: "D MMMM YYYY",
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

  asMoment(dateValue?: any, inputFormat?: string): moment {
    if (isDateValue(dateValue)) {
      return moment(dateValue.value, inputFormat).tz("Europe/London");
    } else {
      return moment(dateValue, inputFormat).tz("Europe/London");
    }
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

  displayTimeWithSeconds(dateValue: any): string {
    return this.asString(dateValue, undefined, this.formats.displayTimeWithSeconds);
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

  parseTime(startTime: string): Time {
    const parsedTime = startTime?.replace(".", ":");
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

  durationForDistanceInMiles(distance: string | number, milesPerHour: number): number {
    return this.numberUtils.asNumber(distance) / milesPerHour * 60 * 60 * 1000;
  }

  startTime(walk: Walk): number {
    if (walk) {
      const startTime: Time = this.parseTime(walk?.startTime);
      const walkDateMoment: moment = this.asMoment(walk?.walkDate);
      const walkDateAndTimeValue = this.calculateWalkDateAndTimeValue(walkDateMoment, startTime);
      this.logger.info("text based startTime:", walk?.startTime,
        "startTime:", startTime,
        "walkDateMoment:", walkDateMoment.format(),
        "displayDateAndTime(walkDateMoment):", this.displayDateAndTime(walkDateMoment),
        "walkDateAndTime:", walkDateAndTimeValue,
        "displayDateAndTime(walkDateAndTimeValue):", this.displayDateAndTime(walkDateAndTimeValue));
      return walkDateAndTimeValue;
    } else {
      return null;
    }
  }

  private calculateWalkDateAndTimeValue(walkDateMoment: moment, startTime: Time): number {
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

  inclusiveDayRange(fromDate: number, toDate: number): number[] {
    return range(fromDate, toDate + 1, this.MILLISECONDS_IN_ONE_DAY).map(item => this.asValueNoTime(item));
  }

  currentYear(): number {
    return +this.asString(this.momentNow().valueOf(), undefined, "YYYY");
  }

  formatDuration(fromTime: number, toTime: number) {
    const duration = moment.duration(toTime - fromTime);
    const seconds = duration.asSeconds();
    if (seconds < 1) {
      return `${(seconds * 1000)} ms`;
    } else if (seconds < 60) {
      return `${seconds.toFixed(0)} secs`;
    } else {
      const minutes = duration.asMinutes();
      return `${minutes.toFixed(1)} mins`;
    }
  }
}
