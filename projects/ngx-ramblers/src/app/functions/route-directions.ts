import { MapMarker, PageContent, PageContentRow } from "../models/content-text.model";
import { routeRowIn } from "./map-location-markers";
import { RouteFollowPoint, RouteWaypointKind } from "../models/route-follow.model";
import { cumulativeDistances, nearestPointIndex } from "./route-geometry";

const DIRECTION_START = /^\s*(?:\d+[.)]|\(\d+\))\s+(.+?)\s*$/;
const BLOCK_BREAK = /^\s*(?:#{1,6}\s|\*\s\*\s\*|---|___|!\[)/;
const DIRECTION_WORDS = /\b(turn|left|right|follow|cross|path|stile|gate|footpath|bridleway|lane|track|continue|bear|keep|climb|descend|proceed|ahead|junction|signpost|fingerpost|field|pass|straight)\b/i;
const METADATA_LINE = /^\s*(distance|os map|start|refreshments?|parking|grade|time|length|map)\s*:/i;
const MIN_DIRECTION_PARAGRAPHS = 2;

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

export function directionParagraphsFromText(text: string): string[] {
  const paragraphs = (text || "").split(/\r?\n\s*\r?\n/).map(paragraph => paragraph.replace(/\s+/g, " ").trim()).filter(paragraph => paragraph.length > 0);
  const first = paragraphs.findIndex(looksLikeDirection);
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
