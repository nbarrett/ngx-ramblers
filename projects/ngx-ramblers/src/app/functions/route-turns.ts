import {
  RouteFollowPoint,
  RouteTurnModifier,
  RouteTurnStep,
  RouteTurnStepKind,
  RouteWayName,
  ValhallaTraceAttributes
} from "../models/route-follow.model";
import { firstIndexAtLeast, lastIndexAtMost, bearingBetween, cumulativeDistances, metresBetween, nearestPointIndex } from "./route-geometry";

export const TURN_LOOKAHEAD_METRES = 25;
export const TURN_MIN_DEGREES = 30;
export const TURN_MERGE_METRES = 40;
const SLIGHT_DEGREES = 60;
const SHARP_DEGREES = 120;
const U_TURN_DEGREES = 165;
const MIN_NAME_LENGTH = 4;
export const PLACE_MAX_METRES_FROM_ROUTE = 250;
const NAME_CONNECTORS = ["of", "the", "and", "on", "de", "le", "la"];
const GENERIC_PLACE_WORDS = ["church", "inn", "inns", "pub", "school", "station", "bridge", "river", "lane", "road", "street", "hill", "farm", "wood", "woods", "mill", "hall", "green", "common", "park", "castle", "path", "footpath", "track", "gate", "stile", "field", "fields", "junction", "t-junction", "crossroads", "village", "town", "car", "cottages", "house", "houses", "meadow", "lake", "lakes", "pond", "weir", "bridleway", "byway", "estate", "manor", "court", "corner", "way"];
const NAME_STOP_WORDS = ["turn", "continue", "take", "here", "near", "when", "once", "return", "bear", "cross", "leave", "descend", "follow", "keep", "pass", "preferably", "there", "the", "you", "walk", "after", "as", "at", "on", "in", "from", "to", "or", "go", "this", "these", "then", "now", "climb", "head", "ignore", "just", "look", "carry", "retrace", "before", "beyond", "where", "if", "it", "a", "an", "and", "but", "with", "over", "under", "through", "along", "onto", "into", "up", "down", "left", "right", "ahead", "straight", "please", "note", "beware", "care", "taking", "stay", "join", "rejoin", "start", "finish", "end", "well", "some", "many", "much", "next", "last", "first", "second", "third", "your", "our", "we", "they", "he", "she", "i", "no", "not", "yes", "so", "very", "quite", "rather", "also", "eventually", "immediately", "soon", "shortly", "later", "again", "back", "half", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "mile", "miles", "metres", "yards", "km", "m", "l", "r", "t"];
const UNMATCHED = "unmatched";
const NARRATIVE_WINDOW = 0.5;
const SQUEEZED_SENTENCES = 3;
const WAY_REFERENCE = /^(?:[A-Z]{1,3}\s?\d{1,4}[A-Z]?|\d{2,5}|[A-Z0-9]{1,6}(?:\/[A-Z0-9]{1,6})+)$/;
const COMPASS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
const WAY_LABELS: {[use: string]: string} = {
  footway: "the footpath",
  path: "the path",
  track: "the track",
  bridleway: "the bridleway",
  cycleway: "the cycle path",
  steps: "the steps",
  pedestrian_crossing: "the crossing",
  service_road: "the service road",
  living_street: "the street",
  alley: "the alley",
  driveway: "the driveway"
};
const ROTATION: {[modifier: string]: number} = {
  [RouteTurnModifier.STRAIGHT]: 0,
  [RouteTurnModifier.SLIGHT_LEFT]: -45,
  [RouteTurnModifier.LEFT]: -90,
  [RouteTurnModifier.SHARP_LEFT]: -135,
  [RouteTurnModifier.SLIGHT_RIGHT]: 45,
  [RouteTurnModifier.RIGHT]: 90,
  [RouteTurnModifier.SHARP_RIGHT]: 135,
  [RouteTurnModifier.U_TURN]: 180
};

export function bearingChange(before: number, after: number): number {
  const raw = ((after - before) % 360 + 540) % 360 - 180;
  return raw === -180 ? 180 : raw;
}

export function compassDirection(bearing: number): string {
  return COMPASS[Math.round(((bearing % 360) + 360) % 360 / 45) % 8];
}

