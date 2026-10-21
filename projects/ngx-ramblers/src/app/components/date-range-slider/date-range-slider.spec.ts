import { DateTime } from "luxon";
import { dateRangeSliderAxisTicks } from "./date-range-slider";

describe("dateRangeSliderAxisTicks", () => {
  const start = DateTime.fromISO("2026-03-01", {zone: "Europe/London"}).startOf("day");
  const labelFor = (date: DateTime) => date.toFormat("dd MMM yyyy");

  it("returns no ticks when the span is empty", () => {
    expect(dateRangeSliderAxisTicks(null, 30, labelFor)).toEqual([]);
    expect(dateRangeSliderAxisTicks(start, 0, labelFor)).toEqual([]);
  });

  it("places a tick on each day of a short range", () => {
    const ticks = dateRangeSliderAxisTicks(start, 7, labelFor);
    expect(ticks.map(tick => tick.value)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(ticks[0].start).toBe(true);
    expect(ticks[0].end).toBe(false);
    expect(ticks[ticks.length - 1].end).toBe(true);
    expect(ticks[0].label).toBe("01 Mar 2026");
    expect(ticks[ticks.length - 1].label).toBe("08 Mar 2026");
  });

  it("keeps start and end on a year-long range and spaces ticks at least 12 percent apart", () => {
    const ticks = dateRangeSliderAxisTicks(start, 365, labelFor);
    expect(ticks[0].value).toBe(0);
    expect(ticks[ticks.length - 1].value).toBe(365);
    expect(ticks[0].label).toBe("01 Mar 2026");
    expect(ticks[ticks.length - 1].label).toBe("01 Mar 2027");
    const gaps = ticks.slice(1).map((tick, index) => tick.percent - ticks[index].percent);
    expect(gaps.every(gap => gap >= 12)).toBe(true);
  });
});
