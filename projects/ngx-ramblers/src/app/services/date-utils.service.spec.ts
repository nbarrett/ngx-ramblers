import { TestBed } from "@angular/core/testing";
import moment from "moment-timezone";
import { LoggerTestingModule } from "ngx-logger/testing";
import { DateUtilsService } from "./date-utils.service";
import { DateValue } from "../models/date.model";

import { ExtendedGroupEvent } from "../models/group-event.model";

function momentFor(startDate: string) {
  return moment(startDate).tz("Europe/London");
}

describe("DateUtilsService", () => {

  beforeEach(() => TestBed.configureTestingModule({
    imports: [LoggerTestingModule],
    providers: []
  }).compileComponents());

  describe("startTime for every day of 2024 (which is a leap year)", () => {
    it("should produce the correct start time for each day of 2024", () => {
      const expectedStartTime = {hours: 10, minutes: 0};
      for (let day = 1; day <= 366; day++) {
        const dateUtils: DateUtilsService = TestBed.inject(DateUtilsService);
        const date: string =  dateUtils.asMoment("2024-01-01").add(day - 1, "days").hours(expectedStartTime.hours).minutes(expectedStartTime.minutes).toISOString();
        const walk: ExtendedGroupEvent = {
          groupEvent: {start_date_time: date}
        } as ExtendedGroupEvent;
        const calculatedValue: number = dateUtils.startTimeAsValue(walk);
        const expectedValue = dateUtils.asMoment(date).valueOf();
        expect(calculatedValue).withContext(`Failed on date: ${momentFor(date).format("YYYY-MM-DD")}: calculatedValue:${dateUtils.isoDateTime(calculatedValue)}, expectedValue:${dateUtils.isoDateTime(expectedValue)}`).toEqual(expectedValue);
      }
    });
  });

  describe("asMoment", () => {

    it("should return a moment instance when passed a string and a date format", () => {
      const dateUtils: DateUtilsService = TestBed.inject(DateUtilsService);
      expect(dateUtils.asMoment("Weds 09 July 2014", "ddd DD MMMM YYYY").valueOf()
        - 1404860400000).toBeLessThan(2);
    });

    it("should support a Date as an argument", () => {
      const dateUtils: DateUtilsService = TestBed.inject(DateUtilsService);
      const injectedData = new Date(2018, 10, 15);
      expect(dateUtils.asMoment(injectedData).toDate()).toEqual(injectedData);
    });

    it("should support a DateValue as an argument", () => {
      const dateUtils: DateUtilsService = TestBed.inject(DateUtilsService);
      const dateValue: DateValue = dateUtils.asDateValue(1402614000000);
      expect(dateUtils.asMoment(dateValue).toDate()).toEqual(dateValue.date);
    });

    it("should support a number as an argument", () => {
      const dateUtils: DateUtilsService = TestBed.inject(DateUtilsService);
      const dateValue = 1402614000000;
      expect(dateUtils.asMoment(dateValue).valueOf()).toEqual(dateValue);
    });

  });

  describe("asDateValue", () => {

    it("should return DateValue instance when passed a string and a date format", () => {
      const dateUtils: DateUtilsService = TestBed.inject(DateUtilsService);
      const dateValue = dateUtils.asDateValue(1402614000000);
      expect(dateValue.value).toEqual(1402614000000);
      expect(dateValue.date.getDate()).toEqual(13);
      expect(dateValue.date.getMonth()).toEqual(5);
      expect(dateValue.date.getFullYear()).toEqual(2014);
    });

    it("should support a Date as an argument", () => {
      const dateUtils: DateUtilsService = TestBed.inject(DateUtilsService);
      const dateValue = dateUtils.asDateValue(new Date(2014, 5, 13));
      expect(dateValue.value).toEqual(1402614000000);
      expect(dateValue.date.getDate()).toEqual(13);
      expect(dateValue.date.getMonth()).toEqual(5);
      expect(dateValue.date.getFullYear()).toEqual(2014);
    });
  });

  describe("nowAsValue", () => {
    it("should return a millisecond timestamp value as of now", () => {
      const dateUtils: DateUtilsService = TestBed.inject(DateUtilsService);
      expect(dateUtils.nowAsValue() - Date.parse(new Date().toISOString())).toBeLessThan(2);
    });
  });

  describe("asValue", () => {

    it("should return a millisecond timestamp value passed a string and a date format", () => {
      const dateUtils: DateUtilsService = TestBed.inject(DateUtilsService);
      expect(dateUtils.asValue("Fri 13 June 2014", "ddd DD MMMM YYYY")).toEqual(1402614000000);
    });

    it("should return the same value when passed a millisecond timestamp value", () => {
      const dateUtils: DateUtilsService = TestBed.inject(DateUtilsService);
      expect(dateUtils.asValue(1404860400000)).toEqual(1404860400000);
    });

    it("should return a millisecond timestamp value without date when datePortionOnly is true", () => {
      const dateUtils: DateUtilsService = TestBed.inject(DateUtilsService);
      expect(dateUtils.asValueNoTime(1402697264866)).toEqual(1402614000000);
      expect(dateUtils.asValueNoTime(1402614000000)).toEqual(1402614000000);
    });

  });

  describe("asString", () => {

    it("should return string version of date given a timestamp, no input format and output format", () => {
      const dateUtils: DateUtilsService = TestBed.inject(DateUtilsService);
      expect(dateUtils.asString(1402697264866, undefined, "ddd DD MMMM YYYY, h:mm:ss a"))
        .toEqual("Fri 13 June 2014, 11:07:44 pm");
      expect(dateUtils.asString(1402614000000, undefined, "ddd DD MMMM YYYY, h:mm:ss a"))
        .toEqual("Fri 13 June 2014, 12:00:00 am");
      expect(dateUtils.asString(1402614000000, undefined, "ddd DD MMMM YYYY, h:mm:ss a"))
        .toEqual("Fri 13 June 2014, 12:00:00 am");
    });

    it("should return string version of date in format 2 given a string, input format 1 and output format 2", () => {
      const dateUtils: DateUtilsService = TestBed.inject(DateUtilsService);
      expect(dateUtils.asString("Fri 13 June 2014, 11:07:44 pm", "ddd DD MMMM YYYY, h:mm:ss a",
        "ddd DD MMMM YYYY, h:mm:ss a"))
        .toEqual("Fri 13 June 2014, 11:07:44 pm");
      expect(dateUtils.asString("Fri 13 June 2014, 11:07:44 pm", "ddd DD MMMM YYYY, h:mm:ss a",
        "DD-MMM-YYYY")).toEqual("13-Jun-2014");
    });

    it("should return invalid date if invalid string passed", () => {
      const dateUtils: DateUtilsService = TestBed.inject(DateUtilsService);

      expect(dateUtils.asString("10.0", "HH mm", "HH:mm")).toEqual("10:00");
      expect(dateUtils.asString("TBD", "HH mm", "HH:mm")).toEqual("Invalid date");
    });

  });


  describe("durationInMsecsForDistanceInMiles", () => {

    it("should calculate distance in ms based on miles where 2.5 miles covered per hour distance/2.5*60*60*1000", () => {
      const dateUtils: DateUtilsService = TestBed.inject(DateUtilsService);
      expect(dateUtils.durationInMsecsForDistanceInMiles("12 miles", 2.5)).toBe(17280000);
    });

    it("should accept a numeric input", () => {
      const dateUtils: DateUtilsService = TestBed.inject(DateUtilsService);
      expect(dateUtils.durationInMsecsForDistanceInMiles(10, 2.5)).toBe(14400000);
    });

  });

  describe("displayDateAndTime", () => {

    it("should display date with time", () => {
      const dateUtils: DateUtilsService = TestBed.inject(DateUtilsService);
      expect(dateUtils.displayDateAndTime(1576771476573)).toBe("Thursday, 19 December 2019, 4:04:36 pm");
      expect(dateUtils.displayDateAndTime(1580811420982)).toBe("Tuesday, 4 February 2020, 10:17:00 am");
    });

  });


});
