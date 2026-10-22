import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { DateTime } from "luxon";
import { LoggerTestingModule } from "ngx-logger/testing";
import { vi } from "vitest";
import { DateRangePresetLabel, DateRangeDirection } from "../../models/search.model";
import { DateUtilsService } from "../../services/date-utils.service";
import { DateRangeSelector } from "./date-range-selector";

describe("DateRangeSelector", () => {
  let selector: DateRangeSelector;
  const today = DateTime.fromISO("2026-10-23", {zone: "Europe/London"}).startOf("day");
  const minDate = today.minus({years: 2});
  const maxDate = today.plus({years: 1});

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LoggerTestingModule, DateRangeSelector],
      providers: [provideRouter([])]
    });
    const dateUtils = TestBed.inject(DateUtilsService);
    vi.spyOn(dateUtils, "dateTimeNowNoTime").mockReturnValue(today);
    selector = TestBed.createComponent(DateRangeSelector).componentInstance;
    selector.minDate = minDate;
    selector.maxDate = maxDate;
    selector.direction = DateRangeDirection.FUTURE;
    selector.range = {from: today.valueOf(), to: maxDate.valueOf()};
  });

  it("applies a wider preset after a narrower one", () => {
    const emitted: {from: number; to: number}[] = [];
    selector.rangeChange.subscribe(range => emitted.push(range));
    selector.selectPresetTab(DateRangePresetLabel.NEXT_7_DAYS);
    selector.selectPresetTab(DateRangePresetLabel.NEXT_30_DAYS);
    const last = emitted[emitted.length - 1];
    expect(selector.selectedPresetTab()).toBe(DateRangePresetLabel.NEXT_30_DAYS);
    expect(Math.round((last.to - last.from) / (24 * 60 * 60 * 1000))).toBe(30);
  });

  it("applies the full past span after a short future preset", () => {
    selector.selectPresetTab(DateRangePresetLabel.NEXT_7_DAYS);
    selector.direction = DateRangeDirection.PAST;
    expect(selector.selectedPresetTab()).toBe(DateRangePresetLabel.ALL_PAST_DATES);
    expect(selector.range.from).toBe(minDate.toMillis());
    expect(selector.range.to).toBe(today.toMillis());
  });
});
