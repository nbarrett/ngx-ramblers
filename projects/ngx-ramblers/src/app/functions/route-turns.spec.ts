import { RouteTurnModifier, RouteTurnStepKind, RouteWayName } from "../models/route-follow.model";
import { assignSentencesToSteps, attachNarrative, spreadUnmatchedSentences, bearingChange, travelBearingAt, compassDirection, namesFromValhallaTrace, placeNameCandidates, routeTurnSteps, stepIndexAtDistance, stepIndexForPlace, stepIndicesForPlace, turnCandidates, turnModifierFor, turnRotationDegrees } from "./route-turns";

const STEP = 0.0005;
const north = [0, 1, 2, 3, 4, 5].map(step => ({latitude: 51 + step * STEP, longitude: 1}));
const east = [1, 2, 3, 4, 5].map(step => ({latitude: 51 + 5 * STEP, longitude: 1 + step * STEP}));
const corner = [...north, ...east];
const names = (way: RouteWayName | null, count: number) => Array.from({length: count}, () => way);

describe("bearing helpers", () => {
  it("measures signed bearing changes and compass points", () => {
    expect(bearingChange(350, 20)).toBe(30);
    expect(bearingChange(20, 350)).toBe(-30);
    expect(bearingChange(0, 180)).toBe(180);
    expect(compassDirection(0)).toBe("north");
    expect(compassDirection(95)).toBe("east");
    expect(compassDirection(300)).toBe("north-west");
  });

  it("classifies turns by size and side", () => {
    expect(turnModifierFor(10)).toBeNull();
    expect(turnModifierFor(45)).toBe(RouteTurnModifier.SLIGHT_RIGHT);
    expect(turnModifierFor(-90)).toBe(RouteTurnModifier.LEFT);
    expect(turnModifierFor(140)).toBe(RouteTurnModifier.SHARP_RIGHT);
    expect(turnModifierFor(-175)).toBe(RouteTurnModifier.U_TURN);
    expect(turnRotationDegrees(RouteTurnModifier.LEFT)).toBe(-90);
    expect(turnRotationDegrees(null)).toBe(0);
  });
});

describe("travelBearingAt", () => {
  it("gives the direction of travel along the line at a point, including the last point", () => {
    expect(Math.round(travelBearingAt(corner, 2))).toBe(0);
    expect(Math.round(travelBearingAt(corner, corner.length - 2))).toBe(90);
    expect(Math.round(travelBearingAt(corner, corner.length - 1))).toBe(90);
    expect(travelBearingAt([corner[0]], 0)).toBeNull();
  });
});

describe("turnCandidates", () => {
  it("finds the single right-angle corner in an L-shaped line", () => {
    const candidates = turnCandidates(corner);
    expect(candidates.length).toBe(1);
    expect(candidates[0].index).toBe(5);
    expect(Math.round(candidates[0].change)).toBe(90);
  });

  it("finds nothing on a straight line", () => {
    expect(turnCandidates(north)).toEqual([]);
  });
});

