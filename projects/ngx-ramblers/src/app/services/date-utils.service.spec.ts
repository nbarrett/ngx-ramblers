import { TestBed } from "@angular/core/testing";
import moment from "moment-timezone";
import { LoggerTestingModule } from "ngx-logger/testing";
import { DateUtilsService } from "./date-utils.service";

describe("DateUtilsService", () => {

  beforeEach(() => TestBed.configureTestingModule({
    imports: [LoggerTestingModule],
    providers: []
  }).compileComponents());

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


  describe("durationForDistance", () => {

    it("should calculate distance in ms based on miles where 2.5 miles covered per hour distance/2.5*60*60*1000", () => {
      const dateUtils: DateUtilsService = TestBed.inject(DateUtilsService);
      expect(dateUtils.durationForDistance("12 miles")).toBe(17280000);
    });

    it("should accept a numeric input", () => {
      const dateUtils: DateUtilsService = TestBed.inject(DateUtilsService);
      expect(dateUtils.durationForDistance(10)).toBe(14400000);
    });

  });

  describe("displayDateAndTime", () => {

    it("should display date with time", () => {
      const dateUtils: DateUtilsService = TestBed.inject(DateUtilsService);
      expect(dateUtils.displayDateAndTime(1576771476573)).toBe("Thu 19-Dec-2019, 4:04:36 pm");
      expect(dateUtils.displayDateAndTime(1580811420982)).toBe("Tue 04-Feb-2020, 10:17:00 am");
    });

  });

  describe("parseTime", () => {

    it("should format morning time without minutes and optionally am suffix", () => {
      const dateUtils: DateUtilsService = TestBed.inject(DateUtilsService);
      const testMoment = moment();
      expect(dateUtils.parseTime("10 am")).toEqual({hours: 10, minutes: 0});
      expect(dateUtils.parseTime("10.00")).toEqual({hours: 10, minutes: 0});
    });

    it("should format morning time with minutes and optionally am suffix", () => {
      const dateUtils: DateUtilsService = TestBed.inject(DateUtilsService);
      const testMoment = moment();
      expect(dateUtils.parseTime("9.45")).toEqual({hours: 9, minutes: 45});
      expect(dateUtils.parseTime("9.45 am")).toEqual({hours: 9, minutes: 45});
    });

    it("should format evening time without minutes and pm suffix", () => {
      const dateUtils: DateUtilsService = TestBed.inject(DateUtilsService);
      const testMoment = moment();
      expect(dateUtils.parseTime("10 pm")).toEqual({hours: 22, minutes: 0});
    });

    it("should format afternoon time without minutes", () => {
      const dateUtils: DateUtilsService = TestBed.inject(DateUtilsService);
      const testMoment = moment();
      expect(dateUtils.parseTime("14:00")).toEqual({hours: 14, minutes: 0});
    });

    it("should format afternoon time with minutes", () => {
      const dateUtils: DateUtilsService = TestBed.inject(DateUtilsService);
      const testMoment = moment();
      expect(dateUtils.parseTime("14:45")).toEqual({hours: 14, minutes: 45});
    });

    it("should parse morning time with minutes", () => {
      const dateUtils: DateUtilsService = TestBed.inject(DateUtilsService);
      const testMoment = moment();
      expect(dateUtils.parseTime("5:30")).toEqual({hours: 5, minutes: 30});
    });

    it("should format evening time with minutes", () => {
      const dateUtils: DateUtilsService = TestBed.inject(DateUtilsService);
      const testMoment = moment();
      expect(dateUtils.parseTime("17:49")).toEqual({hours: 17, minutes: 49});
      expect(dateUtils.parseTime("9.45 pm")).toEqual({hours: 21, minutes: 45});
      expect(dateUtils.parseTime("11.27 PM")).toEqual({hours: 23, minutes: 27});
    });

  });

});
