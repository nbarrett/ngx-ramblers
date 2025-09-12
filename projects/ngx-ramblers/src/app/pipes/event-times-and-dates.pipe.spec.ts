import { TestBed } from "@angular/core/testing";
import { Settings } from "luxon";
import { EventDatesAndTimesPipe } from "./event-times-and-dates.pipe";
import { DateUtilsService } from "../services/date-utils.service";
import { DisplayTimePipe } from "./display-time.pipe";
import { LoggerTestingModule } from "ngx-logger/testing";
import { HasStartAndEndTime } from "../models/group-event.model";
import { EventTimesProps } from "../models/date.model";

describe("EventDatesAndTimesPipe", () => {
  let pipe: EventDatesAndTimesPipe;
  let dateUtilsService: DateUtilsService;
  let displayTimePipe: DisplayTimePipe;

  beforeAll(() => {
    Settings.defaultZone = "Europe/London";
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoggerTestingModule],
      providers: [
        EventDatesAndTimesPipe,
        DateUtilsService,
        DisplayTimePipe
      ]
    }).compileComponents();

    pipe = TestBed.inject(EventDatesAndTimesPipe);
    dateUtilsService = TestBed.inject(DateUtilsService);
    displayTimePipe = TestBed.inject(DisplayTimePipe);
  });

  describe("transform", () => {
    it("should return empty string when no start and end dates", () => {
      const event = {} as HasStartAndEndTime;
      expect(pipe.transform(event)).toBe("");
    });

    it("should return empty string when both dates are null", () => {
      const event = {
        start_date_time: null,
        end_date_time: null
      } as HasStartAndEndTime;
      expect(pipe.transform(event)).toBe("");
    });

    it("should format single day event with start and end times", () => {
      const event = {
        start_date_time: "2025-10-24T19:30:00+01:00",
        end_date_time: "2025-10-24T22:00:00+01:00"
      } as HasStartAndEndTime;

      const result = pipe.transform(event);

      expect(result).toContain("Friday, 24 October 2025");
      expect(result).toContain("7:30 pm");
      expect(result).toContain("10:00 pm");
      expect(result).toContain("—");
    });

    it("should format single day event with only start time", () => {
      const event = {
        start_date_time: "2025-12-08T16:00:00Z"
      } as HasStartAndEndTime;

      const result = pipe.transform(event);

      expect(result).toContain("Monday, 8 December 2025");
      expect(result).toContain("4:00 pm");
      expect(result).not.toContain("—");
    });

    it("should format multi-day event with different dates", () => {
      const event: HasStartAndEndTime = {
        start_date_time: "2025-12-08T16:00:00Z",
        end_date_time: "2025-12-10T20:00:00Z"
      };

      const result = pipe.transform(event);

      expect(result).toContain("Monday, 8 December 2025");
      expect(result).toContain("Wednesday, 10 December 2025");
      expect(result).toContain("4:00 pm");
      expect(result).toContain("8:00 pm");
      expect(result).toContain("—");
    });

    it("should respect noDates config option", () => {
      const event: HasStartAndEndTime = {
        start_date_time: "2025-10-24T19:30:00+01:00",
        end_date_time: "2025-10-24T22:00:00+01:00"
      };
      const config: EventTimesProps = {noDates: true};

      const result = pipe.transform(event, config);

      expect(result).not.toContain("Friday, 24 October 2025");
      expect(result).toContain("7:30 pm");
      expect(result).toContain("10:00 pm");
    });

    it("should respect noTimes config option", () => {
      const event: HasStartAndEndTime = {
        start_date_time: "2025-10-24T19:30:00+01:00",
        end_date_time: "2025-10-24T22:00:00+01:00"
      };
      const config: EventTimesProps = {noTimes: true};

      const result = pipe.transform(event, config);

      expect(result).toContain("Friday, 24 October 2025");
      expect(result).not.toContain("7:30 pm");
      expect(result).not.toContain("10:00 pm");
    });

    it("should add prefixes when configured", () => {
      const event: HasStartAndEndTime = {
        start_date_time: "2025-10-24T19:30:00+01:00",
        end_date_time: "2025-10-24T22:00:00+01:00"
      };
      const config: EventTimesProps = {prefixes: true};

      const result = pipe.transform(event, config);

      expect(result).toContain("Start time:");
      expect(result).toContain("Finish Time:");
    });

    it("handles British Summer Time timezone correctly", () => {
      const event = {
        start_date_time: "2025-06-15T14:00:00+01:00"
      } as HasStartAndEndTime;

      const result = pipe.transform(event);

      expect(result).toContain("Sunday, 15 June 2025");
      expect(result).toContain("2:00 pm");
    });

    it("converts UTC dates to Europe/London timezone", () => {
      const event = {
        start_date_time: "2025-12-08T16:00:00Z"
      } as HasStartAndEndTime;

      const result = pipe.transform(event);

      expect(result).toContain("Monday, 8 December 2025");
      expect(result).toContain("4:00 pm");
    });

    it("handles midnight and late night times correctly", () => {
      const event = {
        start_date_time: "2025-10-24T00:00:00+01:00",
        end_date_time: "2025-10-24T23:59:00+01:00"
      } as HasStartAndEndTime;

      const result = pipe.transform(event);

      expect(result).toContain("Friday, 24 October 2025");
      expect(result).toContain("11:59 pm");
    });

    it("handles events spanning different years correctly", () => {
      const event = {
        start_date_time: "2025-12-25T10:00:00Z",
        end_date_time: "2026-12-25T15:00:00Z"
      } as HasStartAndEndTime;

      const result = pipe.transform(event);

      expect(result).toContain("Thursday, 25 December 2025");
      expect(result).toContain("Friday, 25 December 2026");
    });

    it("handles invalid date strings gracefully without throwing", () => {
      const event = {
        start_date_time: "invalid-date"
      } as HasStartAndEndTime;

      expect(() => pipe.transform(event)).not.toThrow();
      const result = pipe.transform(event);
      expect(typeof result).toBe("string");
    });

    it("trims whitespace from formatted result", () => {
      const event = {
        start_date_time: "2025-10-24T19:30:00+01:00"
      } as HasStartAndEndTime;

      const result = pipe.transform(event);

      expect(result).toBe(result.trim());
      expect(result).not.toMatch(/^\s|\s$/);
    });
  });

  describe("date format consistency", () => {
    it("uses correct Luxon date format from DateUtilsService", () => {
      const event = {
        start_date_time: "2025-10-24T19:30:00+01:00"
      } as HasStartAndEndTime;

      const result = pipe.transform(event);
      expect(result).toContain("Friday, 24 October 2025");
    });

    it("handles DST transitions correctly for UK timezone", () => {
      const beforeDST = {
        start_date_time: "2025-10-25T12:00:00+01:00"
      } as HasStartAndEndTime;
      const afterDST = {
        start_date_time: "2025-10-27T12:00:00+00:00"
      } as HasStartAndEndTime;

      const beforeResult = pipe.transform(beforeDST);
      const afterResult = pipe.transform(afterDST);

      expect(beforeResult).toContain("Saturday, 25 October 2025");
      expect(afterResult).toContain("Monday, 27 October 2025");
      expect(beforeResult).toContain("12:00 pm");
      expect(afterResult).toContain("12:00 pm");
    });
  });
});