describe("routeTurnSteps", () => {
  it("writes start, turn and finish steps using the way names either side of the corner", () => {
    const wayNames = [...names({name: "Church Lane", use: "road"}, 6), ...names({name: "Mill Road", use: "road"}, 5)];
    const steps = routeTurnSteps(corner, wayNames);
    expect(steps.map(step => step.kind)).toEqual([RouteTurnStepKind.START, RouteTurnStepKind.TURN, RouteTurnStepKind.FINISH]);
    expect(steps[0].instruction).toBe("Start heading north along Church Lane");
    expect(steps[1].instruction).toBe("Turn right onto Mill Road");
    expect(steps[1].modifier).toBe(RouteTurnModifier.RIGHT);
    expect(steps[1].wayName).toBe("Mill Road");
    expect(steps[1].distanceFromStartMetres).toBe(Math.round(5 * STEP * 111195));
    expect(steps[2].instruction).toBe("Finish");
    expect(steps[2].distanceToNextMetres).toBe(0);
  });

  it("describes unnamed ways by what they are and notes a road name change without a turn", () => {
    const wayNames = [...names({name: "", use: "footway"}, 3), ...names({name: "High Street", use: "road"}, 3)];
    const steps = routeTurnSteps(north, wayNames);
    expect(steps.map(step => step.instruction)).toEqual(["Start heading north along the footpath", "Continue onto High Street", "Finish"]);
    expect(steps[1].kind).toBe(RouteTurnStepKind.CONTINUE);
  });

  it("ignores slight bends that stay on the same way but keeps slight turns where the way changes", () => {
    const bend = [...north, {latitude: 51 + 6 * STEP, longitude: 1 + 1.2 * STEP}, {latitude: 51 + 7 * STEP, longitude: 1 + 2.4 * STEP}, {latitude: 51 + 8 * STEP, longitude: 1 + 3.6 * STEP}];
    expect(turnCandidates(bend).length).toBe(1);
    expect(routeTurnSteps(bend, names({name: "Wenderton Lane", use: "road"}, bend.length)).map(step => step.kind)).toEqual([RouteTurnStepKind.START, RouteTurnStepKind.FINISH]);
    const junction = routeTurnSteps(bend, [...names({name: "Wenderton Lane", use: "road"}, 6), ...names({name: "Preston Hill", use: "road"}, 3)]);
    expect(junction.map(step => step.instruction)).toEqual(["Start heading north along Wenderton Lane", "Bear right onto Preston Hill", "Finish"]);
  });

  it("does not announce a road again straight after turning onto it", () => {
    const wayNames = [...names({name: "Church Lane", use: "road"}, 6), ...names({name: "Mill Road", use: "road"}, 2), ...names({name: "Mill Road", use: "road"}, 3)];
    const steps = routeTurnSteps(corner, wayNames);
    expect(steps.map(step => step.instruction)).toEqual(["Start heading north along Church Lane", "Turn right onto Mill Road", "Finish"]);
  });

  it("turns onto an unnamed footpath and stays on a road that keeps its name", () => {
    const ontoPath = routeTurnSteps(corner, [...names({name: "Church Lane", use: "road"}, 6), ...names({name: "", use: "footway"}, 5)]);
    expect(ontoPath[1].instruction).toBe("Turn right along the footpath");
    const sameRoad = routeTurnSteps(corner, names({name: "Church Lane", use: "road"}, 11));
    expect(sameRoad[1].instruction).toBe("Turn right to stay on Church Lane");
    expect(sameRoad.length).toBe(3);
    expect(routeTurnSteps(corner, names(null, 11))[1].instruction).toBe("Turn right");
  });
});

describe("namesFromValhallaTrace", () => {
  it("maps each traced point to the name and use of its matched edge", () => {
    const trace = {
      edges: [{names: ["High Street", "A257"], use: "road"}, {use: "footway"}],
      matched_points: [{edge_index: 0, type: "matched"}, {edge_index: 1, type: "interpolated"}, {type: "unmatched"}]
    };
    expect(namesFromValhallaTrace(trace, 4)).toEqual([{name: "High Street", use: "road"}, {name: "", use: "footway"}, null, null]);
    expect(namesFromValhallaTrace(null, 2)).toEqual([null, null]);
  });
});

describe("placeNameCandidates", () => {
  it("picks out capitalised place names and leaves the verbs and directions behind", () => {
    expect(placeNameCandidates("From the car park turn right along the High Street past Wingham Post Office.")).toEqual(["High Street", "Wingham Post Office"]);
    expect(placeNameCandidates("Turn left to follow the riverbank (look out for kingfishers) and continue past the lakes.")).toEqual([]);
    expect(placeNameCandidates("Once over it keep to the field edge until you join the lane at the hamlet of Seaton.")).toEqual(["Seaton"]);
    expect(placeNameCandidates("Take time to look at St Mary's Church, Wingham and the River Stour.")).toEqual(["St Mary's Church", "Wingham", "River Stour"]);
    expect(placeNameCandidates("Turn left past school into centre of Wickhambreaux. There is a seat by the Rose Inn.")).toEqual(["Wickhambreaux", "Rose Inn"]);
    expect(placeNameCandidates("Walk up to the Church, take the path to the right of it and cross the Wingham River.")).toEqual(["Wingham River"]);
  });
});

