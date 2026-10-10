import { guideEntriesFor, replacingTurns, turnWaypointsFromSteps } from "./route-guide-edit";
import { RouteFollowPoint, RouteFollowWaypoint, RouteTurnStepKind, RouteWaypointKind } from "../models/route-follow.model";
import { MapMarker } from "../models/content-text.model";

const circular: RouteFollowPoint[] = [
  {latitude: 51.3, longitude: 0.4},
  {latitude: 51.31, longitude: 0.4},
  {latitude: 51.31, longitude: 0.41},
  {latitude: 51.3, longitude: 0.4}
];

describe("guideEntriesFor", () => {
  it("puts the start of a circular route at the start, not the end", () => {
    const start: MapMarker = {latitude: 51.3, longitude: 0.4, label: "Start", instruction: "ME18 5RB", kind: RouteWaypointKind.START};
    const end: MapMarker = {latitude: 51.3, longitude: 0.4, label: "End", instruction: "ME18 5RB", kind: RouteWaypointKind.END};
    const entries = guideEntriesFor([start, end], circular, false);
    expect(entries[0].distanceMetres).toEqual(0);
    expect(entries[1].distanceMetres).toBeGreaterThan(2000);
  });

  it("keeps authored markers when replacing generated turns", () => {
    const start = {id: "start", latitude: 51.3, longitude: 0.4, kind: RouteWaypointKind.START};
    const oldTurn = {id: "old", latitude: 51.31, longitude: 0.4, kind: RouteWaypointKind.TURN};
    const generated = turnWaypointsFromSteps([{
      index: 0, latitude: 51.305, longitude: 0.4, kind: RouteTurnStepKind.TURN, modifier: null,
      bearingChange: 90, wayName: "Church Lane", wayUse: null, distanceFromStartMetres: 10, distanceToNextMetres: 20,
      instruction: "Turn left onto Church Lane"
    }], () => "new-turn");
    expect(replacingTurns<RouteFollowWaypoint>([start, oldTurn], generated)).toEqual([start, generated[0]]);
    expect(generated[0].instruction).toEqual("Turn left onto Church Lane");
  });
});
