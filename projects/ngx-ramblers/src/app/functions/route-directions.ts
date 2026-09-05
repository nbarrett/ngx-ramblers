import { MapMarker, PageContent, PageContentRow } from "../models/content-text.model";
import { routeRowIn } from "./map-location-markers";
import { RouteFollowPoint, RouteWaypointKind } from "../models/route-follow.model";
import { cumulativeDistances, nearestPointIndex, snapToRoute } from "./route-geometry";
import { ROUTE_ALTERNATIVE_MIN_FRACTION, ROUTE_TRACK_MAX_METRES, RouteTrackOption } from "../models/route-follow.model";

const DIRECTION_START = /^\s*(?:\d+[.)]|\(\d+\))\s+(.+?)\s*$/;
const BLOCK_BREAK = /^\s*(?:#{1,6}\s|\*\s\*\s\*|---|___|!\[)/;
const DIRECTION_WORDS = /\b(turn|left|right|follow|cross|path|stile|gate|footpath|bridleway|lane|track|continue|bear|keep|climb|descend|proceed|ahead|junction|signpost|fingerpost|field|pass|straight)\b/i;
const METADATA_LINE = /^\s*(distance|os map|start|refreshments?|parking|grade|time|length|map)\s*:/i;
const MIN_DIRECTION_PARAGRAPHS = 2;
const MOVEMENT_START = /^(?:turn|go|take|cross|follow|walk|head|continue|bear|keep|climb|descend|leave|proceed|make for|set off|exit|with (?:your|the) back|facing)\b/i;
const MIN_INTRODUCTION_WORDS = 4;

export function routeDirectionsFromText(text: string): string[] {
  const items = (text || "").split(/\r?\n/).reduce((collected: string[][], line) => {
    const start = line.match(DIRECTION_START);
    const current = collected[collected.length - 1];
    const open = !!current && current.length > 0;
    if (start) {
      collected.push([start[1]]);
    } else if (!line.trim() || BLOCK_BREAK.test(line)) {
      if (open) {
        collected.push([]);
      }
    } else if (open) {
      current.push(line.trim());
    }
    return collected;
  }, []);
  return items.filter(item => item.length > 0).map(item => item.join(" "));
}

function textsFromRows(rows: PageContentRow[]): string[] {
  return (rows || []).reduce((texts: string[], row) => {
    const fromColumns = (row.columns || []).reduce((inner: string[], column) => {
      const own = column.contentText ? [column.contentText] : [];
      return [...inner, ...own, ...textsFromRows(column.rows || [])];
    }, []);
    return [...texts, ...fromColumns];
  }, []);
}

function looksLikeDirection(paragraph: string): boolean {
  const words = paragraph.split(/\s+/).length;
  return words >= 6 && !METADATA_LINE.test(paragraph) && !BLOCK_BREAK.test(paragraph) && !/\]\(/.test(paragraph) && DIRECTION_WORDS.test(paragraph);
}

function startsWithMovement(paragraph: string): boolean {
  return MOVEMENT_START.test(paragraph.replace(/^[*_#>\s]+/, ""));
}

function paragraphsOf(text: string): string[] {
  return (text || "").split(/\r?\n\s*\r?\n/).map(paragraph => paragraph.replace(/\s+/g, " ").trim()).filter(paragraph => paragraph.length > 0);
}

const SCENE_SETTING = /^(?:there (?:is|are)\b|park(?:ing)?\b|start(?:ing)?\s+(?:from|at|in|by)\b|the (?:walk|route) (?:starts|begins)\b|(?:if )?approaching\b)/i;

function isSceneSetting(paragraph: string): boolean {
  return SCENE_SETTING.test(paragraph.replace(/^[*_#>\s]+/, ""));
}

function firstDirectionIndex(paragraphs: string[]): number {
  const chosen = paragraphs.map((paragraph, index) => ({paragraph, index})).find(item => looksLikeDirection(item.paragraph) && !isSceneSetting(item.paragraph));
  return chosen ? chosen.index : -1;
}

export function routeIntroductionFromText(text: string): string {
  const numberedStart = (text || "").split(/\r?\n/).findIndex(line => DIRECTION_START.test(line));
  const before = numberedStart > 0 && routeDirectionsFromText(text).length > 1
    ? paragraphsOf((text || "").split(/\r?\n/).slice(0, numberedStart).join("\n"))
    : (() => {
      const paragraphs = paragraphsOf(text);
      const first = firstDirectionIndex(paragraphs);
      return first > 0 ? paragraphs.slice(0, first) : [];
    })();
  return before
    .filter(paragraph => !METADATA_LINE.test(paragraph) && !BLOCK_BREAK.test(paragraph) && paragraph.split(/\s+/).length >= MIN_INTRODUCTION_WORDS)
    .join("\n\n");
}

export function routeIntroductionFromPage(page: PageContent | null | undefined): string {
  return routeIntroductionFromText(routeRowIn(page)?.routeGuide?.writtenDirections || "");
}

export function directionParagraphsFromText(text: string): string[] {
  const paragraphs = paragraphsOf(text);
  const first = firstDirectionIndex(paragraphs);
  const last = paragraphs.reduce((found, paragraph, index) => looksLikeDirection(paragraph) ? index : found, -1);
  const run = first >= 0 ? paragraphs.slice(first, last + 1).filter(paragraph => !METADATA_LINE.test(paragraph) && !BLOCK_BREAK.test(paragraph)) : [];
  return run.filter(looksLikeDirection).length >= MIN_DIRECTION_PARAGRAPHS ? run : [];
}

function longest(candidates: string[][]): string[] {
  return candidates.reduce((best, items) => items.length > best.length ? items : best, [] as string[]);
}

export function routeDirectionsFromRows(rows: PageContentRow[]): string[] {
  const texts = textsFromRows(rows);
  const numbered = longest(texts.map(routeDirectionsFromText));
  return numbered.length > 1 ? numbered : longest(texts.map(directionParagraphsFromText));
}

export function routeDirectionsFromPage(page: PageContent | null | undefined): string[] {
  const written = routeRowIn(page)?.routeGuide?.writtenDirections?.trim();
  if (written) {
    const numbered = routeDirectionsFromText(written);
    return numbered.length > 1 ? numbered : directionParagraphsFromText(written);
  } else {
    return page ? routeDirectionsFromRows(page.rows || []) : [];
  }
}

function pointAtDistance(points: RouteFollowPoint[], cumulative: number[], target: number): RouteFollowPoint {
  const index = cumulative.findIndex(distance => distance >= target);
  if (index <= 0) {
    return points[0];
  } else {
    const before = points[index - 1];
    const after = points[index];
    const span = cumulative[index] - cumulative[index - 1];
    const fraction = span > 0 ? (target - cumulative[index - 1]) / span : 0;
    return {
      latitude: before.latitude + (after.latitude - before.latitude) * fraction,
      longitude: before.longitude + (after.longitude - before.longitude) * fraction
    };
  }
}

export function distanceAlongRouteMetres(points: RouteFollowPoint[], marker: RouteFollowPoint): number | null {
  return points.length < 2 ? null : cumulativeDistances(points)[nearestPointIndex(points, marker)];
}

export function waypointsSpacedAlongRoute(points: RouteFollowPoint[], directions: string[], generateId: () => string): MapMarker[] {
  if (points.length < 2 || directions.length === 0) {
    return [];
  } else {
    const cumulative = cumulativeDistances(points);
    const total = cumulative[cumulative.length - 1];
    return directions.map((instruction, index) => {
      const position = pointAtDistance(points, cumulative, total * index / directions.length);
      return {
        id: generateId(),
        latitude: position.latitude,
        longitude: position.longitude,
        label: String(index + 1),
        instruction,
        kind: RouteWaypointKind.WAYPOINT
      };
    });
  }
}

export function markersOnTrack(markers: MapMarker[], points: RouteFollowPoint[], maxMetres = ROUTE_TRACK_MAX_METRES): MapMarker[] {
  if (points.length < 2) {
    return markers;
  } else {
    const cumulative = cumulativeDistances(points);
    return markers.filter(marker => !marker.instruction || (snapToRoute(points, cumulative, marker)?.distanceMetres ?? Infinity) <= maxMetres);
  }
}

export function trackOptions(tracks: {name?: string; points: RouteFollowPoint[]; totalDistance?: number}[]): RouteTrackOption[] {
  const names = tracks.map(track => (track.name || "").trim());
  const distinct = new Set(names.filter(name => !!name)).size === tracks.length;
  const metres = tracks.map(track => track.totalDistance || cumulativeDistances(track.points).slice(-1)[0] || 0);
  const longest = Math.max(0, ...metres);
  return tracks.map((track, index) => {
    const selectable = index === 0 || metres[index] >= longest * ROUTE_ALTERNATIVE_MIN_FRACTION;
    const alternatives = tracks.slice(0, index).filter((_, earlier) => earlier > 0 && metres[earlier] >= longest * ROUTE_ALTERNATIVE_MIN_FRACTION).length;
    const links = tracks.slice(0, index).filter((_, earlier) => earlier > 0 && metres[earlier] < longest * ROUTE_ALTERNATIVE_MIN_FRACTION).length;
    return {
      index,
      label: distinct ? names[index] : (index === 0 ? "Main route" : (selectable ? `Alternative ${alternatives + 1}` : `Link section ${links + 1}`)),
      distanceMiles: Math.round((metres[index] / 1609.344) * 10) / 10,
      selectable
    };
  });
}