export function turnModifierFor(change: number): RouteTurnModifier | null {
  const size = Math.abs(change);
  const left = change < 0;
  if (size < TURN_MIN_DEGREES) {
    return null;
  } else if (size >= U_TURN_DEGREES) {
    return RouteTurnModifier.U_TURN;
  } else if (size >= SHARP_DEGREES) {
    return left ? RouteTurnModifier.SHARP_LEFT : RouteTurnModifier.SHARP_RIGHT;
  } else if (size >= SLIGHT_DEGREES) {
    return left ? RouteTurnModifier.LEFT : RouteTurnModifier.RIGHT;
  } else {
    return left ? RouteTurnModifier.SLIGHT_LEFT : RouteTurnModifier.SLIGHT_RIGHT;
  }
}

export function turnRotationDegrees(modifier: RouteTurnModifier | null | undefined): number {
  return modifier ? ROTATION[modifier] ?? 0 : 0;
}

function pointAtLeast(points: RouteFollowPoint[], cumulative: number[], index: number, metres: number, direction: -1 | 1): RouteFollowPoint {
  const target = cumulative[index] + direction * metres;
  const last = points.length - 1;
  const chosen = direction === 1
    ? (index >= last ? last : firstIndexAtLeast(cumulative, target, index + 1, last))
    : (index <= 0 ? 0 : lastIndexAtMost(cumulative, target, 0, index - 1));
  return points[chosen];
}

export function travelBearingAt(points: RouteFollowPoint[], index: number): number | null {
  if (points.length < 2 || index < 0 || index >= points.length) {
    return null;
  } else {
    const cumulative = cumulativeDistances(points);
    const from = index === points.length - 1 ? pointAtLeast(points, cumulative, index, TURN_LOOKAHEAD_METRES, -1) : points[index];
    const to = index === points.length - 1 ? points[index] : pointAtLeast(points, cumulative, index, TURN_LOOKAHEAD_METRES, 1);
    return bearingBetween(from, to);
  }
}

export function turnCandidates(points: RouteFollowPoint[]): {index: number; change: number}[] {
  if (points.length < 3) {
    return [];
  } else {
    const cumulative = cumulativeDistances(points);
    const raw = points.slice(1, -1).map((point, offset) => {
      const index = offset + 1;
      const before = pointAtLeast(points, cumulative, index, TURN_LOOKAHEAD_METRES, -1);
      const after = pointAtLeast(points, cumulative, index, TURN_LOOKAHEAD_METRES, 1);
      return {index, change: bearingChange(bearingBetween(before, point), bearingBetween(point, after))};
    }).filter(candidate => Math.abs(candidate.change) >= TURN_MIN_DEGREES);
    return raw.reduce((merged: {index: number; change: number}[], candidate) => {
      const last = merged[merged.length - 1];
      if (last && cumulative[candidate.index] - cumulative[last.index] <= TURN_MERGE_METRES) {
        if (Math.abs(candidate.change) > Math.abs(last.change)) {
          merged[merged.length - 1] = candidate;
        }
      } else {
        merged.push(candidate);
      }
      return merged;
    }, []);
  }
}

export function isWayReference(name: string | null | undefined): boolean {
  return WAY_REFERENCE.test((name || "").trim());
}

export function wayLabel(way: RouteWayName | null | undefined): string {
  if (way?.name) {
    return way.name;
  } else if (way?.use && WAY_LABELS[way.use]) {
    return WAY_LABELS[way.use];
  } else if (way?.use) {
    return "the road";
  } else {
    return "";
  }
}

function wayNear(wayNames: (RouteWayName | null)[], index: number, direction: -1 | 1): RouteWayName | null {
  const span = [1, 2, 3].map(offset => wayNames[index + offset * direction]).find(way => !!way);
  return span || wayNames[index] || null;
}

function isSlight(modifier: RouteTurnModifier | null): boolean {
  return modifier === RouteTurnModifier.SLIGHT_LEFT || modifier === RouteTurnModifier.SLIGHT_RIGHT;
}

function sameWay(before: RouteWayName | null, after: RouteWayName | null): boolean {
  return (before?.name || "") === (after?.name || "") && (before?.use || "") === (after?.use || "");
}

function turnVerb(modifier: RouteTurnModifier): string {
  if (modifier === RouteTurnModifier.SLIGHT_LEFT) {
    return "Bear left";
  } else if (modifier === RouteTurnModifier.SLIGHT_RIGHT) {
    return "Bear right";
  } else if (modifier === RouteTurnModifier.LEFT) {
    return "Turn left";
  } else if (modifier === RouteTurnModifier.RIGHT) {
    return "Turn right";
  } else if (modifier === RouteTurnModifier.SHARP_LEFT) {
    return "Turn sharp left";
  } else if (modifier === RouteTurnModifier.SHARP_RIGHT) {
    return "Turn sharp right";
  } else if (modifier === RouteTurnModifier.U_TURN) {
    return "Turn back on yourself";
  } else {
    return "Continue straight on";
  }
}