describe("stepIndexForPlace", () => {
  it("returns the step the walker is on when they reach the place", () => {
    const steps = [{distanceFromStartMetres: 0}, {distanceFromStartMetres: 300}, {distanceFromStartMetres: 500}];
    expect(stepIndexAtDistance(steps, 100)).toBe(0);
    expect(stepIndexAtDistance(steps, 300)).toBe(1);
    expect(stepIndexAtDistance(steps, 900)).toBe(2);
    expect(stepIndexForPlace(corner, [{distanceFromStartMetres: 0}, {distanceFromStartMetres: 5 * STEP * 111195}], east[2])).toBe(1);
    expect(stepIndexForPlace([corner[0]], [{distanceFromStartMetres: 0}], east[2])).toBeNull();
    expect(stepIndexForPlace(corner, [{distanceFromStartMetres: 0}], {latitude: 51.05, longitude: 1.05})).toBeNull();
  });

  it("reports every pass of the route within reach of a place, earliest first", () => {
    const outAndBack = [...north, ...north.slice().reverse()];
    const steps = [{distanceFromStartMetres: 0}, {distanceFromStartMetres: 5 * STEP * 111195}];
    expect(stepIndicesForPlace(outAndBack, steps, north[1])).toEqual([0, 1]);
  });
});

describe("attachNarrative", () => {
  it("hangs each sentence on the step whose way it names, and the rest on the current step", () => {
    const steps = [{wayName: "St. Marys Meadow"}, {wayName: "Preston Hill"}, {wayName: null}, {wayName: "Wenderton Lane"}];
    const notes = attachNarrative([
      "From the car park turn right along the High Street. Continue and cross the road to take Preston Hill on the left. Near the top of the hill take the lane on the left, Wenderton Lane, and follow it to the next junction.",
      "Here go left towards the woods."
    ], steps);
    expect(notes).toEqual([
      "From the car park turn right along the High Street.",
      "Continue and cross the road to take Preston Hill on the left.",
      "",
      "Near the top of the hill take the lane on the left, Wenderton Lane, and follow it to the next junction. Here go left towards the woods."
    ]);
  });

  it("chooses the monotonic assignment that matches the most sentences, so one stray mention does not drag the rest forward", () => {
    expect(assignSentencesToSteps([[0], [], [24], [5], [6], [7]], 30)).toEqual([0, 0, 0, 5, 6, 7]);
    expect(assignSentencesToSteps([[3], [1], [2]], 4)).toEqual([0, 1, 2]);
    expect(assignSentencesToSteps([[], []], 3)).toEqual([0, 0]);
  });

  it("pools located places with way names, takes the earliest step ahead and never moves backwards", () => {
    const steps = [{wayName: "High Street"}, {wayName: null}, {wayName: null}, {wayName: "High Street"}];
    const locate = (sentence: string) => sentence.includes("Seaton") ? [2] : (sentence.includes("High Street") ? [3] : []);
    const notes = attachNarrative(["Leave along the High Street. Walk to the hamlet of Seaton. Return along the High Street. Back at the car park, finish."], steps, locate);
    expect(notes).toEqual(["Leave along the High Street.", "", "Walk to the hamlet of Seaton.", "Return along the High Street. Back at the car park, finish."]);
  });
});

describe("long tracks", () => {
  it("works out the turns on a track of twenty thousand points without quadratic work", () => {
    const wiggle = Array.from({length: 20000}, (_, index) => ({latitude: 51 + index * 0.0001, longitude: 1 + (index % 200 < 100 ? 0 : 0.002)}));
    const started = Date.now();
    const steps = routeTurnSteps(wiggle, names(null, wiggle.length));
    expect(Date.now() - started).toBeLessThan(5000);
    expect(steps[0].kind).toBe(RouteTurnStepKind.START);
    expect(steps[steps.length - 1].kind).toBe(RouteTurnStepKind.FINISH);
    expect(steps.length).toBeGreaterThan(100);
  });
});

describe("spreadUnmatchedSentences", () => {
  it("spreads sentences that match nothing evenly between the sentences that do", () => {
    const candidates = [[], [], [3], [], [], [], [8]];
    const assignment = [0, 0, 3, 3, 3, 3, 8];
    expect(spreadUnmatchedSentences(assignment, candidates, 10)).toEqual([0, 2, 3, 4, 6, 7, 8]);
  });

  it("spreads a run after the last match up to the final step", () => {
    expect(spreadUnmatchedSentences([2, 2, 2], [[2], [], []], 5)).toEqual([2, 3, 4]);
  });

  it("spreads everything across the route when nothing matches", () => {
    expect(spreadUnmatchedSentences([0, 0, 0, 0], [[], [], [], []], 4)).toEqual([0, 1, 2, 3]);
  });
});
