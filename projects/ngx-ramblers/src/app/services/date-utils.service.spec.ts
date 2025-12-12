import { TestBed } from "@angular/core/testing";
import { DateTime } from "luxon";
import { LoggerTestingModule } from "ngx-logger/testing";
import { DateUtilsService } from "./date-utils.service";
import { DateValue } from "../models/date.model";
import { ExtendedGroupEvent } from "../models/group-event.model";
import { DateFormat } from "../models/ramblers-walks-manager";

function dateTimeFor(startDate: string): DateTime {
  return DateTime.fromISO(startDate).setZone("Europe/London");
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
        const date: string = dateUtils.asDateTime("2024-01-01").plus({ days: day - 1 }).set({ hour: expectedStartTime.hours, minute: expectedStartTime.minutes }).toISO();
        const walk: ExtendedGroupEvent = {
          groupEvent: {start_date_time: date}
        } as ExtendedGroupEvent;
        const calculatedValue: number = dateUtils.startTimeAsValue(walk);
        const expectedValue = dateUtils.asDateTime(date).toMillis();
        expect(calculatedValue).withContext(`Failed on date: ${dateTimeFor(date).toFormat(DateFormat.WALKS_MANAGER_API)}: calculatedValue:${dateUtils.isoDateTime(calculatedValue)}, expectedValue:${dateUtils.isoDateTime(expectedValue)}`).toEqual(expectedValue);
      }
    });
  });

  describe("asDateTime", () => {

    it("should return a DateTime instance when passed a string and a date format", () => {
      const dateUtils: DateUtilsService = TestBed.inject(DateUtilsService);
      expect(dateUtils.asDateTime("Wed 09 July 2014", "ccc dd MMMM yyyy").toMillis()
        - 1404860400000).toBeLessThan(2);
    });

    it("should support a Date as an argument", () => {
      const dateUtils: DateUtilsService = TestBed.inject(DateUtilsService);
      const injectedData = new Date(2018, 10, 15);
      expect(dateUtils.asDateTime(injectedData).toJSDate()).toEqual(injectedData);
    });

    it("should support a DateValue as an argument", () => {
      const dateUtils: DateUtilsService = TestBed.inject(DateUtilsService);
      const dateValue: DateValue = dateUtils.asDateValue(1402614000000);
      expect(dateUtils.asDateTime(dateValue).toJSDate()).toEqual(dateValue.date);
    });

    it("should support a number as an argument", () => {
      const dateUtils: DateUtilsService = TestBed.inject(DateUtilsService);
      const dateValue = 1402614000000;
      expect(dateUtils.asDateTime(dateValue).toMillis()).toEqual(dateValue);
    });

  });

  describe("asDateValue", () => {

    it("should return DateValue instance when passed a string and a date format", () => {
      const dateUtils: DateUtilsService = TestBed.inject(DateUtilsService);
      const dateValue = dateUtils.asDateValue(1402614000000);
      expect(dateValue.value).toEqual(1402614000000);
      const london = DateTime.fromMillis(dateValue.value).setZone("Europe/London");
      expect(london.day).toEqual(13);
      expect(london.month).toEqual(6);
      expect(london.year).toEqual(2014);
    });

    it("should support a Date as an argument", () => {
      const dateUtils: DateUtilsService = TestBed.inject(DateUtilsService);
      const dateValue = dateUtils.asDateValue(new Date(2014, 5, 13));
      expect(dateValue.value).toEqual(1402614000000);
      const london = DateTime.fromMillis(dateValue.value).setZone("Europe/London");
      expect(london.day).toEqual(13);
      expect(london.month).toEqual(6);
      expect(london.year).toEqual(2014);
    });
  });


  describe("parseTime", () => {

    it("should format morning time without minutes and optionally am suffix", () => {
      const dateUtils: DateUtilsService = TestBed.inject(DateUtilsService);
      expect(dateUtils.parseTime("10 am")).toEqual({hours: 10, minutes: 0});
      expect(dateUtils.parseTime("10.00")).toEqual({hours: 10, minutes: 0});
    });

    it("should format morning time with minutes and optionally am suffix", () => {
      const dateUtils: DateUtilsService = TestBed.inject(DateUtilsService);
      expect(dateUtils.parseTime("9.45")).toEqual({hours: 9, minutes: 45});
      expect(dateUtils.parseTime("9.45 am")).toEqual({hours: 9, minutes: 45});
    });

    it("should format evening time without minutes and pm suffix", () => {
      const dateUtils: DateUtilsService = TestBed.inject(DateUtilsService);
      expect(dateUtils.parseTime("10 pm")).toEqual({hours: 22, minutes: 0});
    });

    it("should format afternoon time without minutes", () => {
      const dateUtils: DateUtilsService = TestBed.inject(DateUtilsService);
      expect(dateUtils.parseTime("14:00")).toEqual({hours: 14, minutes: 0});
    });

    it("should format afternoon time with minutes", () => {
      const dateUtils: DateUtilsService = TestBed.inject(DateUtilsService);
      expect(dateUtils.parseTime("14:45")).toEqual({hours: 14, minutes: 45});
    });

    it("should parse morning time with minutes", () => {
      const dateUtils: DateUtilsService = TestBed.inject(DateUtilsService);
      expect(dateUtils.parseTime("5:30")).toEqual({hours: 5, minutes: 30});
    });

    it("should format evening time with minutes", () => {
      const dateUtils: DateUtilsService = TestBed.inject(DateUtilsService);
      expect(dateUtils.parseTime("17:49")).toEqual({hours: 17, minutes: 49});
      expect(dateUtils.parseTime("9.45 pm")).toEqual({hours: 21, minutes: 45});
      expect(dateUtils.parseTime("11.27 PM")).toEqual({hours: 23, minutes: 27});
      expect(dateUtils.parseTime("7:30 pm")).toEqual({hours: 19, minutes: 30});
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
      expect(dateUtils.asValue("Fri 13 June 2014", "ccc dd MMMM yyyy")).toEqual(1402614000000);
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
      expect(dateUtils.asString(1402697264866, undefined, "ccc dd MMMM yyyy, h:mm:ss a"))
        .toEqual("Fri 13 June 2014, 11:07:44 pm");
      expect(dateUtils.asString(1402614000000, undefined, "ccc dd MMMM yyyy, h:mm:ss a"))
        .toEqual("Fri 13 June 2014, 12:00:00 am");
      expect(dateUtils.asString(1402614000000, undefined, "ccc dd MMMM yyyy, h:mm:ss a"))
        .toEqual("Fri 13 June 2014, 12:00:00 am");
    });

    it("should return string version of date in format 2 given a string, input format 1 and output format 2", () => {
      const dateUtils: DateUtilsService = TestBed.inject(DateUtilsService);
      expect(dateUtils.asString("Fri 13 June 2014, 11:07:44 pm", "ccc dd MMMM yyyy, h:mm:ss a",
        "ccc dd MMMM yyyy, h:mm:ss a"))
        .toEqual("Fri 13 June 2014, 11:07:44 pm");
      expect(dateUtils.asString("Fri 13 June 2014, 11:07:44 pm", "ccc dd MMMM yyyy, h:mm:ss a",
        "dd-MMM-yyyy")).toEqual("13-Jun-2014");
    });

    it("should return invalid date if invalid string passed", () => {
      const dateUtils: DateUtilsService = TestBed.inject(DateUtilsService);

      expect(dateUtils.asString("10.0", "HH mm", "HH:mm")).toEqual("10:00");
      expect(dateUtils.asString("TBD", "HH mm", "HH:mm")).toEqual("Invalid DateTime");
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

  describe("formatDuration regression test", () => {

    it("should calculate duration correctly for same day walk times", () => {
      const dateUtils: DateUtilsService = TestBed.inject(DateUtilsService);

      const startDateTime = "2025-09-14T10:00:00+01:00";
      const endDateTime = "2025-09-14T16:00:00+01:00";

      const startValue = dateUtils.asDateValue(startDateTime)?.value;
      const endValue = dateUtils.asDateValue(endDateTime)?.value;

      const duration = dateUtils.formatDuration(startValue, endValue);
      expect(duration).toBe("6 hours");
    });

    it("should handle negative durations gracefully when end is before start", () => {
      const dateUtils: DateUtilsService = TestBed.inject(DateUtilsService);

      const startDateTime = "2025-09-15T10:00:00+01:00";
      const endDateTime = "2025-09-14T16:00:00+01:00";

      const startValue = dateUtils.asDateValue(startDateTime)?.value;
      const endValue = dateUtils.asDateValue(endDateTime)?.value;

      expect(startValue).toBeGreaterThan(endValue);

      const duration = dateUtils.formatDuration(startValue, endValue);
      expect(duration).toContain("-");
    });

    it("should validate that walks start and end on the same day", () => {
      const dateUtils: DateUtilsService = TestBed.inject(DateUtilsService);

      const sameDay1 = "2025-09-14T10:00:00+01:00";
      const sameDay2 = "2025-09-14T16:00:00+01:00";

      const dt1 = dateUtils.asDateTime(sameDay1);
      const dt2 = dateUtils.asDateTime(sameDay2);

      expect(dt1.hasSame(dt2, "day")).toBe(true);
    });

  });


});