function turnInstruction(modifier: RouteTurnModifier, before: RouteWayName | null, after: RouteWayName | null): string {
  const verb = turnVerb(modifier);
  const label = wayLabel(after);
  if (!label) {
    return verb;
  } else if (after?.name && before?.name === after.name) {
    return `${verb} to stay on ${label}`;
  } else if (after?.name) {
    return `${verb} onto ${label}`;
  } else {
    return `${verb} along ${label}`;
  }
}

export function routeTurnSteps(points: RouteFollowPoint[], wayNames: (RouteWayName | null)[]): RouteTurnStep[] {
  if (points.length < 2) {
    return [];
  } else {
    const cumulative = cumulativeDistances(points);
    const last = points.length - 1;
    const turns = turnCandidates(points).map(candidate => {
      const modifier = turnModifierFor(candidate.change);
      const before = wayNear(wayNames, candidate.index, -1);
      const after = wayNear(wayNames, candidate.index, 1);
      return {
        index: candidate.index,
        kind: RouteTurnStepKind.TURN,
        modifier,
        bearingChange: candidate.change,
        way: after,
        bend: isSlight(modifier) && sameWay(before, after),
        instruction: turnInstruction(modifier, before, after)
      };
    }).filter(turn => !turn.bend);
    const turnDistances = turns.map(turn => cumulative[turn.index]);
    const nameChanges = wayNames.reduce((changes: {index: number; way: RouteWayName}[], way, index) => {
      const previous = index > 0 ? wayNames[index - 1]?.name || "" : "";
      const candidate = index > 0 && index < last && !!way?.name && way.name !== previous;
      if (candidate) {
        const nearestTurn = firstIndexAtLeast(turnDistances, cumulative[index] - TURN_MERGE_METRES, 0, turnDistances.length);
        const nearTurn = nearestTurn < turnDistances.length && turnDistances[nearestTurn] - cumulative[index] <= TURN_MERGE_METRES;
        const lastTurnBefore = turns.reduce((found: typeof turns[number] | undefined, turn) => turn.index < index ? turn : found, undefined);
        const lastChange = changes[changes.length - 1];
        const lastStepBefore = [lastTurnBefore, lastChange].filter(step => !!step).sort((left, right) => right.index - left.index)[0];
        const alreadyNamed = !!lastStepBefore && lastStepBefore.way?.name === way?.name;
        if (!nearTurn && !alreadyNamed) {
          changes.push({index, way});
        }
      }
      return changes;
    }, []).map(change => ({
      index: change.index,
      kind: RouteTurnStepKind.CONTINUE,
      modifier: null,
      bearingChange: 0,
      way: change.way,
      instruction: `Continue onto ${change.way.name}`
    }));
    const startWay = wayNames[0] || wayNear(wayNames, 0, 1);
    const startLabel = wayLabel(startWay);
    const start = {
      index: 0,
      kind: RouteTurnStepKind.START,
      modifier: null,
      bearingChange: 0,
      way: startWay,
      instruction: `Start heading ${compassDirection(bearingBetween(points[0], pointAtLeast(points, cumulative, 0, TURN_LOOKAHEAD_METRES, 1)))}${startLabel ? ` along ${startLabel}` : ""}`
    };
    const finish = {index: last, kind: RouteTurnStepKind.FINISH, modifier: null, bearingChange: 0, way: wayNames[last] || null, instruction: "Finish"};
    const ordered = [start, ...turns, ...nameChanges].sort((left, right) => left.index - right.index).concat(finish);
    return ordered.map((step, position) => {
      const next = ordered[position + 1];
      return {
        index: step.index,
        latitude: points[step.index].latitude,
        longitude: points[step.index].longitude,
        kind: step.kind,
        modifier: step.modifier,
        bearingChange: Math.round(step.bearingChange),
        wayName: step.way?.name || null,
        wayReference: step.way?.reference || null,
        wayUse: step.way?.use || null,
        distanceFromStartMetres: Math.round(cumulative[step.index]),
        distanceToNextMetres: Math.round(next ? cumulative[next.index] - cumulative[step.index] : 0),
        instruction: step.instruction
      };
    });
  }
}

