import { DateTime } from "luxon";
import { ContentMetadataItem } from "../../models/content-metadata.model";

export type TimelineTick = {
  index: number;
  key: string;
  pct: number;
};

export function timelineSlides(items: ContentMetadataItem[] | undefined): ContentMetadataItem[] {
  const list = [...(items || [])];
  const dated = list.some(item => item?.date);
  if (dated) {
    return list.sort((a, b) => (a.date || Number.MAX_SAFE_INTEGER) - (b.date || Number.MAX_SAFE_INTEGER));
  } else {
    return list;
  }
}

export function dayKey(date?: number): string | null {
  if (date) {
    const parsed = DateTime.fromMillis(date);
    if (parsed.isValid) {
      return parsed.toISODate();
    } else {
      return null;
    }
  } else {
    return null;
  }
}

export function timelineTicks(slides: ContentMetadataItem[]): TimelineTick[] {
  const seen = new Set<string>();
  const ticks: TimelineTick[] = [];
  const last = Math.max(1, slides.length - 1);
  slides.forEach((slide, index) => {
    const key = dayKey(slide.date);
    if (key && !seen.has(key)) {
      seen.add(key);
      ticks.push({index, key, pct: (index / last) * 100});
    }
  });
  return ticks;
}

export function timelineLabelSlots(ticks: TimelineTick[]): {start?: TimelineTick; mid?: TimelineTick; end?: TimelineTick} {
  if (ticks.length === 0) {
    return {};
  } else if (ticks.length === 1) {
    return {start: ticks[0]};
  } else {
    const mid = ticks.length >= 3 ? ticks[Math.floor(ticks.length / 2)] : undefined;
    return {start: ticks[0], mid, end: ticks[ticks.length - 1]};
  }
}

export function spacedTimelineLabels(ticks: TimelineTick[], minPct: number): TimelineTick[] {
  let chosen: TimelineTick[] = [];
  if (ticks.length === 0) {
    chosen = [];
  } else if (ticks.length === 1) {
    chosen = [ticks[0]];
  } else {
    const last = ticks[ticks.length - 1];
    chosen = [ticks[0]];
    ticks.slice(1, -1).forEach(mark => {
      const prev = chosen[chosen.length - 1];
      if (mark.pct - prev.pct >= minPct && last.pct - mark.pct >= minPct) {
        chosen.push(mark);
      }
    });
    const prev = chosen[chosen.length - 1];
    if (last.pct - prev.pct >= minPct * 0.55) {
      chosen.push(last);
    } else if (prev.key !== last.key) {
      chosen[chosen.length - 1] = last;
    }
  }
  return chosen;
}

export function visibleTimelineTicks(ticks: TimelineTick[], minPct: number, currentKey?: string): TimelineTick[] {
  const chosen = spacedTimelineLabels(ticks, minPct);
  const extra = currentKey ? ticks.find(tick => tick.key === currentKey) : undefined;
  let result = chosen;
  if (extra && !chosen.some(tick => tick.key === extra.key)) {
    result = [...chosen, extra].sort((a, b) => a.pct - b.pct);
  }
  return result;
}

export function timelineIndexFromQuery(raw: string | null | undefined, length: number): number | null {
  const parsed = Number(raw);
  if (raw && Number.isFinite(parsed) && length > 0) {
    return Math.max(0, Math.min(length - 1, Math.round(parsed) - 1));
  } else {
    return null;
  }
}

export function timelineStartIndex(forwards: boolean, length: number): number {
  return forwards || length === 0 ? 0 : length - 1;
}

export function wheelScrubsFilm(deltaX: number, deltaY: number): boolean {
  return Math.abs(deltaX) >= Math.abs(deltaY);
}
