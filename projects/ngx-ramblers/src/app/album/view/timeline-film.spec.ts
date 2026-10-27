import { dayKey, spacedTimelineLabels, timelineIndexFromQuery, timelineLabelSlots, timelineSlides, timelineStartIndex, timelineTicks, visibleTimelineTicks, wheelScrubsFilm } from "./timeline-film";
import { ContentMetadataItem } from "../../models/content-metadata.model";

function item(id: string, date?: number): ContentMetadataItem {
  return {_id: id, image: `${id}.jpg`, date} as ContentMetadataItem;
}

describe("timeline film", () => {
  it("keeps album order when nothing is dated", () => {
    expect(timelineSlides([item("b"), item("a")]).map(s => s._id)).toEqual(["b", "a"]);
  });

  it("sorts by date and puts undated shots last", () => {
    const later = Date.parse("2026-09-15");
    const earlier = Date.parse("2026-04-10");
    expect(timelineSlides([item("u"), item("l", later), item("e", earlier)]).map(s => s._id)).toEqual(["e", "l", "u"]);
  });

  it("builds one tick per distinct day", () => {
    const a = Date.parse("2026-04-10T10:00:00");
    const b = Date.parse("2026-04-10T16:00:00");
    const c = Date.parse("2026-09-15T09:00:00");
    const ticks = timelineTicks([item("1", a), item("2", b), item("3", c)]);
    expect(ticks.map(t => t.key)).toEqual([dayKey(a), dayKey(c)]);
    expect(ticks[0].index).toBe(0);
    expect(ticks[1].index).toBe(2);
    expect(ticks[1].pct).toBe(100);
  });

  it("picks start, mid and end labels", () => {
    const ticks = [
      {index: 0, key: "a", pct: 0},
      {index: 2, key: "b", pct: 40},
      {index: 5, key: "c", pct: 100}
    ];
    expect(timelineLabelSlots(ticks)).toEqual({start: ticks[0], mid: ticks[1], end: ticks[2]});
  });

  it("spaces bar labels so they do not collide", () => {
    const ticks = [
      {index: 0, key: "a", pct: 0},
      {index: 1, key: "b", pct: 8},
      {index: 2, key: "c", pct: 40},
      {index: 3, key: "d", pct: 92},
      {index: 4, key: "e", pct: 100}
    ];
    expect(spacedTimelineLabels(ticks, 11).map(t => t.key)).toEqual(["a", "c", "e"]);
  });

  it("thins ticks and still keeps the current day", () => {
    const ticks = [
      {index: 0, key: "a", pct: 0},
      {index: 1, key: "b", pct: 2},
      {index: 2, key: "c", pct: 4},
      {index: 3, key: "d", pct: 50},
      {index: 4, key: "e", pct: 100}
    ];
    expect(visibleTimelineTicks(ticks, 10, "c").map(t => t.key)).toEqual(["a", "c", "d", "e"]);
  });

  it("maps a 1-based URL playhead onto a 0-based index", () => {
    expect(timelineIndexFromQuery("12", 20)).toBe(11);
    expect(timelineIndexFromQuery("1", 8)).toBe(0);
    expect(timelineIndexFromQuery("99", 5)).toBe(4);
    expect(timelineIndexFromQuery(null, 5)).toBeNull();
    expect(timelineIndexFromQuery("nope", 5)).toBeNull();
  });

  it("starts at the newest shot when playing backwards", () => {
    expect(timelineStartIndex(false, 10)).toBe(9);
    expect(timelineStartIndex(true, 10)).toBe(0);
    expect(timelineStartIndex(false, 0)).toBe(0);
  });

  it("lets the page scroll on vertical wheel and scrubs the film on horizontal", () => {
    expect(wheelScrubsFilm(40, 4)).toBe(true);
    expect(wheelScrubsFilm(0, 40)).toBe(false);
  });
});