export function namesFromValhallaTrace(trace: ValhallaTraceAttributes | null, count: number): (RouteWayName | null)[] {
  const edges = trace?.edges || [];
  const matched = trace?.matched_points || [];
  return Array.from({length: count}, (_, index) => {
    const point = matched[index];
    const edge = point && point.type !== UNMATCHED && point.edge_index !== undefined ? edges[point.edge_index] : null;
    const name = edge ? (edge.names || [])[0] || "" : "";
    return edge ? (isWayReference(name) ? {name: "", use: edge.use || "", reference: name} : {name, use: edge.use || ""}) : null;
  });
}

function capitalised(token: string): boolean {
  return /^[A-Z][A-Za-z'’.-]*$/.test(token);
}

function cleanToken(token: string): string {
  return token.replace(/^[("'“‘]+|[)"'”’,;:!?.]+$/g, "");
}

export function placeNameCandidates(sentence: string): string[] {
  const rawTokens = (sentence || "").split(/\s+/).filter(token => token.length > 0);
  const tokens = rawTokens.map(cleanToken);
  const phrases = rawTokens.reduce((state: {phrases: string[][]; current: string[]}, rawToken, index) => {
    const token = tokens[index];
    const isCap = capitalised(token);
    const isConnector = NAME_CONNECTORS.includes(token.toLowerCase());
    const sentenceStart = index === 0;
    const endsPhrase = /[,;:!?.)]$/.test(rawToken) && !/^[A-Z][a-z]?\.$/.test(rawToken);
    if (isCap && !(sentenceStart && NAME_STOP_WORDS.includes(token.toLowerCase()))) {
      const current = [...state.current, token];
      return endsPhrase ? {phrases: [...state.phrases, current], current: []} : {phrases: state.phrases, current};
    } else if (isConnector && state.current.length > 0 && capitalised(tokens[index + 1] || "") && !endsPhrase) {
      return {phrases: state.phrases, current: [...state.current, token]};
    } else if (state.current.length > 0) {
      return {phrases: [...state.phrases, state.current], current: []};
    } else {
      return state;
    }
  }, {phrases: [], current: []});
  const all = phrases.current.length > 0 ? [...phrases.phrases, phrases.current] : phrases.phrases;
  return all
    .map(words => words.filter((word, index) => !(index === words.length - 1 && NAME_CONNECTORS.includes(word.toLowerCase()))).join(" "))
    .filter(name => name.length >= MIN_NAME_LENGTH && !NAME_STOP_WORDS.includes(name.toLowerCase()) && !GENERIC_PLACE_WORDS.includes(name.toLowerCase()) && /[a-z]/.test(name))
    .filter((name, index, names) => names.indexOf(name) === index);
}

function nameTokens(text: string | null | undefined): string[] {
  return (text || "").toLowerCase().split(/[^a-z0-9'\u2019]+/).filter(token => token.length > 0);
}

export function placeMatchesQuery(query: string, resultName: string | null | undefined): boolean {
  const result = nameTokens(resultName);
  const queryTokens = nameTokens(query);
  const distinctive = queryTokens.filter(token => !GENERIC_PLACE_WORDS.includes(token) && !NAME_CONNECTORS.includes(token));
  const required = distinctive.length > 0 ? distinctive : queryTokens;
  return result.length > 0 && required.length > 0 && required.every(token => result.includes(token));
}

export function stepIndexAtDistance(steps: {distanceFromStartMetres: number}[], distanceMetres: number): number {
  return steps.reduce((best, step, index) => step.distanceFromStartMetres <= distanceMetres ? index : best, 0);
}

function closestApproaches(distances: number[], maxMetres: number): number[] {
  const minima = distances
    .map((distance, index) => ({index, distance}))
    .filter(item => item.distance <= maxMetres)
    .filter(item => {
      const before = distances[item.index - 1] ?? Number.POSITIVE_INFINITY;
      const after = distances[item.index + 1] ?? Number.POSITIVE_INFINITY;
      return item.distance <= before && item.distance < after || (item.distance < before && item.distance <= after);
    })
    .map(item => item.index);
  const nearest = distances.reduce((best, distance, index) => distance < distances[best] ? index : best, 0);
  return minima.length > 0 ? minima : (distances[nearest] <= maxMetres ? [nearest] : []);
}

export function stepIndicesForPlace(points: RouteFollowPoint[], steps: {distanceFromStartMetres: number}[], place: RouteFollowPoint, maxMetresFromRoute = PLACE_MAX_METRES_FROM_ROUTE): number[] {
  if (points.length < 2 || steps.length === 0) {
    return [];
  } else {
    const cumulative = cumulativeDistances(points);
    const distances = points.map(point => metresBetween(point, place));
    return closestApproaches(distances, maxMetresFromRoute)
      .map(index => stepIndexAtDistance(steps, cumulative[index]))
      .filter((stepIndex, position, all) => all.indexOf(stepIndex) === position)
      .sort((left, right) => left - right);
  }
}

export function stepIndexForPlace(points: RouteFollowPoint[], steps: {distanceFromStartMetres: number}[], place: RouteFollowPoint, maxMetresFromRoute = PLACE_MAX_METRES_FROM_ROUTE): number | null {
  if (points.length < 2 || steps.length === 0) {
    return null;
  } else {
    const nearest = nearestPointIndex(points, place);
    const offRoute = metresBetween(points[nearest], place) > maxMetresFromRoute;
    return offRoute ? null : stepIndexAtDistance(steps, cumulativeDistances(points)[nearest]);
  }
}

function sentencesOf(text: string): string[] {
  return (text || "").split(/(?<=[.!?])\s+/).map(sentence => sentence.trim()).filter(sentence => sentence.length > 0);
}

function sentenceCandidates(sentence: string, steps: {wayName?: string | null}[], locate?: (sentence: string) => number[]): number[] {
  const lower = sentence.toLowerCase();
  const located = locate ? locate(sentence) : [];
  const byWayName = steps
    .map((step, index) => ({step, index}))
    .filter(item => !!item.step.wayName && item.step.wayName.length >= MIN_NAME_LENGTH && lower.includes(item.step.wayName.toLowerCase()))
    .map(item => item.index);
  return [...located, ...byWayName].filter((index, position, all) => index >= 0 && index < steps.length && all.indexOf(index) === position);
}

export function assignSentencesToSteps(candidates: number[][], stepCount: number): number[] {
  if (candidates.length === 0 || stepCount === 0) {
    return [];
  } else {
    const columns = Array.from({length: stepCount}, (_, index) => index);
    const first = columns.map(step => ({score: candidates[0].includes(step) ? 1 : 0, from: -1}));
    const table = candidates.slice(1).reduce((rows: {score: number; from: number}[][], sentence) => {
      const previous = rows[rows.length - 1];
      const row = columns.map(step => {
        const best = columns.filter(earlier => earlier <= step).reduce((chosen, earlier) => {
          return previous[earlier].score > chosen.score ? {score: previous[earlier].score, from: earlier} : chosen;
        }, {score: Number.NEGATIVE_INFINITY, from: 0});
        return {score: best.score + (sentence.includes(step) ? 1 : 0), from: best.from};
      });
      return [...rows, row];
    }, [first]);
    const lastRow = table[table.length - 1];
    const finalStep = columns.reduce((chosen, step) => lastRow[step].score > lastRow[chosen].score ? step : chosen, 0);
    return table.reduceRight((assignment: number[], row, position) => {
      const step = position === table.length - 1 ? finalStep : row.length && table[position + 1][assignment[0]].from;
      return [step, ...assignment];
    }, []);
  }
}

export function relaxSqueezedAnchors(candidates: number[][], stepCount: number): number[][] {
  const assignment = assignSentencesToSteps(candidates, stepCount);
  const expected = (position: number) => position * stepCount / Math.max(1, candidates.length);
  const deviation = (position: number) => Math.abs(assignment[position] - expected(position));
  const anchors = assignment.map((step, position) => candidates[position].includes(step) ? position : -1).filter(position => position >= 0);
  const squeezed = anchors
    .map((position, index) => ({position, next: anchors[index + 1]}))
    .find(pair => pair.next !== undefined && assignment[pair.position] === assignment[pair.next] && pair.next - pair.position - 1 >= SQUEEZED_SENTENCES);
  if (!squeezed) {
    return candidates;
  } else {
    const drop = deviation(squeezed.position) >= deviation(squeezed.next) ? squeezed.position : squeezed.next;
    return relaxSqueezedAnchors(candidates.map((options, position) => position === drop ? options.filter(step => step !== assignment[drop]) : options), stepCount);
  }
}

export function spreadUnmatchedSentences(assignment: number[], candidates: number[][], stepCount: number): number[] {
  const matched = assignment.map((step, position) => candidates[position].includes(step));
  const clamp = (step: number) => Math.min(stepCount - 1, Math.max(0, step));
  return assignment.map((step, position) => {
    if (matched[position]) {
      return step;
    } else {
      const runStart = matched.slice(0, position).lastIndexOf(true) + 1;
      const nextMatched = matched.findIndex((isMatched, index) => index > position && isMatched);
      const runEnd = nextMatched < 0 ? assignment.length : nextMatched;
      const before = runStart > 0 ? assignment[runStart - 1] : -1;
      const after = nextMatched < 0 ? stepCount : assignment[nextMatched];
      const runLength = runEnd - runStart;
      const offset = position - runStart + 1;
      return clamp(before + Math.round(offset * (after - before) / (runLength + 1)));
    }
  });
}

const TURN_SIDE = /\b(?:turn|bear|fork|keep|go|veer)\s+(?:sharp\s+|slight(?:ly)?\s+|half\s+)?(left|right|[LR])\b/i;
const SIDE_ABBREVIATIONS: Record<string, string> = {l: "left", r: "right"};

export function turnSide(text: string): string | null {
  const match = (text || "").match(TURN_SIDE);
  const side = match ? match[1].toLowerCase() : null;
  return side ? SIDE_ABBREVIATIONS[side] || side : null;
}

export function refineBySide(assignment: number[], candidates: number[][], units: string[], steps: {instruction?: string | null}[], paragraphOf: number[] = units.map(() => 0)): number[] {
  const matched = assignment.map((step, position) => candidates[position].includes(step));
  const last = steps.length - 1;
  return assignment.reduce((refined: number[], step, position) => {
    const side = turnSide(units[position]);
    const previous = position > 0 ? refined[position - 1] : 0;
    const nextAnchor = matched.findIndex((isMatched, index) => index > position && isMatched);
    const ceiling = nextAnchor >= 0 ? Math.max(previous, assignment[nextAnchor]) : last;
    const sameSide = (index: number) => side !== null && turnSide(steps[index]?.instruction || "") === side;
    if (matched[position]) {
      const ahead = candidates[position].filter(candidate => candidate >= previous);
      const preferred = ahead.find(sameSide) ?? ahead[0];
      return [...refined, preferred ?? Math.max(step, previous)];
    } else if (side !== null) {
      const from = position > 0 && paragraphOf[position] === paragraphOf[position - 1] ? previous + 1 : Math.max(previous, step);
      const bySide = steps.findIndex((candidate, index) => index >= from && index <= ceiling && sameSide(index));
      return [...refined, bySide >= 0 ? bySide : previous];
    } else if (position > 0 && paragraphOf[position] === paragraphOf[position - 1]) {
      return [...refined, previous];
    } else {
      return [...refined, Math.min(Math.max(step, previous), ceiling)];
    }
  }, []);
}

export function attachNarrative(directions: string[], steps: {wayName?: string | null; instruction?: string | null}[], locate?: (sentence: string) => number[]): string[] {
  const paragraphs = directions.map(direction => (direction || "").replace(/\s+/g, " ").trim()).filter(direction => direction.length > 0);
  const units = paragraphs.flatMap((paragraph, paragraphIndex) => sentencesOf(paragraph).map(sentence => ({sentence, paragraphIndex})));
  const sentences = units.map(unit => unit.sentence);
  const paragraphOf = units.map(unit => unit.paragraphIndex);
  const earliestFor = (position: number) => Math.floor((position / Math.max(1, sentences.length) - NARRATIVE_WINDOW) * steps.length);
  const candidates = sentences.map((sentence, position) => sentenceCandidates(sentence, steps, locate)
    .filter(index => index >= earliestFor(position))
    .sort((left, right) => left - right));
  const anchored = relaxSqueezedAnchors(candidates, steps.length);
  const spread = spreadUnmatchedSentences(assignSentencesToSteps(anchored, steps.length), anchored, steps.length);
  const assignment = refineBySide(spread, anchored, sentences, steps, paragraphOf);
  const notes: string[][] = steps.map(() => []);
  sentences.forEach((sentence, position) => {
    const target = assignment[position];
    if (notes[target]) {
      notes[target].push(sentence);
    }
  });
  return notes.map(parts => parts.join(" "));
}
